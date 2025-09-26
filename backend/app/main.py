from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import health, sample

app = FastAPI(title="Hackathon-09-26 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(sample.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Hackathon-09-26 backend"}
