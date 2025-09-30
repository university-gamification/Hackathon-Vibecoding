import tempfile
import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy.orm import Session
import io

from backend.api.routers.files import router
from backend.models import Document, User
from fastapi import FastAPI

# Create a test FastAPI app with just the files router
app = FastAPI()
app.include_router(router)
client = TestClient(app)

@pytest.fixture
def mock_user():
    """Create a mock user for testing"""
    user = Mock(spec=User)
    user.id = 123
    user.username = "testuser"
    return user

@pytest.fixture
def mock_db():
    """Create a mock database session"""
    return Mock(spec=Session)

@pytest.fixture
def mock_document():
    """Create a mock document"""
    doc = Mock(spec=Document)
    doc.id = 1
    doc.filename = "test.txt"
    doc.path = str(Path(tempfile.gettempdir()) / "user_123" / "test.txt")
    doc.user_id = 123
    doc.created_at = "2023-01-01T00:00:00"
    return doc

@pytest.fixture
def temp_user_dir():
    """Create a temporary directory for testing file operations"""
    with tempfile.TemporaryDirectory() as temp_dir:
        user_dir = Path(temp_dir) / "user_123"
        user_dir.mkdir()
        yield user_dir

class TestUploadFiles:
    """Test cases for the upload_files endpoint"""
    
    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_single_file_success(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test successful upload of a single file"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create test file content
        file_content = b"Test file content"
        files = {"files": ("test.txt", io.BytesIO(file_content), "text/plain")}
        
        # Make request
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert "saved" in data
        assert "test.txt" in data["saved"]
        assert len(data["saved"]) == 1
        
        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        
        # Verify file was written
        written_file = temp_user_dir / "test.txt"
        assert written_file.exists()
        assert written_file.read_bytes() == file_content

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_multiple_files_success(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test successful upload of multiple files"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create test files
        files = [
            ("files", ("file1.txt", io.BytesIO(b"Content 1"), "text/plain")),
            ("files", ("file2.txt", io.BytesIO(b"Content 2"), "text/plain")),
            ("files", ("file3.pdf", io.BytesIO(b"PDF content"), "application/pdf"))
        ]
        
        # Make request
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert "saved" in data
        assert len(data["saved"]) == 3
        assert "file1.txt" in data["saved"]
        assert "file2.txt" in data["saved"]
        assert "file3.pdf" in data["saved"]
        
        # Verify database operations
        assert mock_db.add.call_count == 3
        mock_db.commit.assert_called_once()

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_file_invalid_filename(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test upload with invalid filename raises HTTPException"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create file with no filename
        files = {"files": (None, io.BytesIO(b"content"), "text/plain")}
        
        # Make request and expect error
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 400
        assert "Invalid filename" in response.json()["detail"]
        
        # Verify no database operations occurred
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_file_empty_filename(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test upload with empty filename raises HTTPException"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create file with empty filename
        files = {"files": ("", io.BytesIO(b"content"), "text/plain")}
        
        # Make request and expect error
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 400
        assert "Invalid filename" in response.json()["detail"]

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_file_special_characters_in_filename(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test upload with special characters in filename"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create file with special characters
        special_filename = "test file (1) & copy.txt"
        files = {"files": (special_filename, io.BytesIO(b"content"), "text/plain")}
        
        # Make request
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert special_filename in data["saved"]

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_large_file(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test upload of a large file"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create large file content (1MB)
        large_content = b"x" * (1024 * 1024)
        files = {"files": ("large_file.bin", io.BytesIO(large_content), "application/octet-stream")}
        
        # Make request
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 200
        
        # Verify file was written correctly
        written_file = temp_user_dir / "large_file.bin"
        assert written_file.exists()
        assert written_file.stat().st_size == len(large_content)

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_file_database_error(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test upload with database error during commit"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        mock_db.commit.side_effect = RuntimeError("Database error")
        
        # Create test file
        files = {"files": ("test.txt", io.BytesIO(b"content"), "text/plain")}
        
        # Make request and expect error
        with pytest.raises(RuntimeError):
            client.post("/files/upload", files=files)

class TestListFiles:
    """Test cases for the list_files endpoint"""
    
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_list_files_success(self, mock_get_db, mock_get_current_user, mock_user, mock_db):
        """Test successful listing of files"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        
        # Create mock documents
        base_user_dir = Path(tempfile.gettempdir()) / "user_123"

        doc1 = Mock(spec=Document)
        doc1.id = 1
        doc1.filename = "file1.txt"
        doc1.path = str(base_user_dir / "file1.txt")
        doc1.created_at.isoformat.return_value = "2023-01-01T00:00:00"
        
        doc2 = Mock(spec=Document)
        doc2.id = 2
        doc2.filename = "file2.pdf"
        doc2.path = str(base_user_dir / "file2.pdf")
        doc2.created_at.isoformat.return_value = "2023-01-02T00:00:00"
        
        # Setup query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_order_by = Mock()
        
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_order_by
        mock_order_by.all.return_value = [doc1, doc2]
        
        # Make request
        response = client.get("/files/")
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        # Check first document
        assert data[0]["id"] == 1
        assert data[0]["filename"] == "file1.txt"
        assert data[0]["path"] == str(base_user_dir / "file1.txt")
        assert data[0]["created_at"] == "2023-01-01T00:00:00"
        
        # Check second document
        assert data[1]["id"] == 2
        assert data[1]["filename"] == "file2.pdf"
        assert data[1]["path"] == str(base_user_dir / "file2.pdf")
        assert data[1]["created_at"] == "2023-01-02T00:00:00"

    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_list_files_empty(self, mock_get_db, mock_get_current_user, mock_user, mock_db):
        """Test listing files when user has no files"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        
        # Setup query chain to return empty list
        mock_query = Mock()
        mock_filter = Mock()
        mock_order_by = Mock()
        
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_order_by
        mock_order_by.all.return_value = []
        
        # Make request
        response = client.get("/files/")
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
        assert data == []

    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_list_files_single_file(self, mock_get_db, mock_get_current_user, mock_user, mock_db):
        """Test listing when user has exactly one file"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        
        # Create single mock document
        base_user_dir = Path(tempfile.gettempdir()) / "user_123"

        doc = Mock(spec=Document)
        doc.id = 42
        doc.filename = "single_file.docx"
        doc.path = str(base_user_dir / "single_file.docx")
        doc.created_at.isoformat.return_value = "2023-06-15T14:30:00"
        
        # Setup query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_order_by = Mock()
        
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_order_by
        mock_order_by.all.return_value = [doc]
        
        # Make request
        response = client.get("/files/")
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == 42
        assert data[0]["filename"] == "single_file.docx"

class TestDownloadFile:
    """Test cases for the download_file endpoint"""
    
    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_download_file_success(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test successful file download"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create test file
        test_file = temp_user_dir / "download_test.txt"
        test_content = "This is test content for download"
        test_file.write_text(test_content)
        
        # Create mock document
        doc = Mock(spec=Document)
        doc.id = 1
        doc.filename = "download_test.txt"
        doc.path = str(test_file)
        doc.user_id = 123
        
        # Setup query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = doc
        
        # Make request
        response = client.get("/files/download/1")
        
        # Assertions
        assert response.status_code == 200
        assert response.headers["content-disposition"] == 'attachment; filename="download_test.txt"'
        
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_download_file_not_found(self, mock_get_db, mock_get_current_user, mock_user, mock_db):
        """Test download when file document doesn't exist in database"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        
        # Setup query chain to return None
        mock_query = Mock()
        mock_filter = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = None
        
        # Make request
        response = client.get("/files/download/999")
        
        # Assertions
        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_download_file_missing_on_disk(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test download when file exists in database but not on disk"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create mock document pointing to non-existent file
        missing_file_path = temp_user_dir / "missing_file.txt"
        doc = Mock(spec=Document)
        doc.id = 1
        doc.filename = "missing_file.txt"
        doc.path = str(missing_file_path)
        doc.user_id = 123
        
        # Setup query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = doc
        
        # Make request
        response = client.get("/files/download/1")
        
        # Assertions
        assert response.status_code == 404
        assert "File missing on disk" in response.json()["detail"]

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_download_file_path_traversal_attack(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test download prevents path traversal attacks"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create mock document with malicious path outside user directory
        malicious_path = "/etc/passwd"  # Trying to access system file
        doc = Mock(spec=Document)
        doc.id = 1
        doc.filename = "passwd"
        doc.path = malicious_path
        doc.user_id = 123
        
        # Setup query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = doc
        
        # Make request
        response = client.get("/files/download/1")
        
        # Assertions
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_download_file_different_user(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test download when file belongs to different user"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user  # user_id = 123
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create mock document belonging to different user
        doc = Mock(spec=Document)
        doc.id = 1
        doc.filename = "other_user_file.txt"
        doc.path = str(Path(tempfile.gettempdir()) / "user_456" / "other_user_file.txt")
        doc.user_id = 456  # Different user ID
        
        # Setup query to simulate filter by user_id and doc_id
        mock_query = Mock()
        mock_filter = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = None  # Would not find document due to user filter
        
        # Make request
        response = client.get("/files/download/1")
        
        # Assertions
        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_download_file_with_unicode_filename(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test download with Unicode characters in filename"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create test file with Unicode name
        unicode_filename = "测试文件.txt"
        test_file = temp_user_dir / unicode_filename
        test_file.write_text("Unicode test content")
        
        # Create mock document
        doc = Mock(spec=Document)
        doc.id = 1
        doc.filename = unicode_filename
        doc.path = str(test_file)
        doc.user_id = 123
        
        # Setup query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = doc
        
        # Make request
        response = client.get("/files/download/1")
        
        # Assertions
        assert response.status_code == 200
        assert unicode_filename in response.headers["content-disposition"]

class TestFileRouterIntegration:
    """Integration tests for the complete file router workflow"""

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_list_download_workflow(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test complete workflow: upload -> list -> download"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir

        # Upload
        file_content = b"Integration test content"
        filename = "integration_test.txt"
        files = {"files": (filename, io.BytesIO(file_content), "text/plain")}
        upload_response = client.post("/files/upload", files=files)
        assert upload_response.status_code == 200
        assert filename in upload_response.json()["saved"]

        # Verify file exists on disk
        uploaded_file = temp_user_dir / filename
        assert uploaded_file.exists()
        assert uploaded_file.read_bytes() == file_content

        # Prepare a mock Document returned by list & download queries
        doc = Mock(spec=Document)
        doc.id = 99
        doc.filename = filename
        doc.path = str(uploaded_file)
        # created_at.isoformat used by the list endpoint
        doc.created_at = Mock()
        doc.created_at.isoformat.return_value = "2023-01-01T00:00:00"

        # Configure list query chain
        mock_query = Mock()
        mock_filter = Mock()
        mock_order_by = Mock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_order_by
        mock_order_by.all.return_value = [doc]

        # List
        list_response = client.get("/files/")
        assert list_response.status_code == 200
        data = list_response.json()
        assert any(item["filename"] == filename for item in data)

        # Configure download query chain
        mock_query2 = Mock()
        mock_filter2 = Mock()
        mock_db.query.return_value = mock_query2
        mock_query2.filter.return_value = mock_filter2
        mock_filter2.first.return_value = doc

        # Download
        dl_response = client.get("/files/download/99")
        assert dl_response.status_code == 200
        assert dl_response.content == file_content

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_overwrite_existing_file(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test uploading a file with the same name overwrites existing file"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        filename = "overwrite_test.txt"
        
        # Upload first file
        first_content = b"Original content"
        files = {"files": (filename, io.BytesIO(first_content), "text/plain")}
        response1 = client.post("/files/upload", files=files)
        assert response1.status_code == 200
        
        # Verify first file content
        test_file = temp_user_dir / filename
        assert test_file.read_bytes() == first_content
        
        # Upload second file with same name
        second_content = b"Updated content - should overwrite"
        files = {"files": (filename, io.BytesIO(second_content), "text/plain")}
        response2 = client.post("/files/upload", files=files)
        assert response2.status_code == 200
        
        # Verify file was overwritten
        assert test_file.read_bytes() == second_content

class TestErrorHandling:
    """Test error handling scenarios"""
    
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_unauthorized_access_upload(self, _mock_get_db, mock_get_current_user):
        """Test upload without authentication"""
        mock_get_current_user.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        
        files = {"files": ("test.txt", io.BytesIO(b"content"), "text/plain")}
        response = client.post("/files/upload", files=files)
        
        assert response.status_code == 401

    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_unauthorized_access_list(self, _mock_get_db, mock_get_current_user):
        """Test list files without authentication"""
        mock_get_current_user.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        
        response = client.get("/files/")
        
        assert response.status_code == 401

    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_unauthorized_access_download(self, _mock_get_db, mock_get_current_user):
        """Test download without authentication"""
        mock_get_current_user.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        
        response = client.get("/files/download/1")
        
        assert response.status_code == 401

class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_zero_byte_file(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test uploading an empty (0 bytes) file"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Create empty file
        files = {"files": ("empty.txt", io.BytesIO(b""), "text/plain")}
        
        # Make request
        response = client.post("/files/upload", files=files)
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert "empty.txt" in data["saved"]
        
        # Verify empty file was created
        empty_file = temp_user_dir / "empty.txt"
        assert empty_file.exists()
        assert empty_file.stat().st_size == 0

    @patch('backend.api.routers.files.ensure_user_dir')
    @patch('backend.api.routers.files.get_current_user')
    @patch('backend.api.routers.files.get_db')
    def test_upload_filename_with_path_separators(self, mock_get_db, mock_get_current_user, mock_ensure_user_dir, mock_user, mock_db, temp_user_dir):
        """Test uploading file with path separators in filename"""
        # Setup mocks
        mock_get_current_user.return_value = mock_user
        mock_get_db.return_value = mock_db
        mock_ensure_user_dir.return_value = temp_user_dir
        
        # Filename with path separators (potential security risk)
        malicious_filename = "../../malicious.txt"
        files = {"files": (malicious_filename, io.BytesIO(b"content"), "text/plain")}
        
        # Make request
        response = client.post("/files/upload", files=files)
        
        # Should succeed but sanitize filename
        assert response.status_code == 200
        # File should be created with the provided filename (current implementation doesn't sanitize)
        # In a production system, you might want to add filename sanitization
        
    def test_download_invalid_doc_id_types(self):
        """Test download with invalid document ID types"""
        # Test with string that's not a number
        response = client.get("/files/download/not_a_number")
        assert response.status_code == 422  # FastAPI validation error
        
        # Test with negative number
        with patch('backend.api.routers.files.get_current_user') as mock_get_current_user, \
             patch('backend.api.routers.files.get_db') as mock_get_db:
            mock_user = Mock()
            mock_user.id = 123
            mock_get_current_user.return_value = mock_user
            mock_db = Mock()
            mock_get_db.return_value = mock_db
            
            # Setup query to return None for negative ID
            mock_query = Mock()
            mock_filter = Mock()
            mock_db.query.return_value = mock_query
            mock_query.filter.return_value = mock_filter
            mock_filter.first.return_value = None
            
            response = client.get("/files/download/-1")
            assert response.status_code == 404

if __name__ == "__main__":
    pytest.main([__file__])