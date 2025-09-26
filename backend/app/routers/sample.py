from fastapi import APIRouter

router = APIRouter()

@router.get("/echo")
def echo(msg: str = "Hello"):
    return {"reply": msg}
