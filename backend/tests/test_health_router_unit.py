# Testing library/framework: pytest
import sys
import types
import importlib
import threading
import pytest


@pytest.fixture
def health_module(monkeypatch):
    """
    Import backend.tests.test_health_router safely by stubbing external deps:
    - fastapi.APIRouter (for decorator only)
    - sqlalchemy.text (return passthrough string)
    - backend.core.db.engine (placeholder; will be patched per test)
    """
    # Stub fastapi with minimal APIRouter supporting @router.get decorator
    fastapi_stub = types.ModuleType("fastapi")

    class APIRouter:
        def __init__(self, *args, **kwargs):
            pass

        def get(self, _path):
            def decorator(fn):
                return fn
            return decorator

    fastapi_stub.APIRouter = APIRouter
    monkeypatch.setitem(sys.modules, "fastapi", fastapi_stub)

    # Stub sqlalchemy.text
    sqlalchemy_stub = types.ModuleType("sqlalchemy")

    def text(q):
        return q

    sqlalchemy_stub.text = text
    monkeypatch.setitem(sys.modules, "sqlalchemy", sqlalchemy_stub)

    # Ensure 'backend' pkg exists (namespace) and stub backend.core.db.engine
    backend_mod = sys.modules.get("backend")
    if backend_mod is None:
        backend_mod = types.ModuleType("backend")
        backend_mod.__path__ = ["backend"]
        monkeypatch.setitem(sys.modules, "backend", backend_mod)

    core_mod = sys.modules.get("backend.core")
    if core_mod is None:
        core_mod = types.ModuleType("backend.core")
        core_mod.__path__ = []
        monkeypatch.setitem(sys.modules, "backend.core", core_mod)

    db_mod = types.ModuleType("backend.core.db")

    class _DummyConn:
        def execute(self, _q):
            return None

    class _DummyCtx:
        def __enter__(self):
            return _DummyConn()

        def __exit__(self, exc_type, exc, tb):
            return False

    class DummyEngine:
        def connect(self):
            return _DummyCtx()

    db_mod.engine = DummyEngine()
    monkeypatch.setitem(sys.modules, "backend.core.db", db_mod)

    # Make sure requests/psutil are not preloaded so tests can control them
    sys.modules.pop("requests", None)
    sys.modules.pop("psutil", None)

    # Import the module under test
    mod = importlib.import_module("backend.tests.test_health_router")
    return mod


# Helpers to stub external dependencies

def install_requests(monkeypatch, *, status_code=204, exc=None, capture=None):
    """
    Install a stub 'requests' module.
    - If exc is provided, requests.get raises that exception.
    - capture: dict to record url and timeout
    """
    req = types.ModuleType("requests")

    class _Resp:
        def __init__(self, sc):
            self.status_code = sc

    if exc is None:
        def get(url, timeout):
            if capture is not None:
                capture["url"] = url
                capture["timeout"] = timeout
            return _Resp(status_code)
    else:
        def get(url, timeout):
            if capture is not None:
                capture["url"] = url
                capture["timeout"] = timeout
            raise exc

    req.get = get
    monkeypatch.setitem(sys.modules, "requests", req)
    return req


def install_psutil(monkeypatch, *, total_mb=8192.0, available_mb=4096.0, percent=50.0, exc=None):
    """
    Install a stub 'psutil' module.
    - If exc is provided, psutil.virtual_memory raises that exception.
    """
    p = types.ModuleType("psutil")

    if exc is None:
        class VM:
            def __init__(self, t_mb, a_mb, pct):
                self.total = int(t_mb * 1024 * 1024)
                self.available = int(a_mb * 1024 * 1024)
                self.percent = pct

        def virtual_memory():
            return VM(total_mb, available_mb, percent)
    else:
        def virtual_memory():
            raise exc

    p.virtual_memory = virtual_memory
    monkeypatch.setitem(sys.modules, "psutil", p)
    return p


# Engine stubs per scenario

class EngineSuccess:
    def connect(self):
        class Ctx:
            def __enter__(self):
                class Conn:
                    def execute(self, _q):
                        return None
                return Conn()

            def __exit__(self, a, b, c):
                return False
        return Ctx()


class EngineConnectFail:
    def __init__(self, exc):
        self.exc = exc

    def connect(self):
        raise self.exc


class EngineExecuteFail:
    def __init__(self, exc):
        self.exc = exc

    def connect(self):
        exc = self.exc

        class Ctx:
            def __enter__(self):
                class Conn:
                    def execute(self_inner, _q):
                        raise exc
                return Conn()

            def __exit__(self, a, b, c):
                return False
        return Ctx()


class EngineTrack:
    """Tracks the last query passed to execute."""
    def __init__(self):
        self.last_query = None

    def connect(self):
        outer = self

        class Ctx:
            def __enter__(self):
                class Conn:
                    def execute(self_inner, q):
                        outer.last_query = q
                        return None
                return Conn()

            def __exit__(self, a, b, c):
                return False
        return Ctx()


# Tests

