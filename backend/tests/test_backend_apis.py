"""Backend API Tests for VoiceWallet

Tests:
- Auth endpoints (GET /api/auth/me with/without token)
- Transaction CRUD (POST, GET, PUT, DELETE /api/transactions)
- Dashboard (GET /api/dashboard)
- User income update (PUT /api/user/income)
- Chat endpoints (POST /api/chat, GET /api/chat/history)
"""
import pytest
import requests
import time

class TestAuth:
    """Authentication endpoint tests"""

    def test_auth_me_without_token_returns_401(self, base_url, api_client):
        """GET /api/auth/me without token should return 401"""
        response = api_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "authenticated" in data["detail"].lower() or "authorization" in data["detail"].lower()

    def test_auth_me_with_valid_token_returns_user(self, base_url, api_client, auth_token):
        """GET /api/auth/me with valid token should return user data"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        response = api_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 200
        
        user = response.json()
        assert "user_id" in user
        assert "email" in user
        assert "name" in user
        assert user["email"] == "test.user@example.com"
        assert user["user_id"] == "test-user-1774814917103"

class TestTransactions:
    """Transaction CRUD tests"""

    def test_create_transaction_and_verify(self, base_url, api_client, auth_token):
        """POST /api/transactions creates transaction and GET verifies persistence"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Create transaction
        create_payload = {
            "amount": 250.50,
            "category": "Food",
            "description": "TEST_Lunch at cafe",
            "date": "2024-03-15",
            "type": "expense"
        }
        create_response = api_client.post(f"{base_url}/api/transactions", json=create_payload)
        assert create_response.status_code == 200
        
        created_txn = create_response.json()
        assert "transaction_id" in created_txn
        assert created_txn["amount"] == create_payload["amount"]
        assert created_txn["category"] == create_payload["category"]
        assert created_txn["description"] == create_payload["description"]
        assert created_txn["date"] == create_payload["date"]
        assert created_txn["type"] == create_payload["type"]
        assert created_txn["user_id"] == "test-user-1774814917103"
        
        # Verify persistence by fetching transactions
        txn_id = created_txn["transaction_id"]
        get_response = api_client.get(f"{base_url}/api/transactions?month=03&year=2024")
        assert get_response.status_code == 200
        
        transactions = get_response.json()
        assert isinstance(transactions, list)
        found = any(t["transaction_id"] == txn_id for t in transactions)
        assert found, f"Created transaction {txn_id} not found in GET response"

    def test_get_transactions_for_month(self, base_url, api_client, auth_token):
        """GET /api/transactions returns transactions for specified month"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        response = api_client.get(f"{base_url}/api/transactions?month=03&year=2024")
        assert response.status_code == 200
        
        transactions = response.json()
        assert isinstance(transactions, list)
        # Verify all transactions are from March 2024
        for txn in transactions:
            assert "date" in txn
            assert txn["date"].startswith("2024-03")

    def test_update_transaction_and_verify(self, base_url, api_client, auth_token):
        """PUT /api/transactions/{tid} updates transaction and GET verifies changes"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # First create a transaction
        create_payload = {
            "amount": 100.0,
            "category": "Transport",
            "description": "TEST_Taxi ride",
            "date": "2024-03-20",
            "type": "expense"
        }
        create_response = api_client.post(f"{base_url}/api/transactions", json=create_payload)
        assert create_response.status_code == 200
        txn_id = create_response.json()["transaction_id"]
        
        # Update the transaction
        update_payload = {
            "amount": 150.0,
            "description": "TEST_Updated taxi ride"
        }
        update_response = api_client.put(f"{base_url}/api/transactions/{txn_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated_txn = update_response.json()
        assert updated_txn["amount"] == 150.0
        assert updated_txn["description"] == "TEST_Updated taxi ride"
        assert updated_txn["category"] == "Transport"  # Should remain unchanged
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/transactions?month=03&year=2024")
        transactions = get_response.json()
        found_txn = next((t for t in transactions if t["transaction_id"] == txn_id), None)
        assert found_txn is not None
        assert found_txn["amount"] == 150.0
        assert found_txn["description"] == "TEST_Updated taxi ride"

    def test_delete_transaction_and_verify(self, base_url, api_client, auth_token):
        """DELETE /api/transactions/{tid} deletes transaction and GET verifies removal"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Create a transaction to delete
        create_payload = {
            "amount": 50.0,
            "category": "Other",
            "description": "TEST_To be deleted",
            "date": "2024-03-25",
            "type": "expense"
        }
        create_response = api_client.post(f"{base_url}/api/transactions", json=create_payload)
        assert create_response.status_code == 200
        txn_id = create_response.json()["transaction_id"]
        
        # Delete the transaction
        delete_response = api_client.delete(f"{base_url}/api/transactions/{txn_id}")
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        
        # Verify it's gone
        get_response = api_client.get(f"{base_url}/api/transactions?month=03&year=2024")
        transactions = get_response.json()
        found = any(t["transaction_id"] == txn_id for t in transactions)
        assert not found, f"Deleted transaction {txn_id} still exists"

class TestDashboard:
    """Dashboard endpoint tests"""

    def test_dashboard_returns_correct_stats(self, base_url, api_client, auth_token):
        """GET /api/dashboard returns dashboard stats with correct totals"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        response = api_client.get(f"{base_url}/api/dashboard")
        assert response.status_code == 200
        
        dashboard = response.json()
        # Verify structure
        assert "monthly_income" in dashboard
        assert "total_income" in dashboard
        assert "total_expense" in dashboard
        assert "balance" in dashboard
        assert "category_breakdown" in dashboard
        assert "recent_transactions" in dashboard
        assert "transaction_count" in dashboard
        
        # Verify data types
        assert isinstance(dashboard["monthly_income"], (int, float))
        assert isinstance(dashboard["total_income"], (int, float))
        assert isinstance(dashboard["total_expense"], (int, float))
        assert isinstance(dashboard["balance"], (int, float))
        assert isinstance(dashboard["category_breakdown"], list)
        assert isinstance(dashboard["recent_transactions"], list)
        assert isinstance(dashboard["transaction_count"], int)
        
        # Verify balance calculation
        expected_balance = dashboard["monthly_income"] + dashboard["total_income"] - dashboard["total_expense"]
        assert abs(dashboard["balance"] - expected_balance) < 0.01, "Balance calculation incorrect"

class TestUserIncome:
    """User income update tests"""

    def test_update_monthly_income_and_verify(self, base_url, api_client, auth_token):
        """PUT /api/user/income updates monthly income and verifies persistence"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Update income
        new_income = 75000.0
        update_payload = {"monthly_income": new_income}
        update_response = api_client.put(f"{base_url}/api/user/income", json=update_payload)
        assert update_response.status_code == 200
        
        updated_user = update_response.json()
        assert "monthly_income" in updated_user
        assert updated_user["monthly_income"] == new_income
        
        # Verify persistence via /api/auth/me
        me_response = api_client.get(f"{base_url}/api/auth/me")
        assert me_response.status_code == 200
        user = me_response.json()
        assert user["monthly_income"] == new_income

class TestChat:
    """Chat/Jarvis endpoint tests"""

    def test_chat_returns_jarvis_response(self, base_url, api_client, auth_token):
        """POST /api/chat returns Jarvis AI response"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        chat_payload = {"message": "How much did I spend this month?"}
        response = api_client.post(f"{base_url}/api/chat", json=chat_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert "new_transactions" in data
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 0, "Jarvis response is empty"
        assert isinstance(data["new_transactions"], list)

    def test_chat_history_returns_messages(self, base_url, api_client, auth_token):
        """GET /api/chat/history returns chat history"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # First send a message to ensure history exists
        chat_payload = {"message": "TEST_Hello Jarvis"}
        api_client.post(f"{base_url}/api/chat", json=chat_payload)
        
        # Wait a moment for message to be saved
        time.sleep(0.5)
        
        # Get history
        response = api_client.get(f"{base_url}/api/chat/history")
        assert response.status_code == 200
        
        history = response.json()
        assert isinstance(history, list)
        # Verify message structure
        if len(history) > 0:
            msg = history[0]
            assert "role" in msg
            assert "content" in msg
            assert msg["role"] in ["user", "assistant"]
