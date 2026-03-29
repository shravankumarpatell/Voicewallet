import pytest
import requests
import os

@pytest.fixture
def base_url():
    """Base URL from environment variable"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if not url:
        pytest.fail("EXPO_PUBLIC_BACKEND_URL environment variable not set")
    return url.rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_token():
    """Test session token from test credentials"""
    return "test_session_1774814917103"

@pytest.fixture
def test_user_id():
    """Test user ID from test credentials"""
    return "test-user-1774814917103"
