from pathlib import Path
from typing import List

# NOTE: This is a stubbed RAG service with minimal logic to keep the
# architecture clean. You can swap implementations later with vector DBs
# like FAISS, Chroma, or managed services. The interface remains stable.

USERS_DATA = Path("backend/data/users")


def ensure_user_dir(user_id: int) -> Path:
    udir = USERS_DATA / str(user_id)
    udir.mkdir(parents=True, exist_ok=True)
    return udir


def list_user_files(user_id: int) -> List[Path]:
    udir = ensure_user_dir(user_id)
    return [p for p in udir.iterdir() if p.is_file()]


def build_rag_index(user_id: int) -> dict:
    # Placeholder: In a real system, read docs and index in vector DB
    files = [p.name for p in list_user_files(user_id)]
    # Save a simple manifest to simulate an index
    (ensure_user_dir(user_id) / "rag_manifest.txt").write_text("\n".join(files), encoding="utf-8")
    return {"files_indexed": len(files)}


def assess_text_against_rag(user_id: int, text: str) -> tuple[float, str]:
    # Placeholder grading heuristic: proportional to file count and text length
    files = list_user_files(user_id)
    base = min(10.0, max(1.0, (len(text.strip()) / 200.0) * 10))
    bonus = min(3.0, len(files) * 0.5)
    grade = max(1.0, min(10.0, base + bonus - 1.5))
    explanation = (
        f"Heuristic grade based on text length and {len(files)} uploaded files. "
        f"Replace with real similarity search against your vector index."
    )
    return grade, explanation
