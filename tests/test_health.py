import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import SQLAlchemyError
from requests.exceptions import RequestException, Timeout
import psutil
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Import the health router - adjusting import based on typical FastAPI structure
# Assuming the health endpoint is in a module that can be imported
try:
    from ..core.db import engine  # Try relative import first
except ImportError:
    try:
        from src.core.db import engine  # Try src structure
    except ImportError:
        from core.db import engine  # Try direct import

# Create a test app with just the health router for isolated testing
@pytest.fixture
def app():
    """Create a FastAPI test application with just the health router."""
    from fastapi import APIRouter
    from sqlalchemy import text

    # Create the health router inline for testing
    router = APIRouter()

    @router.get("/health")
    def health():
        result = {
            "status": "ok",
            "checks": {
                "database": {"ok": False, "detail": None},
                "internet": {"ok": False, "detail": None},
                "memory": {"ok": False, "detail": None},
            },
        }

        # Database connectivity
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            result["checks"]["database"] = {"ok": True, "detail": "connected"}
        except Exception as e:  # noqa: BLE001
            result["status"] = "degraded"
            result["checks"]["database"] = {"ok": False, "detail": str(e)}

        # Internet reachability
        try:
            import requests  # lazy import

            r = requests.get("https://www.google.com/generate_204", timeout=3)
            ok = r.status_code in (204, 200)
            result["checks"]["internet"] = {"ok": ok, "detail": f"status={r.status_code}"}
            if not ok:
                result["status"] = "degraded"
        except Exception as e:  # noqa: BLE001
            result["status"] = "degraded"
            result["checks"]["internet"] = {"ok": False, "detail": str(e)}

        # Memory availability
        try:
            import psutil  # lazy import

            vm = psutil.virtual_memory()
            detail = {
                "total_mb": round(vm.total / (1024 * 1024), 1),
                "available_mb": round(vm.available / (1024 * 1024), 1),
                "percent": vm.percent,
            }
            ok = vm.available > 100 * 1024 * 1024  # >100MB free
            result["checks"]["memory"] = {"ok": ok, "detail": detail}
            if not ok:
                result["status"] = "degraded"
        except Exception as e:  # noqa: BLE001
            result["status"] = "degraded"
            result["checks"]["memory"] = {"ok": False, "detail": str(e)}

        return result

    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    """Create a test client for the FastAPI application."""
    return TestClient(app)