def test_health_all_checks_ok(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["status"] == "ok"
    assert data["checks"]["database"]["ok"] is True
    assert data["checks"]["database"]["detail"] == "connected"
    assert data["checks"]["internet"]["ok"] is True
    assert data["checks"]["internet"]["detail"] == "status=204"
    assert data["checks"]["memory"]["ok"] is True
    assert data["checks"]["memory"]["detail"]["total_mb"] == 8192.0
    assert data["checks"]["memory"]["detail"]["available_mb"] == 4096.0
    assert data["checks"]["memory"]["detail"]["percent"] == 50.0


def test_health_database_connect_failure(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineConnectFail(Exception("Connection failed")), raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["database"]["ok"] is False
    assert "Connection failed" in data["checks"]["database"]["detail"]
    assert data["checks"]["internet"]["ok"] is True
    assert data["checks"]["memory"]["ok"] is True


def test_health_database_sql_execution_failure(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineExecuteFail(Exception("SQL execution failed")), raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["database"]["ok"] is False
    assert "SQL execution failed" in data["checks"]["database"]["detail"]


def test_health_internet_exception(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, exc=Exception("Connection timed out"))
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["database"]["ok"] is True
    assert data["checks"]["internet"]["ok"] is False
    assert "Connection timed out" in data["checks"]["internet"]["detail"]
    assert data["checks"]["memory"]["ok"] is True


def test_health_internet_bad_status(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=500)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["internet"]["ok"] is False
    assert data["checks"]["internet"]["detail"] == "status=500"


@pytest.mark.parametrize("status_code,expected_ok", [(200, True), (204, True), (404, False), (500, False)])
def test_health_internet_various_status_codes(health_module, monkeypatch, status_code, expected_ok):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=status_code)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["checks"]["internet"]["ok"] is expected_ok
    assert data["checks"]["internet"]["detail"] == f"status={status_code}"
    assert data["status"] == ("ok" if expected_ok else "degraded")


def test_health_memory_exception(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, exc=Exception("psutil error"))

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["memory"]["ok"] is False
    assert "psutil error" in data["checks"]["memory"]["detail"]


def test_health_low_memory_condition(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    # 50 MB available -> below 100MB threshold
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=50.0, percent=99.4)

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["memory"]["ok"] is False
    assert data["checks"]["memory"]["detail"]["available_mb"] == 50.0
    assert data["checks"]["memory"]["detail"]["percent"] == 99.4


def test_health_memory_exact_threshold(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    # Exactly 100 MB available -> still not ok (>100MB required)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=100.0, percent=98.8)

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["memory"]["ok"] is False
    assert data["checks"]["memory"]["detail"]["available_mb"] == 100.0


def test_health_memory_just_above_threshold(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    # 101 MB available -> ok
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=101.0, percent=98.7)

    data = health_module.health()
    assert data["status"] == "ok"
    assert data["checks"]["memory"]["ok"] is True
    assert data["checks"]["memory"]["detail"]["available_mb"] == 101.0


def test_health_memory_calculation_rounding(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    # 8GB/4GB exact in bytes to verify rounding to 1 decimal
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert data["status"] == "ok"
    assert data["checks"]["memory"]["detail"]["total_mb"] == 8192.0
    assert data["checks"]["memory"]["detail"]["available_mb"] == 4096.0
    assert data["checks"]["memory"]["detail"]["percent"] == 50.0


def test_health_response_structure(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    data = health_module.health()
    assert "status" in data and isinstance(data["status"], str)
    assert "checks" in data and isinstance(data["checks"], dict)
    for key in ("database", "internet", "memory"):
        assert key in data["checks"]
        assert "ok" in data["checks"][key]
        assert "detail" in data["checks"][key]


def test_health_requests_timeout_argument(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    capture = {}
    install_requests(monkeypatch, status_code=204, capture=capture)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    _ = health_module.health()
    assert capture.get("url") == "https://www.google.com/generate_204"
    assert capture.get("timeout") == 3


def test_health_executes_select_1(health_module, monkeypatch):
    tracker = EngineTrack()
    monkeypatch.setattr(health_module, "engine", tracker, raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    _ = health_module.health()
    # Our sqlalchemy.text stub returns the raw string query
    assert tracker.last_query == "SELECT 1"


def test_health_multiple_failures(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineConnectFail(Exception("DB error")), raising=True)
    install_requests(monkeypatch, exc=Exception("Network error"))
    install_psutil(monkeypatch, exc=Exception("psutil not available"))

    data = health_module.health()
    assert data["status"] == "degraded"
    assert data["checks"]["database"]["ok"] is False and "DB error" in data["checks"]["database"]["detail"]
    assert data["checks"]["internet"]["ok"] is False and "Network error" in data["checks"]["internet"]["detail"]
    assert data["checks"]["memory"]["ok"] is False and "psutil not available" in data["checks"]["memory"]["detail"]


def test_health_concurrent_calls(health_module, monkeypatch):
    monkeypatch.setattr(health_module, "engine", EngineSuccess(), raising=True)
    install_requests(monkeypatch, status_code=204)
    install_psutil(monkeypatch, total_mb=8192.0, available_mb=4096.0, percent=50.0)

    results = []

    def worker():
        data = health_module.health()
        results.append(data["status"])

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert all(status == "ok" for status in results)
    assert len(results) == 5