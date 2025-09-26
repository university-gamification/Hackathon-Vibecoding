import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Dashboard from './Dashboard';
import { listFiles, uploadFiles, buildRag } from '../api';

// Mock the API module
jest.mock('../api', () => ({
  listFiles: jest.fn(),
  uploadFiles: jest.fn(),
  buildRag: jest.fn(),
}));

const mockListFiles = listFiles as jest.MockedFunction<typeof listFiles>;
const mockUploadFiles = uploadFiles as jest.MockedFunction<typeof uploadFiles>;
const mockBuildRag = buildRag as jest.MockedFunction<typeof buildRag>;

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render the main heading and description', async () => {
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Knowledge');
      expect(screen.getByText('Upload files to your personal space, then build your RAG index.')).toBeInTheDocument();
    });

    it('should render upload and build RAG buttons', async () => {
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      expect(screen.getByText('Upload files')).toBeInTheDocument();
      expect(screen.getByText('Build RAG')).toBeInTheDocument();
    });

    it('should render the Recent uploads section', async () => {
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Recent uploads');
    });

    it('should call listFiles on component mount', async () => {
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(mockListFiles).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('File List Display', () => {
    it('should display "No files yet" when files array is empty', async () => {
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('No files yet')).toBeInTheDocument();
      });
    });

    it('should display files when files are loaded', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 2,
          filename: 'document.docx',
          created_at: '2023-01-02T00:00:00Z',
          path: '/uploads/document.docx',
        },
      ];
      mockListFiles.mockResolvedValue(mockFiles);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(screen.getByText('document.docx')).toBeInTheDocument();
      });
    });

    it('should display file path when available', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-01-01T00:00:00Z',
          path: '/uploads/test.pdf',
        },
      ];
      mockListFiles.mockResolvedValue(mockFiles);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('/uploads/test.pdf')).toBeInTheDocument();
      });
    });

    it('should not display path element when path is not provided', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-01-01T00:00:00Z',
        },
      ];
      mockListFiles.mockResolvedValue(mockFiles);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(screen.queryByText('/uploads/test.pdf')).not.toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-01-01T12:30:45Z',
        },
      ];
      mockListFiles.mockResolvedValue(mockFiles);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        const dateElement = screen.getByText((content, node) => {
          return node?.textContent === new Date('2023-01-01T12:30:45Z').toLocaleString();
        });
        expect(dateElement).toBeInTheDocument();
      });
    });

    it('should render download links with correct hrefs', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 2,
          filename: 'document.docx',
          created_at: '2023-01-02T00:00:00Z',
        },
      ];
      mockListFiles.mockResolvedValue(mockFiles);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        const downloadLinks = screen.getAllByText('Download');
        expect(downloadLinks).toHaveLength(2);
        expect(downloadLinks[0].closest('a')).toHaveAttribute('href', '/api/files/download/1');
        expect(downloadLinks[1].closest('a')).toHaveAttribute('href', '/api/files/download/2');
      });
    });

    it('should set correct target and rel attributes on download links', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-01-01T00:00:00Z',
        },
      ];
      mockListFiles.mockResolvedValue(mockFiles);
      
      render(<Dashboard />);
      
      await waitFor(() => {
        const downloadLink = screen.getByText('Download').closest('a');
        expect(downloadLink).toHaveAttribute('target', '_blank');
        expect(downloadLink).toHaveAttribute('rel', 'noreferrer');
      });
    });
  });

  describe('File Upload Functionality', () => {
    it('should handle file selection and upload', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValue(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith([testFile]);
      });
    });

    it('should show uploading state during upload', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      expect(screen.getByText('Uploading…')).toBeInTheDocument();
    });

    it('should handle multiple file selection', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValue(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFiles = [
        new File(['test content 1'], 'test1.txt', { type: 'text/plain' }),
        new File(['test content 2'], 'test2.txt', { type: 'text/plain' }),
      ];
      
      await user.upload(fileInput, testFiles);
      
      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith(testFiles);
      });
    });

    it('should show success message after successful upload', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValue(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText('Upload complete')).toBeInTheDocument();
      });
    });

    it('should refresh file list after successful upload', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValue(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(mockListFiles).toHaveBeenCalledTimes(2); // Once on mount, once after upload
      });
    });

    it('should clear file input value after upload', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValue(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(fileInput.value).toBe('');
      });
    });

    it('should handle upload error', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockRejectedValue(new Error('Upload failed'));
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });

    it('should handle upload error with custom message', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockRejectedValue(new Error('Network error occurred'));
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      });
    });

    it('should not call uploadFiles when no files are selected', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      
      // Simulate clicking without selecting files
      fireEvent.change(fileInput, { target: { files: [] } });
      
      expect(mockUploadFiles).not.toHaveBeenCalled();
    });

    it('should reset uploading state after upload completes', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValue(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText('Upload files')).toBeInTheDocument();
        expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
      });
    });

    it('should clear previous messages when starting new upload', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      
      render(<Dashboard />);
      
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      // First upload
      await user.upload(fileInput, testFile);
      await waitFor(() => {
        expect(screen.getByText('Upload complete')).toBeInTheDocument();
      });
      
      // Second upload should clear previous message
      await user.upload(fileInput, testFile);
      
      // During upload, message should be cleared
      expect(screen.queryByText('Upload complete')).not.toBeInTheDocument();
    });
  });

  describe('Build RAG Functionality', () => {
    it('should call buildRag when Build RAG button is clicked', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockResolvedValue({ files_indexed: 5 });
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(mockBuildRag).toHaveBeenCalledTimes(1);
      });
    });

    it('should show building state during RAG build', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      expect(screen.getByText('Building…')).toBeInTheDocument();
    });

    it('should disable Build RAG button during build', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG') as HTMLButtonElement;
      await user.click(buildButton);
      
      expect(buildButton.closest('button')).toBeDisabled();
    });

    it('should show success message after successful RAG build', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockResolvedValue({ files_indexed: 3 });
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('RAG built: 3 files indexed')).toBeInTheDocument();
      });
    });

    it('should handle RAG build response without files_indexed', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockResolvedValue({});
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('RAG built: ? files indexed')).toBeInTheDocument();
      });
    });

    it('should handle RAG build error', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockRejectedValue(new Error('Failed to build RAG'));
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to build RAG')).toBeInTheDocument();
      });
    });

    it('should handle RAG build error with custom message', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockRejectedValue(new Error('Indexing service unavailable'));
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('Indexing service unavailable')).toBeInTheDocument();
      });
    });

    it('should reset building state after build completes', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockResolvedValue({ files_indexed: 2 });
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('Build RAG')).toBeInTheDocument();
        expect(screen.queryByText('Building…')).not.toBeInTheDocument();
      });
    });

    it('should clear previous messages when starting RAG build', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockResolvedValueOnce({ files_indexed: 2 }).mockResolvedValueOnce({ files_indexed: 3 });
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      
      // First build
      await user.click(buildButton);
      await waitFor(() => {
        expect(screen.getByText('RAG built: 2 files indexed')).toBeInTheDocument();
      });
      
      // Second build should clear previous message
      await user.click(buildButton);
      
      // During build, message should be cleared
      expect(screen.queryByText('RAG built: 2 files indexed')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle listFiles error on component mount', async () => {
      mockListFiles.mockRejectedValue(new Error('Failed to fetch files'));
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch files')).toBeInTheDocument();
      });
    });

    it('should handle listFiles error with fallback message', async () => {
      mockListFiles.mockRejectedValue(new Error(''));
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to list files')).toBeInTheDocument();
      });
    });

    it('should handle error without message property', async () => {
      mockListFiles.mockRejectedValue('String error');
      
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to list files')).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    it('should not display message initially', () => {
      mockListFiles.mockResolvedValue([]);
      
      render(<Dashboard />);
      
      expect(screen.queryByRole('paragraph')).not.toHaveClass('hint');
    });

    it('should display message when present', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockBuildRag.mockResolvedValue({ files_indexed: 1 });
      
      render(<Dashboard />);
      
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        const messageElement = screen.getByText('RAG built: 1 files indexed');
        expect(messageElement.closest('p')).toHaveClass('hint');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete upload and RAG build workflow', async () => {
      const user = userEvent.setup();
      const mockFilesAfterUpload = [
        {
          id: 1,
          filename: 'uploaded.pdf',
          created_at: '2023-01-01T00:00:00Z',
        },
      ];
      
      mockListFiles.mockResolvedValueOnce([]).mockResolvedValueOnce(mockFilesAfterUpload);
      mockUploadFiles.mockResolvedValue(undefined);
      mockBuildRag.mockResolvedValue({ files_indexed: 1 });
      
      render(<Dashboard />);
      
      // Initial state
      await waitFor(() => {
        expect(screen.getByText('No files yet')).toBeInTheDocument();
      });
      
      // Upload file
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText('Upload complete')).toBeInTheDocument();
        expect(screen.getByText('uploaded.pdf')).toBeInTheDocument();
      });
      
      // Build RAG
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('RAG built: 1 files indexed')).toBeInTheDocument();
      });
    });

    it('should handle errors gracefully without breaking the UI', async () => {
      const user = userEvent.setup();
      mockListFiles.mockResolvedValue([]);
      mockUploadFiles.mockRejectedValue(new Error('Upload error'));
      mockBuildRag.mockRejectedValue(new Error('Build error'));
      
      render(<Dashboard />);
      
      // Try upload (should fail)
      const fileInput = screen.getByDisplayValue('');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText('Upload error')).toBeInTheDocument();
      });
      
      // Try RAG build (should fail)
      const buildButton = screen.getByText('Build RAG');
      await user.click(buildButton);
      
      await waitFor(() => {
        expect(screen.getByText('Build error')).toBeInTheDocument();
      });
      
      // UI should still be functional
      expect(screen.getByText('Your Knowledge')).toBeInTheDocument();
      expect(screen.getByText('Upload files')).toBeInTheDocument();
      expect(screen.getByText('Build RAG')).toBeInTheDocument();
    });
  });
});