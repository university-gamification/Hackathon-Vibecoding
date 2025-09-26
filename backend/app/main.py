from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import health, sample, auth
from .routers import files as files_router
from .routers import rag as rag_router
from .core.db import engine
from .models import Base

app = FastAPI(title="Hackathon-09-26 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # Create tables if not exist
    Base.metadata.create_all(bind=engine)

app.include_router(health.router, prefix="/api")
app.include_router(sample.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(files_router.router, prefix="/api")
app.include_router(rag_router.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Hackathon-09-26 backend"}
