"""
Pytest configuration & shared fixtures.
Testing framework: pytest
Adds backend/ to sys.path so tests can import app.core.security.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))