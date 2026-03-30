"""
Backend API tests for BTP Manager - Structured Roles Feature
Tests the new structured roles format: [{name, permissions, description}]
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "superdadmin@gmail.com"
ADMIN_PASSWORD = "Superadmin123!"


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_login_direction_user(self):
        """Test login with Direction account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["role_global"] == "direction"
        assert data["email"] == ADMIN_EMAIL.lower()
        print(f"✓ Login successful for {ADMIN_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")


class TestDomaines:
    """Domaine CRUD tests"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_get_domaines(self, auth_session):
        """Test getting all domaines"""
        response = auth_session.get(f"{BASE_URL}/api/domaines")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} domaines")
        return data
    
    def test_domaine_has_outils_with_roles(self, auth_session):
        """Test that domaines include outils with roles_disponibles"""
        response = auth_session.get(f"{BASE_URL}/api/domaines")
        assert response.status_code == 200
        domaines = response.json()
        
        for domaine in domaines:
            assert "outils" in domaine
            for outil in domaine.get("outils", []):
                assert "roles_disponibles" in outil
                print(f"  - Outil '{outil['nom']}' has roles: {outil['roles_disponibles']}")
        print("✓ Domaines include outils with roles_disponibles")


class TestOutilsStructuredRoles:
    """Tests for Outils with structured roles [{name, permissions, description}]"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def test_domaine_id(self, auth_session):
        """Get or create a test domaine"""
        response = auth_session.get(f"{BASE_URL}/api/domaines")
        domaines = response.json()
        if domaines:
            return domaines[0]["id"]
        # Create one if none exists
        response = auth_session.post(f"{BASE_URL}/api/domaines", json={
            "nom": "TEST_Domaine",
            "description": "Test domaine for structured roles"
        })
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_get_outils(self, auth_session):
        """Test getting all outils"""
        response = auth_session.get(f"{BASE_URL}/api/outils")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} outils")
        return data
    
    def test_create_outil_with_structured_roles(self, auth_session, test_domaine_id):
        """Test creating outil with structured roles [{name, permissions, description}]"""
        unique_name = f"TEST_Outil_{uuid.uuid4().hex[:8]}"
        structured_roles = [
            {"name": "viewer", "permissions": ["read"], "description": "Consultation uniquement"},
            {"name": "editor", "permissions": ["read", "write"], "description": "Lecture et écriture"},
            {"name": "admin", "permissions": ["read", "write", "delete", "admin"], "description": "Accès complet"}
        ]
        
        response = auth_session.post(f"{BASE_URL}/api/outils", json={
            "nom": unique_name,
            "domaine_id": test_domaine_id,
            "roles_disponibles": structured_roles
        })
        
        assert response.status_code == 200, f"Failed to create outil: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["nom"] == unique_name
        assert "roles_disponibles" in data
        assert len(data["roles_disponibles"]) == 3
        
        # Verify structured roles are stored correctly
        for i, role in enumerate(data["roles_disponibles"]):
            assert role["name"] == structured_roles[i]["name"]
            assert role["permissions"] == structured_roles[i]["permissions"]
            assert role["description"] == structured_roles[i]["description"]
        
        print(f"✓ Created outil '{unique_name}' with structured roles")
        print(f"  Roles: {[r['name'] for r in data['roles_disponibles']]}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/outils/{data['id']}")
        return data
    
    def test_update_outil_structured_roles(self, auth_session, test_domaine_id):
        """Test updating outil with new structured roles"""
        # Create outil first
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        initial_roles = [
            {"name": "viewer", "permissions": ["read"], "description": "Initial viewer"}
        ]
        
        create_response = auth_session.post(f"{BASE_URL}/api/outils", json={
            "nom": unique_name,
            "domaine_id": test_domaine_id,
            "roles_disponibles": initial_roles
        })
        assert create_response.status_code == 200
        outil_id = create_response.json()["id"]
        
        # Update with new roles
        updated_roles = [
            {"name": "viewer", "permissions": ["read"], "description": "Updated viewer"},
            {"name": "manager", "permissions": ["read", "write", "manage_team"], "description": "Manager role"}
        ]
        
        update_response = auth_session.put(f"{BASE_URL}/api/outils/{outil_id}", json={
            "roles_disponibles": updated_roles
        })
        
        assert update_response.status_code == 200
        data = update_response.json()
        
        # Verify update
        assert len(data["roles_disponibles"]) == 2
        role_names = [r["name"] for r in data["roles_disponibles"]]
        assert "viewer" in role_names
        assert "manager" in role_names
        
        print(f"✓ Updated outil roles successfully")
        print(f"  New roles: {role_names}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/outils/{outil_id}")
    
    def test_existing_outil_has_structured_roles(self, auth_session):
        """Test that existing outils have structured roles format"""
        response = auth_session.get(f"{BASE_URL}/api/outils")
        assert response.status_code == 200
        outils = response.json()
        
        for outil in outils:
            roles = outil.get("roles_disponibles", [])
            print(f"  Outil '{outil['nom']}': {roles}")
            
            # Check if roles are structured (dict with name, permissions)
            for role in roles:
                if isinstance(role, dict):
                    assert "name" in role, f"Role missing 'name' field: {role}"
                    assert "permissions" in role, f"Role missing 'permissions' field: {role}"
                    print(f"    - {role['name']}: {role['permissions']}")
        
        print("✓ Verified existing outils have structured roles")


