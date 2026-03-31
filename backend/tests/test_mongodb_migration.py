"""
BTP Manager - MongoDB Migration Tests
Tests all CRUD operations and features after PostgreSQL to MongoDB migration
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://btp-manager-9.preview.emergentagent.com')

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with Direction account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["email"] == "superdadmin@gmail.com"
        assert data["role_global"] == "direction"
        assert data["is_active"] == True
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestDashboard:
    """Dashboard stats tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    def test_dashboard_stats(self, auth_token):
        """Test dashboard stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_domaines" in data
        assert "total_outils" in data
        assert "total_documents" in data
        assert "recent_activity" in data
        assert isinstance(data["total_users"], int)
        assert isinstance(data["total_domaines"], int)
        assert isinstance(data["total_outils"], int)


class TestUsers:
    """User CRUD tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    def test_get_users(self, auth_token):
        """Test get all users"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "nom" in user
            assert "prenom" in user
            assert "role_global" in user
    
    def test_create_user(self, auth_token):
        """Test create new user"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "email": unique_email,
                "nom": "TestNom",
                "prenom": "TestPrenom",
                "password": "TestPass123!",
                "role_global": "user"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == unique_email.lower()  # Backend lowercases emails
        assert data["nom"] == "TestNom"
        assert data["prenom"] == "TestPrenom"
        assert data["role_global"] == "user"
        assert "id" in data
        
        # Cleanup - delete the test user
        user_id = data["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200


class TestDomaines:
    """Domaines (Pôles) CRUD tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    def test_get_domaines(self, auth_token):
        """Test get all domaines with outils"""
        response = requests.get(
            f"{BASE_URL}/api/domaines",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check if Production pole exists
        production_pole = next((d for d in data if d["nom"] == "Production"), None)
        if production_pole:
            assert "outils" in production_pole
            assert isinstance(production_pole["outils"], list)
    
    def test_create_domaine(self, auth_token):
        """Test create new domaine"""
        unique_name = f"TEST_Pole_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/domaines",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "nom": unique_name,
                "description": "Test pole description"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nom"] == unique_name
        assert data["description"] == "Test pole description"
        assert "id" in data
        
        # Cleanup - delete the test domaine
        domaine_id = data["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/domaines/{domaine_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
    
    def test_get_domaine_users(self, auth_token):
        """Test get users assigned to a domaine"""
        # First get domaines
        domaines_response = requests.get(
            f"{BASE_URL}/api/domaines",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        domaines = domaines_response.json()
        if len(domaines) > 0:
            domaine_id = domaines[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/domaines/{domaine_id}/users",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)


class TestOutils:
    """Outils CRUD tests with structured roles"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    @pytest.fixture
    def test_domaine(self, auth_token):
        """Create a test domaine for outil tests"""
        unique_name = f"TEST_Domaine_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/domaines",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"nom": unique_name, "description": "Test domaine for outils"}
        )
        domaine = response.json()
        yield domaine
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/domaines/{domaine['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_get_outils(self, auth_token):
        """Test get all outils"""
        response = requests.get(
            f"{BASE_URL}/api/outils",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            outil = data[0]
            assert "id" in outil
            assert "nom" in outil
            assert "domaine_id" in outil
            assert "roles_disponibles" in outil
    
    def test_create_outil_with_structured_roles(self, auth_token, test_domaine):
        """Test create outil with structured roles"""
        unique_name = f"TEST_Outil_{uuid.uuid4().hex[:8]}"
        structured_roles = [
            {"name": "viewer", "permissions": ["read"], "description": "Consultation uniquement"},
            {"name": "editor", "permissions": ["read", "write"], "description": "Lecture et écriture"}
        ]
        response = requests.post(
            f"{BASE_URL}/api/outils",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "nom": unique_name,
                "domaine_id": test_domaine["id"],
                "roles_disponibles": structured_roles
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nom"] == unique_name
        assert data["domaine_id"] == test_domaine["id"]
        assert len(data["roles_disponibles"]) == 2
        assert data["roles_disponibles"][0]["name"] == "viewer"
        assert "read" in data["roles_disponibles"][0]["permissions"]


class TestUserAssignment:
    """User assignment to domaines and outils tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    @pytest.fixture
    def test_user(self, auth_token):
        """Create a test user"""
        unique_email = f"TEST_assign_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "email": unique_email,
                "nom": "AssignTest",
                "prenom": "User",
                "password": "TestPass123!",
                "role_global": "user"
            }
        )
        user = response.json()
        yield user
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{user['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    @pytest.fixture
    def test_domaine_with_outil(self, auth_token):
        """Create a test domaine with an outil"""
        unique_name = f"TEST_AssignDomaine_{uuid.uuid4().hex[:8]}"
        domaine_response = requests.post(
            f"{BASE_URL}/api/domaines",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"nom": unique_name, "description": "Test domaine for assignment"}
        )
        domaine = domaine_response.json()
        
        # Create an outil in this domaine
        outil_response = requests.post(
            f"{BASE_URL}/api/outils",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "nom": f"TEST_Outil_{uuid.uuid4().hex[:8]}",
                "domaine_id": domaine["id"],
                "roles_disponibles": [
                    {"name": "viewer", "permissions": ["read"], "description": "View only"},
                    {"name": "conduc", "permissions": ["read", "write"], "description": "Conductor"}
                ]
            }
        )
        outil = outil_response.json()
        
        yield {"domaine": domaine, "outil": outil}
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/domaines/{domaine['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_assign_user_to_domaine_auto_assigns_tools(self, auth_token, test_user, test_domaine_with_outil):
        """Test that assigning user to domaine auto-assigns all tools"""
        domaine = test_domaine_with_outil["domaine"]
        
        response = requests.post(
            f"{BASE_URL}/api/domaines/{domaine['id']}/assign",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"user_id": test_user["id"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # Should have auto_tools_assigned if there are tools
        if test_domaine_with_outil["outil"]:
            assert "auto_tools_assigned" in data
    
    def test_unassign_user_from_domaine(self, auth_token, test_user, test_domaine_with_outil):
        """Test unassigning user from domaine"""
        domaine = test_domaine_with_outil["domaine"]
        
        # First assign
        requests.post(
            f"{BASE_URL}/api/domaines/{domaine['id']}/assign",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"user_id": test_user["id"]}
        )
        
        # Then unassign
        response = requests.delete(
            f"{BASE_URL}/api/domaines/{domaine['id']}/unassign/{test_user['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200


class TestAIChat:
    """AI Chat tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    def test_ai_chat_response(self, auth_token):
        """Test AI chat returns response"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"message": "Bonjour, combien d'utilisateurs sont actifs?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["response"]) > 0
    
    def test_ai_history(self, auth_token):
        """Test AI chat history"""
        response = requests.get(
            f"{BASE_URL}/api/ai/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_ai_clear_history(self, auth_token):
        """Test clearing AI chat history"""
        response = requests.delete(
            f"{BASE_URL}/api/ai/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200


class TestAuditLogs:
    """Audit logs tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    def test_get_audit_logs(self, auth_token):
        """Test get audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            log = data[0]
            assert "id" in log
            assert "action" in log
            assert "entity_type" in log
            assert "timestamp" in log


class TestAuthMe:
    """Auth /me endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        })
        return response.json().get("access_token")
    
    def test_get_me(self, auth_token):
        """Test get current user info"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "superdadmin@gmail.com"
        assert data["role_global"] == "direction"
        assert "domaines" in data
        assert "outils" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
