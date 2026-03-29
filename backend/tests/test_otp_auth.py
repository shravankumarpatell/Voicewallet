"""OTP Authentication Tests for VoiceWallet

Tests for mobile OTP login feature (iteration 2):
- POST /api/auth/send-otp - sends mock OTP
- POST /api/auth/verify-otp - verifies OTP and creates user session
- POST /api/auth/verify-otp with wrong OTP - returns 401
"""
import pytest
import requests

class TestOTPAuth:
    """OTP authentication flow tests"""

    def test_send_otp_returns_mock_otp(self, base_url, api_client):
        """POST /api/auth/send-otp should return mock_otp in response"""
        mobile = "9876543210"
        payload = {"mobile": mobile}
        
        response = api_client.post(f"{base_url}/api/auth/send-otp", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "mock_otp" in data, "mock_otp field missing in response"
        assert isinstance(data["mock_otp"], str)
        assert len(data["mock_otp"]) == 6, f"OTP should be 6 digits, got {len(data['mock_otp'])}"
        assert data["mock_otp"].isdigit(), "OTP should contain only digits"
        print(f"✓ Mock OTP received: {data['mock_otp']}")

    def test_send_otp_with_invalid_mobile_returns_400(self, base_url, api_client):
        """POST /api/auth/send-otp with invalid mobile should return 400"""
        invalid_mobiles = ["", "123", "abc"]
        
        for mobile in invalid_mobiles:
            payload = {"mobile": mobile}
            response = api_client.post(f"{base_url}/api/auth/send-otp", json=payload)
            assert response.status_code == 400, f"Expected 400 for mobile '{mobile}', got {response.status_code}"
            data = response.json()
            assert "detail" in data
            print(f"✓ Invalid mobile '{mobile}' rejected with 400")

    def test_verify_otp_creates_user_and_returns_session(self, base_url, api_client):
        """POST /api/auth/verify-otp should create user and return session_token"""
        # First, send OTP to get the mock OTP
        mobile = "TEST_9998887776"
        send_response = api_client.post(f"{base_url}/api/auth/send-otp", json={"mobile": mobile})
        assert send_response.status_code == 200
        
        otp_data = send_response.json()
        mock_otp = otp_data["mock_otp"]
        print(f"✓ Received OTP: {mock_otp}")
        
        # Now verify the OTP
        verify_payload = {"mobile": mobile, "otp": mock_otp}
        verify_response = api_client.post(f"{base_url}/api/auth/verify-otp", json=verify_payload)
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        assert "session_token" in verify_data, "session_token missing in response"
        assert "user" in verify_data, "user object missing in response"
        
        # Verify user object structure
        user = verify_data["user"]
        assert "user_id" in user
        assert "mobile" in user
        assert "name" in user
        assert user["mobile"] == mobile
        assert user["name"] == f"User {mobile[-4:]}"
        
        # Verify session token works
        session_token = verify_data["session_token"]
        api_client.headers.update({"Authorization": f"Bearer {session_token}"})
        me_response = api_client.get(f"{base_url}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["user_id"] == user["user_id"]
        print(f"✓ User created and session token works: {user['user_id']}")

    def test_verify_otp_with_wrong_otp_returns_401(self, base_url, api_client):
        """POST /api/auth/verify-otp with wrong OTP should return 401"""
        # First, send OTP
        mobile = "9876543210"
        send_response = api_client.post(f"{base_url}/api/auth/send-otp", json={"mobile": mobile})
        assert send_response.status_code == 200
        
        # Try to verify with wrong OTP
        wrong_otp = "000000"
        verify_payload = {"mobile": mobile, "otp": wrong_otp}
        verify_response = api_client.post(f"{base_url}/api/auth/verify-otp", json=verify_payload)
        
        assert verify_response.status_code == 401, f"Expected 401 for wrong OTP, got {verify_response.status_code}"
        data = verify_response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "otp" in data["detail"].lower()
        print(f"✓ Wrong OTP rejected with 401: {data['detail']}")

    def test_verify_otp_without_mobile_returns_400(self, base_url, api_client):
        """POST /api/auth/verify-otp without mobile should return 400"""
        payload = {"otp": "123456"}
        response = api_client.post(f"{base_url}/api/auth/verify-otp", json=payload)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Missing mobile rejected with 400")

    def test_verify_otp_without_otp_returns_400(self, base_url, api_client):
        """POST /api/auth/verify-otp without OTP should return 400"""
        payload = {"mobile": "9876543210"}
        response = api_client.post(f"{base_url}/api/auth/verify-otp", json=payload)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Missing OTP rejected with 400")

    def test_otp_full_flow_end_to_end(self, base_url, api_client):
        """Complete OTP flow: send OTP → verify → access protected endpoint"""
        mobile = "TEST_1234567890"
        
        # Step 1: Send OTP
        send_response = api_client.post(f"{base_url}/api/auth/send-otp", json={"mobile": mobile})
        assert send_response.status_code == 200
        mock_otp = send_response.json()["mock_otp"]
        print(f"✓ Step 1: OTP sent - {mock_otp}")
        
        # Step 2: Verify OTP
        verify_response = api_client.post(f"{base_url}/api/auth/verify-otp", json={"mobile": mobile, "otp": mock_otp})
        assert verify_response.status_code == 200
        session_token = verify_response.json()["session_token"]
        user_id = verify_response.json()["user"]["user_id"]
        print(f"✓ Step 2: OTP verified - session token: {session_token[:20]}...")
        
        # Step 3: Access protected endpoint (dashboard)
        api_client.headers.update({"Authorization": f"Bearer {session_token}"})
        dashboard_response = api_client.get(f"{base_url}/api/dashboard")
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        assert "balance" in dashboard_data
        print(f"✓ Step 3: Dashboard accessed successfully")
        
        # Step 4: Verify user persistence
        me_response = api_client.get(f"{base_url}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["user_id"] == user_id
        assert me_data["mobile"] == mobile
        print(f"✓ Step 4: User persisted in database")
        
        print(f"✓ Complete OTP flow successful for user {user_id}")
