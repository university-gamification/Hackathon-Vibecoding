from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_current_user
from ..core.db import get_db
from ..schemas import AssessRequest, AssessResponse
from ..services.rag_service import build_rag_index, assess_text_against_rag

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/build")
def build(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # db kept here for future use; currently not required by stub
    res = build_rag_index(current_user.id)
    return {"message": "RAG index built", **res}


@router.post("/assess", response_model=AssessResponse)
def assess(req: AssessRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    grade, explanation = assess_text_against_rag(current_user.id, req.text)
    return AssessResponse(grade=grade, explanation=explanation)
