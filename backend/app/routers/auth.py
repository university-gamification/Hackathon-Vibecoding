from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..core.db import get_db
from ..core.security import create_access_token, hash_password, verify_password
from ..models import User
from ..schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account with the provided credentials.
    
    Parameters:
        user_in (UserCreate): Input data containing the user's email and plaintext password.
    
    Returns:
        User: The newly created and refreshed User ORM instance.
    
    Raises:
        HTTPException: Raised with status 400 if the email is already registered or if registration fails for any other reason.
    """
    try:
        existing = db.query(User).filter(User.email == user_in.email).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user = User(email=user_in.email, password_hash=hash_password(user_in.password))
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        # Defensive: unique constraint race
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    except Exception as e:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Registration failed: {e}")


@router.post("/login", response_model=Token)
def login(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Authenticate user credentials and return an access token.
    
    Parameters:
        user_in (UserCreate): User credentials containing `email` and `password`.
    
    Returns:
        Token: A Token object containing an `access_token` JWT whose subject is the authenticated user's email.
    
    Raises:
        HTTPException: With status 400 if credentials are incorrect or if authentication fails for any other reason.
    """
    try:
        user = db.query(User).filter(User.email == user_in.email).first()
        if not user or not verify_password(user_in.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")
        token = create_access_token(subject=user.email)
        return Token(access_token=token)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Login failed: {e}")
