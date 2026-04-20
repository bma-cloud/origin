import requests
import sys
import json
from datetime import datetime

class NewFeaturesTester:
    def __init__(self, base_url="https://apply-direct-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.tokens = {}

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
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

    def test_user_credentials(self):
        """Test all three user credentials and get their profile data"""
        print("\n=== TESTING USER CREDENTIALS ===")
        
        users_to_test = [
            {"email": "superdadmin@gmail.com", "password": "Superadmin123!", "role": "direction"},
            {"email": "encadrant@test.com", "password": "Encadrant123!", "role": "encadrant"},
            {"email": "testuser@test.com", "password": "Test123!", "role": "user"}
        ]
        
        for user_info in users_to_test:
            print(f"\n--- Testing {user_info['role']} user ---")
            
            # Login
            login_data = {
                "email": user_info["email"],
                "password": user_info["password"]
            }
            success, response = self.run_test(f"Login as {user_info['role']}", "POST", "auth/login", 200, login_data)
            
            if success:
                # Get profile data
                success_profile, profile = self.run_test(f"Get {user_info['role']} profile", "GET", "auth/me", 200)
                
                if success_profile:
                    print(f"   Role: {profile.get('role_global')}")
                    print(f"   Domaines: {len(profile.get('domaines', []))}")
                    print(f"   Outils: {len(profile.get('outils', []))}")
                    
                    # Store profile for later use
                    self.tokens[user_info['role']] = {
                        'profile': profile,
                        'session': requests.Session()
                    }
                    
                    # Copy cookies to the role-specific session
                    self.tokens[user_info['role']]['session'].cookies.update(self.session.cookies)
                
                # Logout
                self.run_test(f"Logout {user_info['role']}", "POST", "auth/logout", 200)
            else:
                print(f"❌ Failed to login as {user_info['role']}")

    def test_outil_assigned_users(self):
        """Test viewing assigned users on outil pages"""
        print("\n=== TESTING OUTIL ASSIGNED USERS ===")
        
        # First login as Direction to get outils list
        login_data = {"email": "superdadmin@gmail.com", "password": "Superadmin123!"}
        success, response = self.run_test("Login as Direction for outil test", "POST", "auth/login", 200, login_data)
        
        if success:
            # Get all outils
            success_outils, outils = self.run_test("Get all outils", "GET", "outils", 200)
            
            if success_outils and outils:
                # Test getting users for first outil
                first_outil = outils[0]
                outil_id = first_outil['id']
                print(f"   Testing outil: {first_outil['nom']}")
                
                success_users, users = self.run_test(f"Get users for outil {first_outil['nom']}", "GET", f"outils/{outil_id}/users", 200)
                
                if success_users:
                    print(f"   Found {len(users)} assigned users")
                    for user in users:
                        print(f"     - {user.get('prenom')} {user.get('nom')} ({user.get('outil_role')})")
            
            # Logout
            self.run_test("Logout after outil test", "POST", "auth/logout", 200)

def main():
    print("🚀 Testing New BTP Manager Features")
    print("=" * 50)
    
    tester = NewFeaturesTester()
    
    try:
        # Test user credentials and profiles
        tester.test_user_credentials()
        
        # Test outil assigned users feature
        tester.test_outil_assigned_users()
        
    except Exception as e:
        print(f"❌ Test suite failed with error: {str(e)}")
        return 1
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())