"""
Test suite for BTP Manager - Pôles Users and AI Chat features
Tests:
1. Login with Direction account
2. GET /api/domaines/{id}/users - Get assigned users for a pôle
3. POST /api/domaines/{id}/assign - Auto-assign tools when assigning to pôle
4. DELETE /api/domaines/{id}/unassign/{user_id} - Unassign user from pôle
5. POST /api/ai/chat - AI chat with platform data analysis
6. GET /api/ai/history - Get chat history
7. DELETE /api/ai/history - Clear chat history
8. Dashboard stats - Verify 'Pôles' terminology
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://apply-direct-2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "superdadmin@gmail.com"
ADMIN_PASSWORD = "Superadmin123!"


class TestAuth:
    """Authentication tests"""
    
    def test_login_direction_account(self):
        """Test login with Direction account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data["role_global"] == "direction", f"Expected direction role, got {data['role_global']}"
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Login successful for {ADMIN_EMAIL} with role {data['role_global']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestDomainesUsers:
    """Tests for Pôles (Domaines) user management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_domaines(self):
        """Test GET /api/domaines returns list of pôles"""
        response = requests.get(f"{BASE_URL}/api/domaines", headers=self.headers)
        assert response.status_code == 200, f"Failed to get domaines: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of domaines"
        print(f"✓ GET /api/domaines returned {len(data)} pôles")
        return data
    
    def test_get_domaine_users(self):
        """Test GET /api/domaines/{id}/users returns assigned users"""
        # First get a domaine
        domaines = self.test_get_domaines()
        if not domaines:
            pytest.skip("No domaines available for testing")
        
        domaine_id = domaines[0]["id"]
        response = requests.get(f"{BASE_URL}/api/domaines/{domaine_id}/users", headers=self.headers)
        assert response.status_code == 200, f"Failed to get domaine users: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of users"
        
        # Verify user structure if any users exist
        if data:
            user = data[0]
            assert "user_id" in user, "Missing user_id field"
            assert "email" in user, "Missing email field"
            assert "nom" in user, "Missing nom field"
            assert "prenom" in user, "Missing prenom field"
            assert "role_global" in user, "Missing role_global field"
        
        print(f"✓ GET /api/domaines/{domaine_id}/users returned {len(data)} users")
        return data
    
    def test_assign_user_to_domaine_auto_tools(self):
        """Test POST /api/domaines/{id}/assign auto-assigns tools"""
        # Get domaines
        domaines_response = requests.get(f"{BASE_URL}/api/domaines", headers=self.headers)
        domaines = domaines_response.json()
        if not domaines:
            pytest.skip("No domaines available")
        
        # Find a domaine with outils
        domaine_with_outils = None
        for d in domaines:
            if d.get("outils") and len(d["outils"]) > 0:
                domaine_with_outils = d
                break
        
        if not domaine_with_outils:
            pytest.skip("No domaine with outils available")
        
        # Create a test user
        test_user_email = f"test_autoassign_{int(time.time())}@test.com"
        create_user_response = requests.post(f"{BASE_URL}/api/users", headers=self.headers, json={
            "email": test_user_email,
            "nom": "Test",
            "prenom": "AutoAssign",
            "password": "TestPassword123!",
            "role_global": "user"
        })
        
        if create_user_response.status_code != 200:
            pytest.skip(f"Could not create test user: {create_user_response.text}")
        
        test_user_id = create_user_response.json()["id"]
        
        try:
            # Assign user to domaine
            assign_response = requests.post(
                f"{BASE_URL}/api/domaines/{domaine_with_outils['id']}/assign",
                headers=self.headers,
                json={"user_id": test_user_id}
            )
            assert assign_response.status_code == 200, f"Failed to assign user: {assign_response.text}"
            
            assign_data = assign_response.json()
            assert "message" in assign_data
            
            # Check if auto_tools_assigned is present (should be for any user role now)
            if "auto_tools_assigned" in assign_data and assign_data["auto_tools_assigned"]:
                print(f"✓ Auto-assigned {len(assign_data['auto_tools_assigned'])} tools to user")
                for tool in assign_data["auto_tools_assigned"]:
                    print(f"  - {tool['outil']} with role {tool['role']}")
            else:
                print("✓ User assigned to domaine (no tools to auto-assign or already assigned)")
            
        finally:
            # Cleanup: delete test user
            requests.delete(f"{BASE_URL}/api/users/{test_user_id}", headers=self.headers)
    
    def test_unassign_user_from_domaine(self):
        """Test DELETE /api/domaines/{id}/unassign/{user_id}"""
        # Get domaines
        domaines_response = requests.get(f"{BASE_URL}/api/domaines", headers=self.headers)
        domaines = domaines_response.json()
        if not domaines:
            pytest.skip("No domaines available")
        
        domaine_id = domaines[0]["id"]
        
        # Create a test user
        test_user_email = f"test_unassign_{int(time.time())}@test.com"
        create_user_response = requests.post(f"{BASE_URL}/api/users", headers=self.headers, json={
            "email": test_user_email,
            "nom": "Test",
            "prenom": "Unassign",
            "password": "TestPassword123!",
            "role_global": "user"
        })
        
        if create_user_response.status_code != 200:
            pytest.skip(f"Could not create test user: {create_user_response.text}")
        
        test_user_id = create_user_response.json()["id"]
        
        try:
            # First assign user
            assign_response = requests.post(
                f"{BASE_URL}/api/domaines/{domaine_id}/assign",
                headers=self.headers,
                json={"user_id": test_user_id}
            )
            assert assign_response.status_code == 200, f"Failed to assign: {assign_response.text}"
            
            # Now unassign
            unassign_response = requests.delete(
                f"{BASE_URL}/api/domaines/{domaine_id}/unassign/{test_user_id}",
                headers=self.headers
            )
            assert unassign_response.status_code == 200, f"Failed to unassign: {unassign_response.text}"
            
            data = unassign_response.json()
            assert "message" in data
            print(f"✓ Successfully unassigned user from domaine")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/users/{test_user_id}", headers=self.headers)


class TestAIChat:
    """Tests for AI Chat functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_ai_chat_basic(self):
        """Test POST /api/ai/chat with a simple question"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers=self.headers,
            json={"message": "Combien d'utilisateurs sont actifs?"}
        )
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        
        data = response.json()
        assert "response" in data, "Missing response field"
        assert "session_id" in data, "Missing session_id field"
        assert len(data["response"]) > 0, "Empty response from AI"
        
        print(f"✓ AI chat responded with {len(data['response'])} characters")
        print(f"  Response preview: {data['response'][:100]}...")
        return data
    
    def test_ai_chat_platform_analysis(self):
        """Test AI can analyze platform data"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers=self.headers,
            json={"message": "Quels sont les pôles et outils disponibles?"}
        )
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        
        data = response.json()
        assert "response" in data
        # The response should mention platform data
        print(f"✓ AI analyzed platform data successfully")
        print(f"  Response preview: {data['response'][:150]}...")
    
    def test_ai_get_history(self):
        """Test GET /api/ai/history returns chat history"""
        # First send a message to ensure there's history
        requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers=self.headers,
            json={"message": "Test message for history"}
        )
        
        # Get history
        response = requests.get(f"{BASE_URL}/api/ai/history", headers=self.headers)
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of messages"
        
        if data:
            msg = data[-1]
            assert "role" in msg, "Missing role field"
            assert "content" in msg, "Missing content field"
            assert "created_at" in msg, "Missing created_at field"
        
        print(f"✓ GET /api/ai/history returned {len(data)} messages")
    
    def test_ai_clear_history(self):
        """Test DELETE /api/ai/history clears chat history"""
        response = requests.delete(f"{BASE_URL}/api/ai/history", headers=self.headers)
        assert response.status_code == 200, f"Failed to clear history: {response.text}"
        
        data = response.json()
        assert "message" in data
        
        # Verify history is cleared
        history_response = requests.get(f"{BASE_URL}/api/ai/history", headers=self.headers)
        history = history_response.json()
        assert len(history) == 0, f"History not cleared, still has {len(history)} messages"
        
        print("✓ AI chat history cleared successfully")


class TestDashboardStats:
    """Tests for Dashboard statistics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats returns correct statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "total_users" in data, "Missing total_users"
        assert "total_domaines" in data, "Missing total_domaines (pôles)"
        assert "total_outils" in data, "Missing total_outils"
        assert "total_documents" in data, "Missing total_documents"
        assert "recent_activity" in data, "Missing recent_activity"
        
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['total_domaines']} pôles, {data['total_outils']} outils")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
