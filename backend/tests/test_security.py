# Testing framework: pytest
# These tests validate the security utilities focusing on hashing and JWT handling.
# Frameworks/Libraries used: pytest, unittest.mock (patch), python-jose
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from jose import JWTError, jwt as jose_jwt

import sys
import os
# Ensure 'backend' (parent of tests) is on the path to import 'app.core.security'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    PASSWORD_CONTEXT,
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRE_MINUTES
)


class TestPasswordFunctions:
    def test_hash_password_basic(self):
        password = "test_password123"
        hashed = hash_password(password)
        assert hashed and isinstance(hashed, str) and hashed != password

    def test_hash_password_different_passwords_different_hashes(self):
        assert hash_password("password123") != hash_password("different_password456")

    def test_hash_password_same_password_different_hashes_due_to_salt(self):
        password = "same_password"
        assert hash_password(password) != hash_password(password)

    def test_hash_password_empty_string(self):
        hashed = hash_password("")
        assert hashed and isinstance(hashed, str)

    def test_hash_password_special_and_unicode_characters(self):
        for pwd in ("p@ssw0rd\\!#$%^&*()", "pássw0rd_ñoñó_测试"):
            assert hash_password(pwd)

    def test_hash_password_very_long(self):
        assert hash_password("a" * 1000)

    def test_verify_password_correct(self):
        pwd = "correct_password123"
        hashed = hash_password(pwd)
        assert verify_password(pwd, hashed) is True

    def test_verify_password_incorrect(self):
        pwd = "correct_password123"
        hashed = hash_password(pwd)
        assert verify_password("wrong_password456", hashed) is False

    def test_verify_password_empty_password(self):
        hashed = hash_password("some_pwd")
        assert verify_password("", hashed) is False

    def test_verify_password_empty_or_invalid_hash_raises(self):
        # Passlib CryptContext.verify typically raises for invalid format/hash

        with pytest.raises(Exception):
            verify_password("some_pwd", "")
        with pytest.raises(Exception):
            verify_password("some_pwd", "not_a_valid_hash_format")

    def test_verify_password_none_values_raise_typeerror(self):
        with pytest.raises(TypeError):
            verify_password(None, "some_hash")  # type: ignore[arg-type]
        with pytest.raises(TypeError):
            verify_password("password", None)  # type: ignore[arg-type]

    def test_password_context_has_hash_and_verify(self):
        assert PASSWORD_CONTEXT is not None
        assert callable(getattr(PASSWORD_CONTEXT, "hash", None))
        assert callable(getattr(PASSWORD_CONTEXT, "verify", None))


class TestJWTTokenFunctions:
    def test_create_access_token_default_expiration_and_decode(self):
        subject = "test_user"
        token = create_access_token(subject)
        assert token and isinstance(token, str)
        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["sub"] == subject
        assert "exp" in decoded
        assert isinstance(decoded["exp"], int)

    def test_create_access_token_custom_expiration(self):
        subject = "test_user"
        custom_minutes = 30
        token = create_access_token(subject, custom_minutes)
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == subject

    def test_create_access_token_zero_expiration(self):
        subject = "test_user"
        token = create_access_token(subject, 0)
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == subject

    def test_create_access_token_negative_expiration_creates_expired(self):
        subject = "test_user"
        token = create_access_token(subject, -60)  # expired
        assert decode_token(token) is None

    def test_create_access_token_empty_subject(self):
        token = create_access_token("")
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == ""

    def test_create_access_token_none_subject_raises(self):
        with pytest.raises(TypeError):
            create_access_token(None)  # type: ignore[arg-type]

    def test_create_access_token_special_characters_subject(self):
        subject = "user@example.com\\!#$%"
        token = create_access_token(subject)
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == subject

    def test_create_access_token_unicode_subject(self):
        subject = "üser_测试_ñoñó"
        token = create_access_token(subject)
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == subject

    def test_decode_token_valid(self):
        subject = "valid_user"
        token = create_access_token(subject)
        decoded = decode_token(token)
        assert isinstance(decoded, dict)
        assert decoded["sub"] == subject
        assert "exp" in decoded and isinstance(decoded["exp"], int)

    def test_decode_token_invalid_format(self):
        assert decode_token("not.a.valid.jwt.token") is None

    def test_decode_token_empty_string(self):
        assert decode_token("") is None

    def test_decode_token_none_raises_typeerror(self):
        with pytest.raises(TypeError):
            decode_token(None)  # type: ignore[arg-type]

    def test_decode_token_malformed_jwt_variants(self):
        for token in ["invalid", "still.invalid", "header.payload", "a.b.c.d"]:
            assert decode_token(token) is None

    def test_decode_token_wrong_secret(self):
        subject = "test_user"
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)
        payload = {"sub": subject, "exp": expire}
        wrong_secret = "wrong_secret_key"
        token = jose_jwt.encode(payload, wrong_secret, algorithm=JWT_ALGORITHM)
        assert decode_token(token) is None

    def test_decode_token_wrong_algorithm(self):
        subject = "test_user"
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)
        payload = {"sub": subject, "exp": expire}
        token = jose_jwt.encode(payload, JWT_SECRET, algorithm="HS512")
        assert decode_token(token) is None


class TestSecurityConstants:
    def test_jwt_secret_exists(self):
        assert isinstance(JWT_SECRET, str) and len(JWT_SECRET) > 0

    def test_jwt_algorithm_valid(self):
        assert JWT_ALGORITHM == "HS256"

    def test_jwt_expire_minutes_positive_and_reasonable(self):
        assert isinstance(JWT_EXPIRE_MINUTES, int) and JWT_EXPIRE_MINUTES > 0
        assert 5 <= JWT_EXPIRE_MINUTES <= 24 * 60


