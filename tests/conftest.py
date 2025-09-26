import pytest
from unittest.mock import Mock
from sqlalchemy.orm import Session
import secrets


@pytest.fixture
def mock_db_session():
    """Shared mock database session fixture."""
    return Mock(spec=Session)


@pytest.fixture
def sample_user_data():
    """Shared sample user data fixture."""
    from app.schemas import UserCreate
    password = secrets.token_urlsafe(16)
    return UserCreate(email="test@example.com", password=password)