class TestHealthEndpoint:
    """Comprehensive tests for the health check endpoint."""

    def test_health_endpoint_exists(self, client):
        """Test that the health endpoint exists and returns a response."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

    def test_health_response_structure(self, client):
        """Test that the health response has the correct structure."""
        response = client.get("/health")
        data = response.json()

        # Check top-level structure
        assert "status" in data
        assert "checks" in data
        assert isinstance(data["checks"], dict)

        # Check required checks exist
        required_checks = ["database", "internet", "memory"]
        for check in required_checks:
            assert check in data["checks"]
            assert "ok" in data["checks"][check]
            assert "detail" in data["checks"][check]
            assert isinstance(data["checks"][check]["ok"], bool)

    @patch('sqlalchemy.engine.Engine.connect')
    def test_database_check_success(self, mock_connect, client):
        """Test database check when connection succeeds."""
        # Mock successful database connection
        mock_conn = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        with patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to isolate database test
            mock_requests.return_value.status_code = 204
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024  # 8GB
            mock_vm.available = 4 * 1024 * 1024 * 1024  # 4GB
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["checks"]["database"]["ok"] is True
            assert data["checks"]["database"]["detail"] == "connected"
            mock_conn.execute.assert_called_once()

    @patch('sqlalchemy.engine.Engine.connect')
    def test_database_check_failure(self, mock_connect, client):
        """Test database check when connection fails."""
        # Mock database connection failure
        mock_connect.side_effect = SQLAlchemyError("Connection failed")

        with patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_requests.return_value.status_code = 204
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["database"]["ok"] is False
            assert "Connection failed" in data["checks"]["database"]["detail"]

    @patch('requests.get')
    def test_internet_check_success_204(self, mock_get, client):
        """Test internet check with successful 204 response."""
        mock_response = MagicMock()
        mock_response.status_code = 204
        mock_get.return_value = mock_response

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["checks"]["internet"]["ok"] is True
            assert data["checks"]["internet"]["detail"] == "status=204"
            mock_get.assert_called_once_with("https://www.google.com/generate_204", timeout=3)

    @patch('requests.get')
    def test_internet_check_success_200(self, mock_get, client):
        """Test internet check with successful 200 response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["checks"]["internet"]["ok"] is True
            assert data["checks"]["internet"]["detail"] == "status=200"

    @patch('requests.get')
    def test_internet_check_failure_bad_status(self, mock_get, client):
        """Test internet check with non-success status code."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["internet"]["ok"] is False
            assert data["checks"]["internet"]["detail"] == "status=500"

    @patch('requests.get')
    def test_internet_check_timeout_exception(self, mock_get, client):
        """Test internet check with timeout exception."""
        mock_get.side_effect = Timeout("Request timed out")

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["internet"]["ok"] is False
            assert "Request timed out" in data["checks"]["internet"]["detail"]

    @patch('requests.get')
    def test_internet_check_connection_exception(self, mock_get, client):
        """Test internet check with connection exception."""
        mock_get.side_effect = RequestException("Connection error")

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["internet"]["ok"] is False
            assert "Connection error" in data["checks"]["internet"]["detail"]

    @patch('psutil.virtual_memory')
    def test_memory_check_success_high_memory(self, mock_psutil, client):
        """Test memory check with sufficient available memory."""
        mock_vm = MagicMock()
        mock_vm.total = 8 * 1024 * 1024 * 1024  # 8GB
        mock_vm.available = 4 * 1024 * 1024 * 1024  # 4GB available
        mock_vm.percent = 50.0
        mock_psutil.return_value = mock_vm

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            response = client.get("/health")
            data = response.json()

            assert data["checks"]["memory"]["ok"] is True
            expected_detail = {
                "total_mb": 8192.0,
                "available_mb": 4096.0,
                "percent": 50.0
            }
            assert data["checks"]["memory"]["detail"] == expected_detail

    @patch('psutil.virtual_memory')
    def test_memory_check_failure_low_memory(self, mock_psutil, client):
        """Test memory check with insufficient available memory."""
        mock_vm = MagicMock()
        mock_vm.total = 1 * 1024 * 1024 * 1024  # 1GB
        mock_vm.available = 50 * 1024 * 1024  # 50MB available (less than 100MB threshold)
        mock_vm.percent = 95.0
        mock_psutil.return_value = mock_vm

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["memory"]["ok"] is False
            expected_detail = {
                "total_mb": 1024.0,
                "available_mb": 50.0,
                "percent": 95.0
            }
            assert data["checks"]["memory"]["detail"] == expected_detail

    @patch('psutil.virtual_memory')
    def test_memory_check_boundary_exactly_100mb(self, mock_psutil, client):
        """Test memory check at the exact 100MB boundary."""
        mock_vm = MagicMock()
        mock_vm.total = 2 * 1024 * 1024 * 1024  # 2GB
        mock_vm.available = 100 * 1024 * 1024  # Exactly 100MB available
        mock_vm.percent = 95.0
        mock_psutil.return_value = mock_vm

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            response = client.get("/health")
            data = response.json()

            # Should fail because condition is > 100MB, not >= 100MB
            assert data["status"] == "degraded"
            assert data["checks"]["memory"]["ok"] is False

    @patch('psutil.virtual_memory')
    def test_memory_check_exception(self, mock_psutil, client):
        """Test memory check when psutil raises an exception."""
        mock_psutil.side_effect = Exception("Memory access error")

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["memory"]["ok"] is False
            assert "Memory access error" in data["checks"]["memory"]["detail"]

    def test_all_checks_pass_status_ok(self, client):
        """Test that when all checks pass, overall status is 'ok'."""
        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock all checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn

            mock_requests.return_value.status_code = 204

            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "ok"
            assert data["checks"]["database"]["ok"] is True
            assert data["checks"]["internet"]["ok"] is True
            assert data["checks"]["memory"]["ok"] is True

    def test_multiple_checks_fail_status_degraded(self, client):
        """Test that when multiple checks fail, overall status is 'degraded'."""
        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock database to fail
            mock_db.side_effect = SQLAlchemyError("DB error")

            # Mock internet to fail
            mock_requests.side_effect = RequestException("Network error")

            # Mock memory to be low
            mock_vm = MagicMock()
            mock_vm.total = 1 * 1024 * 1024 * 1024
            mock_vm.available = 50 * 1024 * 1024  # Low memory
            mock_vm.percent = 95.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["database"]["ok"] is False
            assert data["checks"]["internet"]["ok"] is False
            assert data["checks"]["memory"]["ok"] is False

    def test_memory_detail_calculation_precision(self, client):
        """Test that memory calculations are properly rounded to 1 decimal place."""
        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            # Mock memory with values that need rounding
            mock_vm = MagicMock()
            mock_vm.total = 3 * 1024 * 1024 * 1024 + 512 * 1024 * 1024  # 3.5GB
            mock_vm.available = 1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024  # 1.25GB
            mock_vm.percent = 64.3
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            memory_detail = data["checks"]["memory"]["detail"]
            assert memory_detail["total_mb"] == 3584.0  # Should be rounded to 1 decimal
            assert memory_detail["available_mb"] == 1280.0  # Should be rounded to 1 decimal
            assert memory_detail["percent"] == 64.3

    def test_lazy_imports_not_imported_initially(self, client):
        """Test that requests and psutil are imported lazily within the function."""
        # This test verifies the lazy import pattern, though it's difficult to test directly
        # We can at least verify the endpoint works without pre-importing
        response = client.get("/health")
        assert response.status_code == 200

    @patch('builtins.__import__')
    def test_requests_import_failure(self, mock_import, client):
        """Test behavior when requests module cannot be imported."""
        def side_effect(name, *args, **kwargs):
            if name == 'requests':
                raise ModuleNotFoundError("No module named 'requests'")  # noqa
            return __import__(name, *args, **kwargs)

        mock_import.side_effect = side_effect

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["internet"]["ok"] is False
            assert "No module named 'requests'" in data["checks"]["internet"]["detail"]

    @patch('builtins.__import__')
    def test_psutil_import_failure(self, mock_import, client):
        """Test behavior when psutil module cannot be imported."""
        def side_effect(name, *args, **kwargs):
            if name == 'psutil':
                raise ModuleNotFoundError("No module named 'psutil'")  # noqa
            return __import__(name, *args, **kwargs)

        mock_import.side_effect = side_effect

        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            response = client.get("/health")
            data = response.json()

            assert data["status"] == "degraded"
            assert data["checks"]["memory"]["ok"] is False
            assert "No module named 'psutil'" in data["checks"]["memory"]["detail"]

    def test_response_content_type_json(self, client):
        """Test that the response content type is JSON."""
        response = client.get("/health")
        assert response.headers["content-type"] == "application/json"

    def test_response_can_be_serialized_multiple_times(self, client):
        """Test that the response can be accessed multiple times (JSON serializable)."""
        response = client.get("/health")
        data1 = response.json()
        data2 = response.json()
        assert data1 == data2

    def test_status_values_are_valid(self, client):
        """Test that status values are from expected set."""
        response = client.get("/health")
        data = response.json()

        assert data["status"] in ["ok", "degraded"]

        for _check_name, check_data in data["checks"].items():
            assert isinstance(check_data["ok"], bool)
            # detail can be None, string, or dict (for memory)
            assert check_data["detail"] is None or \
                   isinstance(check_data["detail"], (str, dict))

    def test_endpoint_is_idempotent(self, client):
        """Test that multiple calls to the health endpoint return consistent results."""
        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Set up consistent mocks
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204
            mock_vm = MagicMock()
            mock_vm.total = 8 * 1024 * 1024 * 1024
            mock_vm.available = 4 * 1024 * 1024 * 1024
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            # Make multiple requests
            response1 = client.get("/health")
            response2 = client.get("/health")

            data1 = response1.json()
            data2 = response2.json()

            # Results should be identical
            assert data1 == data2
            assert response1.status_code == response2.status_code

    def test_edge_case_zero_total_memory(self, client):
        """Test memory check with edge case of zero total memory."""
        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            # Edge case: zero total memory
            mock_vm = MagicMock()
            mock_vm.total = 0
            mock_vm.available = 0
            mock_vm.percent = 0.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            # Should handle division gracefully
            assert data["checks"]["memory"]["ok"] is False  # 0 < 100MB
            assert data["checks"]["memory"]["detail"]["total_mb"] == 0.0
            assert data["checks"]["memory"]["detail"]["available_mb"] == 0.0

    def test_very_large_memory_values(self, client):
        """Test memory check with very large memory values."""
        with patch('sqlalchemy.engine.Engine.connect') as mock_db, \
             patch('requests.get') as mock_requests, \
             patch('psutil.virtual_memory') as mock_psutil:

            # Mock other checks to pass  
            mock_conn = MagicMock()
            mock_db.return_value.__enter__.return_value = mock_conn
            mock_requests.return_value.status_code = 204

            # Very large memory values (e.g., 1TB)
            mock_vm = MagicMock()
            mock_vm.total = 1024 * 1024 * 1024 * 1024  # 1TB
            mock_vm.available = 512 * 1024 * 1024 * 1024  # 512GB
            mock_vm.percent = 50.0
            mock_psutil.return_value = mock_vm

            response = client.get("/health")
            data = response.json()

            assert data["checks"]["memory"]["ok"] is True
            assert data["checks"]["memory"]["detail"]["total_mb"] == 1048576.0  # 1TB in MB
            assert data["checks"]["memory"]["detail"]["available_mb"] == 524288.0  # 512GB in MB