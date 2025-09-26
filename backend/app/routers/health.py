from fastapi import APIRouter
from sqlalchemy import text
from ..core.db import engine

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