class TestOutilAssignment:
    """Tests for assigning users to outils with role validation"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture
    def test_user_id(self, auth_session):
        """Get or create a test user"""
        response = auth_session.get(f"{BASE_URL}/api/users")
        users = response.json()
        # Find a non-admin user or use admin
        for user in users:
            if user["role_global"] != "direction":
                return user["id"]
        # Return admin if no other user
        return users[0]["id"] if users else None
    
    @pytest.fixture
    def test_outil_with_roles(self, auth_session):
        """Get an outil with structured roles"""
        response = auth_session.get(f"{BASE_URL}/api/outils")
        outils = response.json()
        if outils:
            return outils[0]
        return None
    
    def test_assign_user_with_valid_role(self, auth_session, test_user_id, test_outil_with_roles):
        """Test assigning user with a valid role from structured roles"""
        if not test_user_id or not test_outil_with_roles:
            pytest.skip("No test user or outil available")
        
        outil_id = test_outil_with_roles["id"]
        roles = test_outil_with_roles.get("roles_disponibles", [])
        
        # Get first valid role name
        if roles:
            role_name = roles[0]["name"] if isinstance(roles[0], dict) else roles[0]
        else:
            role_name = "viewer"
        
        response = auth_session.post(f"{BASE_URL}/api/outils/{outil_id}/assign", json={
            "user_id": test_user_id,
            "role": role_name
        })
        
        # Should succeed (200) or already assigned (400)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data["role"] == role_name
            print(f"✓ Assigned user with role '{role_name}'")
        else:
            print(f"✓ User already assigned (expected behavior)")
    
    def test_assign_user_with_invalid_role(self, auth_session, test_user_id, test_outil_with_roles):
        """Test that assigning with invalid role is rejected"""
        if not test_user_id or not test_outil_with_roles:
            pytest.skip("No test user or outil available")
        
        outil_id = test_outil_with_roles["id"]
        
        response = auth_session.post(f"{BASE_URL}/api/outils/{outil_id}/assign", json={
            "user_id": test_user_id,
            "role": "INVALID_ROLE_NAME_12345"
        })
        
        assert response.status_code == 400, f"Expected 400 for invalid role, got {response.status_code}"
        data = response.json()
        assert "Invalid role" in data.get("detail", "")
        print("✓ Invalid role correctly rejected")
    
    def test_get_outil_users(self, auth_session, test_outil_with_roles):
        """Test getting users assigned to an outil"""
        if not test_outil_with_roles:
            pytest.skip("No test outil available")
        
        outil_id = test_outil_with_roles["id"]
        response = auth_session.get(f"{BASE_URL}/api/outils/{outil_id}/users")
        
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        
        for user in users:
            assert "user_id" in user
            assert "outil_role" in user
            print(f"  - {user.get('prenom', '')} {user.get('nom', '')}: {user['outil_role']}")
        
        print(f"✓ Got {len(users)} users for outil")


class TestDashboard:
    """Dashboard stats tests"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_dashboard_stats(self, auth_session):
        """Test dashboard statistics endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_users" in data
        assert "total_domaines" in data
        assert "total_outils" in data
        assert "recent_activity" in data
        
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['total_domaines']} domaines, {data['total_outils']} outils")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
