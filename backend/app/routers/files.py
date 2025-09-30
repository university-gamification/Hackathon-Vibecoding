from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..deps import get_current_user
from ..models import Document, User
from ..core.db import get_db
from ..services.rag_service import ensure_user_dir

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload")
def upload_files(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = []
    user_dir = ensure_user_dir(current_user.id)
    for uf in files:
        # Basic validation
        if not uf.filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        dest: Path = user_dir / uf.filename
        with dest.open("wb") as f:
            f.write(uf.file.read())
        doc = Document(user_id=current_user.id, filename=uf.filename, path=str(dest))
        db.add(doc)
        saved.append(uf.filename)
    db.commit()
    return {"saved": saved}


@router.get("/")
def list_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "path": d.path,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.get("/download/{doc_id}")
def download_file(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    path = Path(doc.path)
    # Ensure the file resides under the user's directory for safety
    user_dir = ensure_user_dir(current_user.id)
    try:
        path.resolve().relative_to(user_dir.resolve())
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=403, detail="Access denied")
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(path, filename=doc.filename)
