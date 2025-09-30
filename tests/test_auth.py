# ruff: noqa

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# Import the router and functions to test
from app.routers.auth import router, register, login
from app.models import User
from app.schemas import UserCreate, UserOut, Token


class TestAuthRegister:
    """Test cases for user registration endpoint."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock(spec=Session)
    
    @pytest.fixture
    def user_data(self):
        """Sample user registration data."""
        return UserCreate(email="test@example.com", password="password123")
    
    @pytest.fixture
    def existing_user(self):
        """Mock existing user in database."""
        user = Mock(spec=User)
        user.id = 1
        user.email = "test@example.com"
        user.password_hash = "hashed_password"
        return user

    @patch('app.routers.auth.hash_password')
    def test_register_success(self, mock_hash_password, mock_db, user_data):
        """Test successful user registration."""
        # Arrange
        mock_hash_password.return_value = "hashed_password123"
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        created_user = Mock(spec=User)
        created_user.id = 1
        created_user.email = user_data.email
        created_user.password_hash = "hashed_password123"
        
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        # Act
        with patch('app.routers.auth.User', return_value=created_user):
            result = register(user_data, mock_db)
        
        # Assert
        assert result == created_user
        mock_hash_password.assert_called_once_with(user_data.password)
        mock_db.query.assert_called_once_with(User)
        mock_db.add.assert_called_once_with(created_user)
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(created_user)

    def test_register_email_already_exists(self, mock_db, user_data, existing_user):
        """Test registration with already existing email."""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = existing_user
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            register(user_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert exc_info.value.detail == "Email already registered"
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

    @patch('app.routers.auth.hash_password')
    def test_register_integrity_error_race_condition(self, mock_hash_password, mock_db, user_data):
        """Test registration handles IntegrityError from race condition."""
        # Arrange
        mock_hash_password.return_value = "hashed_password123"
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.commit.side_effect = IntegrityError("statement", "params", "orig")
        
        created_user = Mock(spec=User)
        
        # Act & Assert
        with patch('app.routers.auth.User', return_value=created_user):
            with pytest.raises(HTTPException) as exc_info:
                register(user_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert exc_info.value.detail == "Email already registered"
        mock_db.rollback.assert_called_once()

    @patch('app.routers.auth.hash_password')
    def test_register_generic_exception(self, mock_hash_password, mock_db, user_data):
        """Test registration handles generic exceptions."""
        # Arrange
        mock_hash_password.return_value = "hashed_password123"
        mock_db.query.return_value.filter.return_value.first.return_value = None
        error_message = "Database connection failed"
        mock_db.commit.side_effect = Exception(error_message)
        
        created_user = Mock(spec=User)
        
        # Act & Assert
        with patch('app.routers.auth.User', return_value=created_user):
            with pytest.raises(HTTPException) as exc_info:
                register(user_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert f"Registration failed: {error_message}" in exc_info.value.detail
        mock_db.rollback.assert_called_once()

    def test_register_empty_email(self, mock_db):
        """Test registration with empty email."""
        # Arrange
        invalid_user_data = UserCreate(email="", password="password123")
        
        # This would typically be caught by pydantic validation,
        # but we test the endpoint behavior
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act & Assert - behavior may vary based on validation setup
        with patch('app.routers.auth.hash_password') as mock_hash:
            mock_hash.return_value = "hashed"
            with patch('app.routers.auth.User') as mock_user_class:
                mock_user = Mock(spec=User)
                mock_user_class.return_value = mock_user
                
                result = register(invalid_user_data, mock_db)
                assert result == mock_user

    def test_register_empty_password(self, mock_db):
        """Test registration with empty password."""
        # Arrange
        invalid_user_data = UserCreate(email="test@example.com", password="")
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act & Assert
        with patch('app.routers.auth.hash_password') as mock_hash:
            mock_hash.return_value = "hashed_empty"
            with patch('app.routers.auth.User') as mock_user_class:
                mock_user = Mock(spec=User)
                mock_user_class.return_value = mock_user
                
                register(invalid_user_data, mock_db)
                mock_hash.assert_called_once_with("")


class TestAuthLogin:
    """Test cases for user login endpoint."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock(spec=Session)
    
    @pytest.fixture
    def login_data(self):
        """Sample login data."""
        return UserCreate(email="test@example.com", password="password123")
    
    @pytest.fixture
    def valid_user(self):
        """Mock valid user from database."""
        user = Mock(spec=User)
        user.id = 1
        user.email = "test@example.com"
        user.password_hash = "hashed_password123"
        return user

    @patch('app.routers.auth.create_access_token')
    @patch('app.routers.auth.verify_password')
    def test_login_success(self, mock_verify_password, mock_create_token, mock_db, login_data, valid_user):
        """Test successful user login."""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = valid_user
        mock_verify_password.return_value = True
        mock_create_token.return_value = "access_token_123"
        
        # Act
        result = login(login_data, mock_db)
        
        # Assert
        assert isinstance(result, Token)
        assert result.access_token == "access_token_123"
        mock_verify_password.assert_called_once_with(login_data.password, valid_user.password_hash)
        mock_create_token.assert_called_once_with(subject=valid_user.email)

    def test_login_user_not_found(self, mock_db, login_data):
        """Test login with non-existent user."""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            login(login_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert exc_info.value.detail == "Incorrect email or password"

    @patch('app.routers.auth.verify_password')
    def test_login_invalid_password(self, mock_verify_password, mock_db, login_data, valid_user):
        """Test login with incorrect password."""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = valid_user
        mock_verify_password.return_value = False
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            login(login_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert exc_info.value.detail == "Incorrect email or password"
        mock_verify_password.assert_called_once_with(login_data.password, valid_user.password_hash)

    @patch('app.routers.auth.verify_password')
    def test_login_generic_exception(self, mock_verify_password, mock_db, login_data, valid_user):
        """Test login handles generic exceptions."""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = valid_user
        error_message = "Database error"
        mock_verify_password.side_effect = Exception(error_message)
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            login(login_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert f"Login failed: {error_message}" in exc_info.value.detail

    @patch('app.routers.auth.create_access_token')
    @patch('app.routers.auth.verify_password')
    def test_login_token_creation_failure(self, mock_verify_password, mock_create_token, mock_db, login_data, valid_user):
        """Test login handles token creation failure."""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = valid_user
        mock_verify_password.return_value = True
        mock_create_token.side_effect = Exception("Token creation failed")
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            login(login_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Login failed: Token creation failed" in exc_info.value.detail

    def test_login_empty_email(self, mock_db):
        """Test login with empty email."""
        # Arrange
        invalid_login_data = UserCreate(email="", password="password123")
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            login(invalid_login_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert exc_info.value.detail == "Incorrect email or password"

    def test_login_empty_password(self, mock_db, valid_user):
        """Test login with empty password."""
        # Arrange
        invalid_login_data = UserCreate(email="test@example.com", password="")
        mock_db.query.return_value.filter.return_value.first.return_value = valid_user
        
        with patch('app.routers.auth.verify_password') as mock_verify:
            mock_verify.return_value = False
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                login(invalid_login_data, mock_db)
            
            assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
            assert exc_info.value.detail == "Incorrect email or password"
            mock_verify.assert_called_once_with("", valid_user.password_hash)

    def test_login_database_query_exception(self, mock_db, login_data):
        """Test login handles database query exceptions."""
        # Arrange
        mock_db.query.side_effect = Exception("Database connection lost")
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            login(login_data, mock_db)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Login failed: Database connection lost" in exc_info.value.detail


class TestAuthRouterConfiguration:
    """Test cases for router configuration."""
    
    def test_router_prefix_and_tags(self):
        """Test router is configured with correct prefix and tags."""
        assert router.prefix == "/auth"
        assert "auth" in router.tags

    def test_router_endpoints_exist(self):
        """Test that expected endpoints are registered."""
        routes = [route.path for route in router.routes]
        assert "/register" in routes
        assert "/login" in routes

    def test_register_endpoint_methods(self):
        """Test register endpoint accepts correct HTTP methods."""
        register_route = next(route for route in router.routes if route.path == "/register")
        assert "POST" in register_route.methods

    def test_login_endpoint_methods(self):
        """Test login endpoint accepts correct HTTP methods."""
        login_route = next(route for route in router.routes if route.path == "/login")
        assert "POST" in login_route.methods


class TestAuthEdgeCases:
    """Test edge cases and boundary conditions."""
    
    @pytest.fixture
    def mock_db(self):
        return Mock(spec=Session)

    def test_register_very_long_email(self, mock_db):
        """Test registration with extremely long email."""
        long_email = "a" * 500 + "@example.com"
        user_data = UserCreate(email=long_email, password="password123")
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with patch('app.routers.auth.hash_password') as mock_hash:
            mock_hash.return_value = "hashed"
            with patch('app.routers.auth.User') as mock_user_class:
                mock_user = Mock(spec=User)
                mock_user_class.return_value = mock_user
                
                result = register(user_data, mock_db)
                assert result == mock_user

    def test_register_special_characters_in_email(self, mock_db):
        """Test registration with special characters in email."""
        special_email = "test+tag@sub.domain.example.com"
        user_data = UserCreate(email=special_email, password="password123")
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with patch('app.routers.auth.hash_password') as mock_hash:
            mock_hash.return_value = "hashed"
            with patch('app.routers.auth.User') as mock_user_class:
                mock_user = Mock(spec=User)
                mock_user_class.return_value = mock_user
                
                result = register(user_data, mock_db)
                assert result == mock_user

    def test_register_unicode_characters(self, mock_db):
        """Test registration with unicode characters in password."""
        user_data = UserCreate(email="test@example.com", password="пароль123")
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with patch('app.routers.auth.hash_password') as mock_hash:
            mock_hash.return_value = "hashed_unicode"
            with patch('app.routers.auth.User') as mock_user_class:
                mock_user = Mock(spec=User)
                mock_user_class.return_value = mock_user
                
                register(user_data, mock_db)
                mock_hash.assert_called_once_with("пароль123")

    @patch('app.routers.auth.verify_password')
    def test_login_case_sensitivity(self, mock_verify_password, mock_db):
        """Test login email case sensitivity."""
        login_data = UserCreate(email="Test@Example.COM", password="password123")
        
        user = Mock(spec=User)
        user.email = "test@example.com"
        user.password_hash = "hashed"
        
        mock_db.query.return_value.filter.return_value.first.return_value = user
        mock_verify_password.return_value = True
        
        with patch('app.routers.auth.create_access_token') as mock_token:
            mock_token.return_value = "token"
            result = login(login_data, mock_db)
            assert result.access_token == "token"

if __name__ == "__main__":
    pytest.main([__file__])