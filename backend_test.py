#!/usr/bin/env python3
"""
FlowChantier Backend API Testing Suite
Tests all FlowChantier endpoints with authentication
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://apply-direct-2.preview.emergentagent.com/api"
TEST_EMAIL = "superdadmin@gmail.com"
TEST_PASSWORD = "Superadmin123!"

class FlowChantierTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.test_chantier_id = None
        self.test_conducteur_id = None
        self.prod_pole_id = None
        self.fiche_de_file_tool_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_authentication(self):
        """Test login and get access token"""
        self.log("Testing authentication...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.log(f"✅ Authentication successful - Token: {self.access_token[:20]}...")
                return True
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def test_prod_pole_and_tool(self):
        """Test that PROD pole and Fiche de File tool exist"""
        self.log("Testing PROD pole and Fiche de File tool creation...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/domaines", timeout=10)
            
            if response.status_code == 200:
                domaines = response.json()
                prod_pole = None
                
                for domaine in domaines:
                    if domaine["nom"] == "PROD":
                        prod_pole = domaine
                        self.prod_pole_id = domaine["id"]
                        break
                
                if prod_pole:
                    self.log(f"✅ PROD pole found: {prod_pole['nom']} - {prod_pole['description']}")
                    
                    # Check for Fiche de File tool
                    fiche_tool = None
                    for outil in prod_pole.get("outils", []):
                        if outil["nom"] == "Fiche de File":
                            fiche_tool = outil
                            self.fiche_de_file_tool_id = outil["id"]
                            break
                    
                    if fiche_tool:
                        self.log(f"✅ Fiche de File tool found with roles: {fiche_tool['roles_disponibles']}")
                        return True
                    else:
                        self.log("❌ Fiche de File tool not found in PROD pole", "ERROR")
                        return False
                else:
                    self.log("❌ PROD pole not found", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get domaines: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing PROD pole: {str(e)}", "ERROR")
            return False
    
    def test_conducteurs_crud(self):
        """Test conducteurs CRUD operations"""
        self.log("Testing conducteurs CRUD operations...")
        
        try:
            # Create a conducteur
            conducteur_data = {
                "nom": "Dupont",
                "prenom": "Jean",
                "role": "conducteur",
                "telephone": "0123456789",
                "email": "jean.dupont@example.com"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/flowchantier/conducteurs",
                json=conducteur_data,
                timeout=10
            )
            
            if response.status_code == 200:
                conducteur = response.json()
                self.test_conducteur_id = conducteur["id"]
                self.log(f"✅ Conducteur created: {conducteur['prenom']} {conducteur['nom']} (ID: {conducteur['id']})")
            else:
                self.log(f"❌ Failed to create conducteur: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Get all conducteurs
            response = self.session.get(f"{BACKEND_URL}/flowchantier/conducteurs", timeout=10)
            
            if response.status_code == 200:
                conducteurs = response.json()
                self.log(f"✅ Retrieved {len(conducteurs)} conducteurs")
                
                # Verify our created conducteur is in the list
                found = any(c["id"] == self.test_conducteur_id for c in conducteurs)
                if found:
                    self.log("✅ Created conducteur found in list")
                    return True
                else:
                    self.log("❌ Created conducteur not found in list", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get conducteurs: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing conducteurs: {str(e)}", "ERROR")
            return False
    
    def test_chantiers_crud(self):
        """Test chantiers CRUD operations"""
        self.log("Testing chantiers CRUD operations...")
        
        try:
            # Create a chantier
            chantier_data = {
                "nom": "Rénovation Maison Moderne",
                "client": "Société ABC",
                "adresse": "123 Rue de la Paix, 75001 Paris",
                "description": "Rénovation complète d'une maison moderne avec extension"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/flowchantier/chantiers",
                json=chantier_data,
                timeout=10
            )
            
            if response.status_code == 200:
                chantier = response.json()
                self.test_chantier_id = chantier["id"]
                self.log(f"✅ Chantier created: {chantier['nom']} (Ref: {chantier['reference']}, ID: {chantier['id']})")
                self.log(f"   Current step: {chantier['current_step']}")
            else:
                self.log(f"❌ Failed to create chantier: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Get all chantiers
            response = self.session.get(f"{BACKEND_URL}/flowchantier/chantiers", timeout=10)
            
            if response.status_code == 200:
                chantiers = response.json()
                self.log(f"✅ Retrieved {len(chantiers)} chantiers")
            else:
                self.log(f"❌ Failed to get chantiers: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Get single chantier
            response = self.session.get(f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}", timeout=10)
            
            if response.status_code == 200:
                chantier = response.json()
                self.log(f"✅ Retrieved single chantier: {chantier['nom']}")
            else:
                self.log(f"❌ Failed to get single chantier: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Update chantier - assign conducteur
            update_data = {
                "conducteur_id": self.test_conducteur_id,
                "description": "Rénovation complète avec conducteur assigné"
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}",
                json=update_data,
                timeout=10
            )
            
            if response.status_code == 200:
                updated_chantier = response.json()
                self.log(f"✅ Chantier updated with conducteur: {updated_chantier['conducteur_id']}")
                return True
            else:
                self.log(f"❌ Failed to update chantier: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing chantiers CRUD: {str(e)}", "ERROR")
            return False
    
    def test_workflow_operations(self):
        """Test workflow operations (start, validate, skip, go-to-step)"""
        self.log("Testing workflow operations...")
        
        try:
            # Start workflow
            response = self.session.post(
                f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}/start",
                timeout=10
            )
            
            if response.status_code == 200:
                chantier = response.json()
                self.log(f"✅ Workflow started - Current step: {chantier['current_step']}")
                
                if chantier['current_step'] != 1:
                    self.log(f"❌ Expected step 1, got step {chantier['current_step']}", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to start workflow: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Validate current step (step 1)
            response = self.session.post(
                f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}/validate-step",
                timeout=10
            )
            
            if response.status_code == 200:
                chantier = response.json()
                self.log(f"✅ Step 1 validated - Current step: {chantier['current_step']}")
                
                if chantier['current_step'] != 2:
                    self.log(f"❌ Expected step 2, got step {chantier['current_step']}", "ERROR")
                    return False
                    
                # Check step status
                step1_status = chantier['steps_status']['1']
                if step1_status['status'] != 'validated':
                    self.log(f"❌ Step 1 status should be 'validated', got '{step1_status['status']}'", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to validate step: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Skip current step (step 2)
            response = self.session.post(
                f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}/skip-step",
                timeout=10
            )
            
            if response.status_code == 200:
                chantier = response.json()
                self.log(f"✅ Step 2 skipped - Current step: {chantier['current_step']}")
                
                if chantier['current_step'] != 3:
                    self.log(f"❌ Expected step 3, got step {chantier['current_step']}", "ERROR")
                    return False
                    
                # Check step status
                step2_status = chantier['steps_status']['2']
                if step2_status['status'] != 'skipped' or not step2_status['skipped']:
                    self.log(f"❌ Step 2 should be skipped, got status: {step2_status}", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to skip step: {response.status_code} - {response.text}", "ERROR")
                return False
            
            # Go back to step 1
            response = self.session.post(
                f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}/go-to-step/1",
                timeout=10
            )
            
            if response.status_code == 200:
                chantier = response.json()
                self.log(f"✅ Went back to step 1 - Current step: {chantier['current_step']}")
                
                if chantier['current_step'] != 1:
                    self.log(f"❌ Expected step 1, got step {chantier['current_step']}", "ERROR")
                    return False
                    
                return True
            else:
                self.log(f"❌ Failed to go to step 1: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing workflow operations: {str(e)}", "ERROR")
            return False
    
    def test_stats(self):
        """Test statistics endpoint"""
        self.log("Testing statistics endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/flowchantier/stats", timeout=10)
            
            if response.status_code == 200:
                stats = response.json()
                self.log(f"✅ Stats retrieved:")
                self.log(f"   Total chantiers: {stats['total']}")
                self.log(f"   En cours: {stats['en_cours']}")
                self.log(f"   À assigner: {stats['a_assigner']}")
                self.log(f"   Terminés: {stats['termines']}")
                
                # Verify stats make sense
                if stats['total'] >= 1:  # We created at least one chantier
                    return True
                else:
                    self.log("❌ Stats don't reflect created chantier", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get stats: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing stats: {str(e)}", "ERROR")
            return False
    
    def test_delete_chantier(self):
        """Test deleting the test chantier"""
        self.log("Testing chantier deletion...")
        
        try:
            response = self.session.delete(
                f"{BACKEND_URL}/flowchantier/chantiers/{self.test_chantier_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                self.log(f"✅ Chantier deleted: {result['message']}")
                return True
            else:
                self.log(f"❌ Failed to delete chantier: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error deleting chantier: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("=" * 60)
        self.log("STARTING FLOWCHANTIER BACKEND API TESTS")
        self.log("=" * 60)
        
        tests = [
            ("Authentication", self.test_authentication),
            ("PROD Pole & Fiche de File Tool", self.test_prod_pole_and_tool),
            ("Conducteurs CRUD", self.test_conducteurs_crud),
            ("Chantiers CRUD", self.test_chantiers_crud),
            ("Workflow Operations", self.test_workflow_operations),
            ("Statistics", self.test_stats),
            ("Chantier Deletion", self.test_delete_chantier)
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            self.log(f"\n--- Testing {test_name} ---")
            try:
                results[test_name] = test_func()
            except Exception as e:
                self.log(f"❌ Test {test_name} failed with exception: {str(e)}", "ERROR")
                results[test_name] = False
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
            if result:
                passed += 1
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!")
            return True
        else:
            self.log(f"⚠️  {total - passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = FlowChantierTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ All FlowChantier backend tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the logs above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()