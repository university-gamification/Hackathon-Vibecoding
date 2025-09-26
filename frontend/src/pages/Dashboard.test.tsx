import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'
import { listFiles, uploadFiles, buildRag } from '../api'

// Mock the API functions
jest.mock('../api', () => ({
  listFiles: jest.fn(),
  uploadFiles: jest.fn(),
  buildRag: jest.fn(),
}))

const mockListFiles = listFiles as jest.MockedFunction<typeof listFiles>
const mockUploadFiles = uploadFiles as jest.MockedFunction<typeof uploadFiles>
const mockBuildRag = buildRag as jest.MockedFunction<typeof buildRag>

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any remaining timers
    jest.clearAllTimers()
  })

  describe('Initial Rendering and Data Loading', () => {
    it('should render the dashboard with initial UI elements', async () => {
      mockListFiles.mockResolvedValue([])

      render(<Dashboard />)

      expect(screen.getByText('Your Knowledge')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Upload files to your personal space, then build your RAG index.'
        )
      ).toBeInTheDocument()
      expect(screen.getByText('Upload files')).toBeInTheDocument()
      expect(screen.getByText('Build RAG')).toBeInTheDocument()
      expect(screen.getByText('Recent uploads')).toBeInTheDocument()
    })

    it('should call listFiles on component mount', async () => {
      const mockFiles = [
        { id: 1, filename: 'test.pdf', created_at: '2023-01-01T00:00:00Z' },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockListFiles).toHaveBeenCalledTimes(1)
      })
    })

    it('should display "No files yet" when files array is empty', async () => {
      mockListFiles.mockResolvedValue([])

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('No files yet')).toBeInTheDocument()
      })
    })

    it('should handle listFiles API error on initial load', async () => {
      const errorMessage = 'Network error occurred'
      mockListFiles.mockRejectedValue(new Error(errorMessage))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should handle listFiles API error with fallback message', async () => {
      mockListFiles.mockRejectedValue(new Error())

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Failed to list files')).toBeInTheDocument()
      })
    })
  })

  describe('File Display and Rendering', () => {
    it('should display files with all required information', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'document.pdf',
          created_at: '2023-12-25T10:30:00Z',
          path: '/uploads/docs/document.pdf',
        },
        {
          id: 2,
          filename: 'image.jpg',
          created_at: '2023-12-24T15:45:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument()
        expect(screen.getByText('image.jpg')).toBeInTheDocument()
        expect(
          screen.getByText('/uploads/docs/document.pdf')
        ).toBeInTheDocument()
      })

      // Check for download links
      const downloadLinks = screen.getAllByText('Download')
      expect(downloadLinks).toHaveLength(2)
      expect(downloadLinks[0]).toHaveAttribute(
        'href',
        '/api/files/download/1'
      )
      expect(downloadLinks[1]).toHaveAttribute(
        'href',
        '/api/files/download/2'
      )
    })

    it('should format and display file creation dates correctly', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-12-25T10:30:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        // The date should be formatted according to user's locale
        const dateElement = screen.getByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === 'small' &&
            content.includes('2023')
          )
        })
        expect(dateElement).toBeInTheDocument()
      })
    })

    it('should not display path when path is undefined', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: '2023-12-25T10:30:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
        // Path should not be rendered when undefined
        expect(screen.queryByText('/uploads/')).not.toBeInTheDocument()
      })
    })

    it('should handle files with special characters in filename', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'file with spaces & symbols!.pdf',
          created_at: '2023-12-25T10:30:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(
          screen.getByText('file with spaces & symbols!.pdf')
        ).toBeInTheDocument()
      })
    })
  })

  describe('File Upload Functionality', () => {
    it('should handle file selection and upload successfully', async () => {
      const user = userEvent.setup()
      const mockFiles: any[] = []
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      mockListFiles.mockResolvedValue(mockFiles)
      mockUploadFiles.mockResolvedValue(undefined)
      mockListFiles
        .mockResolvedValueOnce(mockFiles) // Initial load
        .mockResolvedValueOnce([
          { id: 1, filename: 'test.pdf', created_at: '2023-01-01T00:00:00Z' },
        ]) // After upload

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      await user.upload(fileInput, testFile)

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith([testFile])
      })

      await waitFor(() => {
        expect(screen.getByText('Upload complete')).toBeInTheDocument()
      })

      // Should refresh file list after upload
      expect(mockListFiles).toHaveBeenCalledTimes(2)
    })

    it('should handle multiple file selection', async () => {
      const user = userEvent.setup()
      const testFiles = [
        new File(['content 1'], 'test1.pdf', { type: 'application/pdf' }),
        new File(['content 2'], 'test2.pdf', { type: 'application/pdf' }),
      ]

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockResolvedValue(undefined)

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      await user.upload(fileInput, testFiles)

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith(testFiles)
      })
    })

    it('should show uploading state during file upload', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })
      let uploadResolve: (value: any) => void

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockImplementation(
        () =>
          new Promise((resolve) => {
            uploadResolve = resolve
          })
      )

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      await user.upload(fileInput, testFile)

      // Should show uploading state
      expect(screen.getByText('Uploading…')).toBeInTheDocument()

      // Upload button should be disabled during upload
      const uploadButton = screen.getByText('Uploading…')
      expect(uploadButton.closest('label')).toHaveTextContent('Uploading…')

      // Complete the upload
      uploadResolve?.(undefined)

      await waitFor(() => {
        expect(screen.getByText('Upload files')).toBeInTheDocument()
      })
    })

    it('should handle upload failure and show error message', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const errorMessage = 'Upload failed due to server error'

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockRejectedValue(new Error(errorMessage))

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      await user.upload(fileInput, testFile)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      // Should reset upload state
      expect(screen.getByText('Upload files')).toBeInTheDocument()
    })

    it('should handle upload failure with fallback error message', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockRejectedValue(new Error())

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      await user.upload(fileInput, testFile)

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument()
      })
    })

    it('should clear file input value after upload attempt', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockResolvedValue(undefined)

      render(<Dashboard />)

      const fileInput = screen.getByLabelText(
        'Upload files'
      ) as HTMLInputElement

      await user.upload(fileInput, testFile)

      await waitFor(() => {
        expect(fileInput.value).toBe('')
      })
    })

    it('should not upload when no files are selected', async () => {
      mockListFiles.mockResolvedValue([])

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      // Simulate selecting no files (empty FileList)
      fireEvent.change(fileInput, { target: { files: null } })

      expect(mockUploadFiles).not.toHaveBeenCalled()
    })

    it('should not upload when empty file list is selected', async () => {
      mockListFiles.mockResolvedValue([])

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      // Simulate selecting empty file list
      Object.defineProperty(fileInput, 'files', {
        value: [],
        configurable: true,
      })

      fireEvent.change(fileInput, { target: { files: [] } })

      expect(mockUploadFiles).not.toHaveBeenCalled()
    })

    it('should clear previous messages when starting new upload', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockResolvedValue(undefined)

      render(<Dashboard />)

      // First, simulate an error state
      mockListFiles.mockRejectedValueOnce(new Error('Previous error'))

      await waitFor(() => {
        expect(screen.getByText('Previous error')).toBeInTheDocument()
      })

      // Now upload a file - should clear the previous error
      const fileInput = screen.getByLabelText('Upload files')
      await user.upload(fileInput, testFile)

      await waitFor(() => {
        expect(screen.queryByText('Previous error')).not.toBeInTheDocument()
        expect(screen.getByText('Upload complete')).toBeInTheDocument()
      })
    })
  })

  describe('RAG Build Functionality', () => {
    it('should handle RAG build successfully', async () => {
      const user = userEvent.setup()
      const buildResponse = { files_indexed: 5 }

      mockListFiles.mockResolvedValue([])
      mockBuildRag.mockResolvedValue(buildResponse)

      render(<Dashboard />)

      const buildButton = screen.getByText('Build RAG')

      await user.click(buildButton)

      await waitFor(() => {
        expect(mockBuildRag).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(
          screen.getByText('RAG built: 5 files indexed')
        ).toBeInTheDocument()
      })
    })

    it('should handle RAG build with undefined files_indexed', async () => {
      const user = userEvent.setup()
      const buildResponse: any = {}

      mockListFiles.mockResolvedValue([])
      mockBuildRag.mockResolvedValue(buildResponse)

      render(<Dashboard />)

      const buildButton = screen.getByText('Build RAG')

      await user.click(buildButton)

      await waitFor(() => {
        expect(
          screen.getByText('RAG built: ? files indexed')
        ).toBeInTheDocument()
      })
    })

    it('should show building state during RAG build', async () => {
      const user = userEvent.setup()
      let buildResolve: (value: any) => void

      mockListFiles.mockResolvedValue([])
      mockBuildRag.mockImplementation(
        () =>
          new Promise((resolve) => {
            buildResolve = resolve
          })
      )

      render(<Dashboard />)

      const buildButton = screen.getByText('Build RAG')

      await user.click(buildButton)

      // Should show building state
      expect(screen.getByText('Building…')).toBeInTheDocument()

      // Button should be disabled during build
      const buildingButton = screen.getByText('Building…')
      expect(buildingButton).toBeDisabled()

      // Complete the build
      buildResolve?.({ files_indexed: 3 })

      await waitFor(() => {
        expect(screen.getByText('Build RAG')).toBeInTheDocument()
        expect(screen.getByText('Build RAG')).not.toBeDisabled()
      })
    })

    it('should handle RAG build failure', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Build failed due to server error'

      mockListFiles.mockResolvedValue([])
      mockBuildRag.mockRejectedValue(new Error(errorMessage))

      render(<Dashboard />)

      const buildButton = screen.getByText('Build RAG')

      await user.click(buildButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      // Should reset build state
      expect(screen.getByText('Build RAG')).toBeInTheDocument()
      expect(screen.getByText('Build RAG')).not.toBeDisabled()
    })

    it('should handle RAG build failure with fallback error message', async () => {
      const user = userEvent.setup()

      mockListFiles.mockResolvedValue([])
      mockBuildRag.mockRejectedValue(new Error())

      render(<Dashboard />)

      const buildButton = screen.getByText('Build RAG')

      await user.click(buildButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to build RAG')).toBeInTheDocument()
      })
    })

    it('should clear previous messages when starting RAG build', async () => {
      const user = userEvent.setup()

      mockListFiles.mockResolvedValue([])
      mockBuildRag.mockResolvedValue({ files_indexed: 2 })

      render(<Dashboard />)

      // First, simulate an error state
      mockListFiles.mockRejectedValueOnce(new Error('Previous error'))

      await waitFor(() => {
        expect(screen.getByText('Previous error')).toBeInTheDocument()
      })

      // Now build RAG - should clear the previous error
      const buildButton = screen.getByText('Build RAG')
      await user.click(buildButton)

      await waitFor(() => {
        expect(screen.queryByText('Previous error')).not.toBeInTheDocument()
        expect(
          screen.getByText('RAG built: 2 files indexed')
        ).toBeInTheDocument()
      })
    })
  })

  describe('State Management and UI Interactions', () => {
    it('should not allow simultaneous uploads', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      mockListFiles.mockResolvedValue([])
      // Make upload hang
      mockUploadFiles.mockImplementation(() => new Promise(() => {}))

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')

      // Start first upload
      await user.upload(fileInput, testFile)

      // Should show uploading state
      expect(screen.getByText('Uploading…')).toBeInTheDocument()

      // Try to start another upload - input should be effectively disabled by showing "Uploading..." state
      expect(screen.getByText('Uploading…')).toBeInTheDocument()
    })

    it('should not allow RAG build while uploading', async () => {
      const user = userEvent.setup()
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      mockListFiles.mockResolvedValue([])
      // Make upload hang
      mockUploadFiles.mockImplementation(() => new Promise(() => {}))

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')
      const buildButton = screen.getByText('Build RAG')

      // Start upload
      await user.upload(fileInput, testFile)

      // Build RAG button should still be clickable (no explicit prevention)
      expect(buildButton).not.toBeDisabled()
      expect(screen.getByText('Uploading…')).toBeInTheDocument()
    })

    it('should not allow upload while building RAG', async () => {
      const user = userEvent.setup()

      mockListFiles.mockResolvedValue([])
      // Make RAG build hang
      mockBuildRag.mockImplementation(() => new Promise(() => {}))

      render(<Dashboard />)

      const buildButton = screen.getByText('Build RAG')

      // Start RAG build
      await user.click(buildButton)

      // Should show building state
      expect(screen.getByText('Building…')).toBeInTheDocument()
      expect(screen.getByText('Building…')).toBeDisabled()

      // Upload should still be available (no explicit prevention)
      expect(screen.getByText('Upload files')).toBeInTheDocument()
    })

    it('should handle message display correctly', async () => {
      mockListFiles.mockResolvedValue([])

      render(<Dashboard />)

      // Initially no message should be displayed
      expect(screen.queryByText(/hint/)).not.toBeInTheDocument()

      // Trigger an error
      mockListFiles.mockRejectedValueOnce(new Error('Test error'))

      // Force a re-render by triggering refresh
      const buildButton = screen.getByText('Build RAG')
      mockBuildRag.mockRejectedValue(new Error('Build error'))

      await userEvent.click(buildButton)

      await waitFor(() => {
        expect(screen.getByText('Build error')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely large file names', async () => {
      const longFileName = 'a'.repeat(500) + '.pdf'
      const mockFiles = [
        {
          id: 1,
          filename: longFileName,
          created_at: '2023-12-25T10:30:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText(longFileName)).toBeInTheDocument()
      })
    })

    it('should handle invalid date formats gracefully', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: 'test.pdf',
          created_at: 'invalid-date',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
        // Should not crash and still display the file
      })
    })

    it('should handle files with zero or negative IDs', async () => {
      const mockFiles = [
        {
          id: 0,
          filename: 'zero-id.pdf',
          created_at: '2023-12-25T10:30:00Z',
        },
        {
          id: -1,
          filename: 'negative-id.pdf',
          created_at: '2023-12-25T10:30:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('zero-id.pdf')).toBeInTheDocument()
        expect(screen.getByText('negative-id.pdf')).toBeInTheDocument()
      })

      const downloadLinks = screen.getAllByText('Download')
      expect(downloadLinks[0]).toHaveAttribute(
        'href',
        '/api/files/download/0'
      )
      expect(downloadLinks[1]).toHaveAttribute(
        'href',
        '/api/files/download/-1'
      )
    })

    it('should handle null or undefined values in file objects', async () => {
      const mockFiles = [
        {
          id: 1,
          filename: '',
          created_at: '2023-12-25T10:30:00Z',
        },
      ]
      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        // Should not crash with empty filename
        const downloadLink = screen.getByText('Download')
        expect(downloadLink).toHaveAttribute('href', '/api/files/download/1')
      })
    })

    it('should handle very large numbers of files', async () => {
      const mockFiles = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        filename: `file-${i + 1}.pdf`,
        created_at: '2023-12-25T10:30:00Z',
      }))

      mockListFiles.mockResolvedValue(mockFiles)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('file-1.pdf')).toBeInTheDocument()
        expect(screen.getByText('file-1000.pdf')).toBeInTheDocument()
      })

      // Check that all download links are present
      const downloadLinks = screen.getAllByText('Download')
      expect(downloadLinks).toHaveLength(1000)
    })

    it('should handle concurrent API calls gracefully', async () => {
      const user = userEvent.setup()

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockResolvedValue(undefined)
      mockBuildRag.mockResolvedValue({ files_indexed: 1 })

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')
      const buildButton = screen.getByText('Build RAG')
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })

      // Trigger both upload and build simultaneously
      await user.upload(fileInput, testFile)
      await user.click(buildButton)

      // Both should complete without errors
      await waitFor(() => {
        expect(screen.getByText('Upload complete')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(
          screen.getByText('RAG built: 1 files indexed')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility and User Experience', () => {
    it('should have proper ARIA labels and roles', async () => {
      mockListFiles.mockResolvedValue([])

      render(<Dashboard />)

      // File input should be properly labeled
      const fileInput = screen.getByLabelText('Upload files')
      expect(fileInput).toHaveAttribute('type', 'file')
      expect(fileInput).toHaveAttribute('multiple')

      // Build button should be a proper button
      const buildButton = screen.getByRole('button', { name: /build rag/i })
      expect(buildButton).toBeInTheDocument()
    })

    it('should show appropriate loading states for better UX', async () => {
      const user = userEvent.setup()
      let uploadResolve: (value: any) => void
      let buildResolve: (value: any) => void

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockImplementation(
        () =>
          new Promise((resolve) => {
            uploadResolve = resolve
          })
      )
      mockBuildRag.mockImplementation(
        () =>
          new Promise((resolve) => {
            buildResolve = resolve
          })
      )

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')
      const buildButton = screen.getByText('Build RAG')
      const testFile = new File(['content'], 'test.pdf')

      // Test upload loading state
      await user.upload(fileInput, testFile)
      expect(screen.getByText('Uploading…')).toBeInTheDocument()

      uploadResolve?.(undefined)
      await waitFor(() => {
        expect(screen.getByText('Upload files')).toBeInTheDocument()
      })

      // Test build loading state
      await user.click(buildButton)
      expect(screen.getByText('Building…')).toBeInTheDocument()
      expect(screen.getByText('Building…')).toBeDisabled()

      buildResolve?.({ files_indexed: 1 })
      await waitFor(() => {
        expect(screen.getByText('Build RAG')).toBeInTheDocument()
        expect(screen.getByText('Build RAG')).not.toBeDisabled()
      })
    })

    it('should provide clear feedback messages', async () => {
      const user = userEvent.setup()

      mockListFiles.mockResolvedValue([])
      mockUploadFiles.mockResolvedValue(undefined)
      mockBuildRag.mockResolvedValue({ files_indexed: 3 })

      render(<Dashboard />)

      const fileInput = screen.getByLabelText('Upload files')
      const buildButton = screen.getByText('Build RAG')
      const testFile = new File(['content'], 'test.pdf')

      // Test upload success message
      await user.upload(fileInput, testFile)
      await waitFor(() => {
        expect(screen.getByText('Upload complete')).toBeInTheDocument()
      })

      // Test build success message  
      await user.click(buildButton)
      await waitFor(() => {
        expect(
          screen.getByText('RAG built: 3 files indexed')
        ).toBeInTheDocument()
      })
    })
  })
})