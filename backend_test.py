import requests
import sys
import json
from datetime import datetime

class BTPManagerAPITester:
    def __init__(self, base_url="https://btp-manager-9.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.created_user_id = None
        self.created_domaine_id = None
        self.created_outil_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, cookies=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(response_data) <= 5:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list) and len(response_data) <= 3:
                        print(f"   Response: {len(response_data)} items")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response text: {response.text[:200]}")

            return success, response.json() if response.content else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        self.run_test("Root endpoint", "GET", "", 200)
        self.run_test("Health endpoint", "GET", "health", 200)

    def test_auth_flow(self):
        """Test authentication flow"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test login with admin credentials
        login_data = {
            "email": "superdadmin@gmail.com",
            "password": "Superadmin123!"
        }
        success, response = self.run_test("Admin login", "POST", "auth/login", 200, login_data)
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            
            # Test get current user
            self.run_test("Get current user", "GET", "auth/me", 200)
            
            return True
        else:
            print("❌ Failed to get admin token, stopping auth tests")
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n=== DASHBOARD TESTS ===")
        success, response = self.run_test("Dashboard stats", "GET", "dashboard/stats", 200)
        
        if success:
            expected_keys = ['total_users', 'total_domaines', 'total_outils', 'total_documents']
            for key in expected_keys:
                if key in response:
                    print(f"   {key}: {response[key]}")
                else:
                    print(f"   Missing key: {key}")

    def test_users_management(self):
        """Test user management endpoints"""
        print("\n=== USER MANAGEMENT TESTS ===")
        
        # Get all users
        success, users = self.run_test("Get all users", "GET", "users", 200)
        if success:
            print(f"   Found {len(users)} users")
        
        # Create a new user
        new_user_data = {
            "email": f"testuser_{datetime.now().strftime('%H%M%S')}@test.com",
            "nom": "Test",
            "prenom": "User",
            "password": "TestPass123!",
            "role_global": "user"
        }
        
        success, response = self.run_test("Create new user", "POST", "users", 200, new_user_data)
        if success and 'id' in response:
            self.created_user_id = response['id']
            print(f"   Created user ID: {self.created_user_id}")
            
            # Update the user
            update_data = {"nom": "UpdatedTest"}
            self.run_test("Update user", "PUT", f"users/{self.created_user_id}", 200, update_data)

    def test_domaines_management(self):
        """Test domaine management endpoints"""
        print("\n=== DOMAINE MANAGEMENT TESTS ===")
        
        # Get all domaines
        success, domaines = self.run_test("Get all domaines", "GET", "domaines", 200)
        if success:
            print(f"   Found {len(domaines)} domaines")
            if domaines:
                print(f"   First domaine: {domaines[0].get('nom', 'Unknown')}")
        
        # Create a new domaine
        new_domaine_data = {
            "nom": f"TestDomaine_{datetime.now().strftime('%H%M%S')}",
            "description": "Test domaine created by automated test"
        }
        
        success, response = self.run_test("Create new domaine", "POST", "domaines", 200, new_domaine_data)
        if success and 'id' in response:
            self.created_domaine_id = response['id']
            print(f"   Created domaine ID: {self.created_domaine_id}")
            
            # Assign user to domaine if we have both
            if self.created_user_id:
                assign_data = {"user_id": self.created_user_id}
                self.run_test("Assign user to domaine", "POST", f"domaines/{self.created_domaine_id}/assign", 200, assign_data)

    def test_outils_management(self):
        """Test outil management endpoints"""
        print("\n=== OUTIL MANAGEMENT TESTS ===")
        
        # Get all outils
        success, outils = self.run_test("Get all outils", "GET", "outils", 200)
        if success:
            print(f"   Found {len(outils)} outils")
        
        # Create a new outil (need a domaine first)
        if self.created_domaine_id:
            new_outil_data = {
                "nom": f"TestOutil_{datetime.now().strftime('%H%M%S')}",
                "domaine_id": self.created_domaine_id,
                "roles_disponibles": ["conduc", "viewer", "chef_de_file"]
            }
            
            success, response = self.run_test("Create new outil", "POST", "outils", 200, new_outil_data)
            if success and 'id' in response:
                self.created_outil_id = response['id']
                print(f"   Created outil ID: {self.created_outil_id}")
                
                # Assign user to outil with role
                if self.created_user_id:
                    assign_data = {
                        "user_id": self.created_user_id,
                        "role": "viewer"
                    }
                    self.run_test("Assign user to outil", "POST", f"outils/{self.created_outil_id}/assign", 200, assign_data)
        else:
            print("   Skipping outil creation - no domaine available")

    def test_audit_logs(self):
        """Test audit logs endpoint"""
        print("\n=== AUDIT LOGS TESTS ===")
        success, logs = self.run_test("Get audit logs", "GET", "audit-logs?limit=10", 200)
        if success:
            print(f"   Found {len(logs)} audit logs")
            if logs:
                print(f"   Latest log action: {logs[0].get('action', 'Unknown')}")

    def test_logout(self):
        """Test logout"""
        print("\n=== LOGOUT TEST ===")
        self.run_test("Logout", "POST", "auth/logout", 200)

    def cleanup(self):
        """Clean up created resources"""
        print("\n=== CLEANUP ===")
        
        # Delete created outil
        if self.created_outil_id:
            self.run_test("Delete outil", "DELETE", f"outils/{self.created_outil_id}", 200)
        
        # Delete created domaine
        if self.created_domaine_id:
            self.run_test("Delete domaine", "DELETE", f"domaines/{self.created_domaine_id}", 200)
        
        # Delete created user
        if self.created_user_id:
            self.run_test("Delete user", "DELETE", f"users/{self.created_user_id}", 200)

def main():
    print("🚀 Starting BTP Manager API Tests")
    print("=" * 50)
    
    tester = BTPManagerAPITester()
    
    try:
        # Run all tests
        tester.test_health_check()
        
        if tester.test_auth_flow():
            tester.test_dashboard_stats()
            tester.test_users_management()
            tester.test_domaines_management()
            tester.test_outils_management()
            tester.test_audit_logs()
            tester.test_logout()
            tester.cleanup()
        else:
            print("❌ Authentication failed, skipping other tests")
            return 1
        
    except Exception as e:
        print(f"❌ Test suite failed with error: {str(e)}")
        return 1
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())