class TestTokenExpiration:
    def test_token_expiration_boundary_value_from_fixed_time(self):
        # Freeze creation time within create_access_token by patching datetime in module
        subject = "test_user"
        expire_minutes = 60
        fixed_time = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        with patch("app.core.security.datetime") as mock_dt:
            mock_dt.now.return_value = fixed_time
            token = create_access_token(subject, expire_minutes)
        decoded = decode_token(token)
        assert decoded is not None
        exp_dt = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        expected = fixed_time + timedelta(minutes=expire_minutes)
        assert abs((exp_dt - expected).total_seconds()) <= 1.0

    def test_token_creation_time_accuracy(self):
        before = datetime.now(timezone.utc)
        token = create_access_token("test_user", 60)
        after = datetime.now(timezone.utc)
        decoded = decode_token(token)
        assert decoded is not None
        exp_dt = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        assert (before + timedelta(minutes=59, seconds=30)) <= exp_dt <= (after + timedelta(minutes=60, seconds=30))


class TestErrorHandling:
    def test_hash_password_passlib_exception(self, monkeypatch):
        def _raise(*args, **kwargs):
            raise Exception("Passlib error")
        monkeypatch.setattr("app.core.security.PASSWORD_CONTEXT.hash", _raise)
        with pytest.raises(Exception):
            hash_password("test_password")

    def test_verify_password_passlib_exception(self, monkeypatch):
        def _raise(*args, **kwargs):
            raise Exception("Passlib error")
        monkeypatch.setattr("app.core.security.PASSWORD_CONTEXT.verify", _raise)
        with pytest.raises(Exception):
            verify_password("password", "hash")

    def test_create_access_token_jwt_exception(self, monkeypatch):
        def _raise(*args, **kwargs):
            raise Exception("JWT encoding error")
        monkeypatch.setattr("app.core.security.jwt.encode", _raise)
        with pytest.raises(Exception):
            create_access_token("test_user")

    def test_decode_token_jwt_error_handling(self, monkeypatch):
        def _raise(*args, **kwargs):
            raise JWTError("Invalid token")
        monkeypatch.setattr("app.core.security.jwt.decode", _raise)
        assert decode_token("some_token") is None

    def test_decode_token_general_exception_propagates(self, monkeypatch):
        def _raise(*args, **kwargs):
            raise Exception("Unexpected error")
        monkeypatch.setattr("app.core.security.jwt.decode", _raise)
        with pytest.raises(Exception):
            decode_token("some_token")


class TestIntegrationScenarios:
    def test_complete_password_workflow(self):
        original_password = "my_secure_password123\\!"
        hashed = hash_password(original_password)
        assert verify_password(original_password, hashed) is True
        assert verify_password("wrong_password", hashed) is False
        for _ in range(3):
            assert verify_password(original_password, hashed) is True

    def test_complete_token_workflow(self):
        subject = "user123@example.com"
        custom_expiration = 120  # 2 hours
        token = create_access_token(subject, custom_expiration)
        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["sub"] == subject
        assert "exp" in decoded
        exp_time = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = exp_time - now
        assert timedelta(minutes=119) <= diff <= timedelta(minutes=121)

    def test_multiple_users_get_unique_tokens(self):
        users = ["user1", "user2@example.com", "admin", "test_user_123"]
        tokens = [create_access_token(u) for u in users]
        for u, t in zip(users, tokens):
            d = decode_token(t)
            assert d is not None and d["sub"] == u
        assert len(set(tokens)) == len(tokens)

    def test_password_and_token_combined_flow(self):
        username = "john.doe@company.com"
        password = "SecureP@ssw0rd123\\!"
        password_hash = hash_password(password)
        assert verify_password(password, password_hash) is True
        token = create_access_token(username)
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == username
        assert verify_password("WrongPassword123\\!", password_hash) is False


class TestPerformance:
    def test_password_hashing_performance(self):
        import time
        start = time.time()
        hash_password("test_password_for_performance")
        duration = time.time() - start
        # Generous upper bound to avoid CI flakiness
        assert duration < 3.0

    def test_token_operations_performance(self):
        import time
        subject = "performance_test_user"
        start = time.time()
        token = create_access_token(subject)
        creation_time = time.time() - start

        start = time.time()
        decode_token(token)
        decoding_time = time.time() - start

        assert creation_time < 1.0
        assert decoding_time < 1.0


class TestParametrizedScenarios:
    @pytest.mark.parametrize("password", [
        "short",
        "a" * 100,
        "pássw0rd_ñ",
        "p@$$w0rd\\!@#$%^&*()",
        "MixedCasePassword123",
        "123456789",
        "password with spaces",
    ])
    def test_password_hashing_various_inputs(self, password):
        hashed = hash_password(password)
        assert hashed and isinstance(hashed, str)
        assert verify_password(password, hashed) is True

    @pytest.mark.parametrize("subject", [
        "simple_user",
        "user@example.com",
        "user.name+tag@domain.co.uk",
        "üser_测试",
        "123456",
        "user with spaces",
        "user@domain.com\\!special",
    ])
    def test_token_creation_various_subjects(self, subject):
        token = create_access_token(subject)
        decoded = decode_token(token)
        assert decoded is not None and decoded["sub"] == subject

    @pytest.mark.parametrize("expiration_minutes", [
        1, 15, 60, 120, 24 * 60, 7 * 24 * 60
    ])
    def test_token_expiration_various_durations(self, expiration_minutes):
        subject = "test_user"
        token = create_access_token(subject, expiration_minutes)
        decoded = decode_token(token)
        assert decoded is not None
        exp_time = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        expected = datetime.now(timezone.utc) + timedelta(minutes=expiration_minutes)
        # Allow 60s tolerance for execution overhead
        assert abs((exp_time - expected).total_seconds()) <= 60