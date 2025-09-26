from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DocumentOut(BaseModel):
    id: int
    filename: str
    path: str
    created_at: datetime

    class Config:
        from_attributes = True


class AssessRequest(BaseModel):
    text: str


class AssessResponse(BaseModel):
    grade: float
    explanation: str
