#!/usr/bin/env python3
"""
Additional FlowChantier API endpoint verification
Tests specific endpoints mentioned in the review request
"""

import requests
import json
from datetime import datetime

# Configuration
BACKEND_URL = "https://apply-direct-2.preview.emergentagent.com/api"
TEST_EMAIL = "superdadmin@gmail.com"
TEST_PASSWORD = "Superadmin123!"

def log(message, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def test_specific_endpoints():
    """Test specific endpoints mentioned in review request"""
    session = requests.Session()
    
    # 1. Authentication
    log("=== Testing Authentication ===")
    response = session.post(f"{BACKEND_URL}/auth/login", 
                           json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if response.status_code == 200:
        log("✅ POST /api/auth/login - SUCCESS")
        token = response.json().get("access_token")
    else:
        log(f"❌ POST /api/auth/login - FAILED: {response.status_code}")
        return
    
    # 2. Verify PROD pole and Fiche de File tool
    log("\n=== Testing PROD Pole & Fiche de File Tool ===")
    response = session.get(f"{BACKEND_URL}/domaines")
    if response.status_code == 200:
        log("✅ GET /api/domaines - SUCCESS")
        domaines = response.json()
        prod_found = any(d["nom"] == "PROD" for d in domaines)
        if prod_found:
            log("✅ PROD pole exists")
            prod_pole = next(d for d in domaines if d["nom"] == "PROD")
            fiche_found = any(o["nom"] == "Fiche de File" for o in prod_pole.get("outils", []))
            if fiche_found:
                log("✅ Fiche de File tool exists in PROD pole")
            else:
                log("❌ Fiche de File tool NOT found in PROD pole")
        else:
            log("❌ PROD pole NOT found")
    else:
        log(f"❌ GET /api/domaines - FAILED: {response.status_code}")
    
    # 3. Chantiers CRUD
    log("\n=== Testing Chantiers CRUD ===")
    
    # POST /api/flowchantier/chantiers
    chantier_data = {
        "nom": "Test Chantier API",
        "client": "Client Test",
        "adresse": "123 Test Street",
        "description": "Test chantier for API verification"
    }
    response = session.post(f"{BACKEND_URL}/flowchantier/chantiers", json=chantier_data)
    if response.status_code == 200:
        log("✅ POST /api/flowchantier/chantiers - SUCCESS")
        chantier = response.json()
        chantier_id = chantier["id"]
        log(f"   Created chantier ID: {chantier_id}")
    else:
        log(f"❌ POST /api/flowchantier/chantiers - FAILED: {response.status_code}")
        return
    
    # GET /api/flowchantier/chantiers
    response = session.get(f"{BACKEND_URL}/flowchantier/chantiers")
    if response.status_code == 200:
        log("✅ GET /api/flowchantier/chantiers - SUCCESS")
        chantiers = response.json()
        log(f"   Found {len(chantiers)} chantiers")
    else:
        log(f"❌ GET /api/flowchantier/chantiers - FAILED: {response.status_code}")
    
    # GET /api/flowchantier/chantiers/{id}
    response = session.get(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}")
    if response.status_code == 200:
        log("✅ GET /api/flowchantier/chantiers/{id} - SUCCESS")
    else:
        log(f"❌ GET /api/flowchantier/chantiers/{{id}} - FAILED: {response.status_code}")
    
    # PUT /api/flowchantier/chantiers/{id}
    update_data = {"description": "Updated description for API test"}
    response = session.put(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}", json=update_data)
    if response.status_code == 200:
        log("✅ PUT /api/flowchantier/chantiers/{id} - SUCCESS")
    else:
        log(f"❌ PUT /api/flowchantier/chantiers/{{id}} - FAILED: {response.status_code}")
    
    # 4. Conducteurs
    log("\n=== Testing Conducteurs ===")
    
    # POST /api/flowchantier/conducteurs
    conducteur_data = {
        "nom": "Test",
        "prenom": "Conducteur",
        "role": "conducteur",
        "telephone": "0123456789",
        "email": "test.conducteur@example.com"
    }
    response = session.post(f"{BACKEND_URL}/flowchantier/conducteurs", json=conducteur_data)
    if response.status_code == 200:
        log("✅ POST /api/flowchantier/conducteurs - SUCCESS")
        conducteur = response.json()
        conducteur_id = conducteur["id"]
    else:
        log(f"❌ POST /api/flowchantier/conducteurs - FAILED: {response.status_code}")
        return
    
    # GET /api/flowchantier/conducteurs
    response = session.get(f"{BACKEND_URL}/flowchantier/conducteurs")
    if response.status_code == 200:
        log("✅ GET /api/flowchantier/conducteurs - SUCCESS")
        conducteurs = response.json()
        log(f"   Found {len(conducteurs)} conducteurs")
    else:
        log(f"❌ GET /api/flowchantier/conducteurs - FAILED: {response.status_code}")
    
    # 5. Workflow operations
    log("\n=== Testing Workflow Operations ===")
    
    # First assign conducteur to chantier
    assign_data = {"conducteur_id": conducteur_id}
    response = session.put(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}", json=assign_data)
    if response.status_code == 200:
        log("✅ Conducteur assigned to chantier")
    else:
        log(f"❌ Failed to assign conducteur: {response.status_code}")
    
    # POST /api/flowchantier/chantiers/{id}/start
    response = session.post(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}/start")
    if response.status_code == 200:
        log("✅ POST /api/flowchantier/chantiers/{id}/start - SUCCESS")
        chantier = response.json()
        log(f"   Current step: {chantier['current_step']}")
    else:
        log(f"❌ POST /api/flowchantier/chantiers/{{id}}/start - FAILED: {response.status_code}")
    
    # POST /api/flowchantier/chantiers/{id}/validate-step
    response = session.post(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}/validate-step")
    if response.status_code == 200:
        log("✅ POST /api/flowchantier/chantiers/{id}/validate-step - SUCCESS")
        chantier = response.json()
        log(f"   Current step after validation: {chantier['current_step']}")
    else:
        log(f"❌ POST /api/flowchantier/chantiers/{{id}}/validate-step - FAILED: {response.status_code}")
    
    # POST /api/flowchantier/chantiers/{id}/skip-step
    response = session.post(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}/skip-step")
    if response.status_code == 200:
        log("✅ POST /api/flowchantier/chantiers/{id}/skip-step - SUCCESS")
        chantier = response.json()
        log(f"   Current step after skip: {chantier['current_step']}")
    else:
        log(f"❌ POST /api/flowchantier/chantiers/{{id}}/skip-step - FAILED: {response.status_code}")
    
    # POST /api/flowchantier/chantiers/{id}/go-to-step/1
    response = session.post(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}/go-to-step/1")
    if response.status_code == 200:
        log("✅ POST /api/flowchantier/chantiers/{id}/go-to-step/1 - SUCCESS")
        chantier = response.json()
        log(f"   Current step after go-to-step: {chantier['current_step']}")
    else:
        log(f"❌ POST /api/flowchantier/chantiers/{{id}}/go-to-step/1 - FAILED: {response.status_code}")
    
    # 6. Stats
    log("\n=== Testing Statistics ===")
    
    # GET /api/flowchantier/stats
    response = session.get(f"{BACKEND_URL}/flowchantier/stats")
    if response.status_code == 200:
        log("✅ GET /api/flowchantier/stats - SUCCESS")
        stats = response.json()
        log(f"   Stats: {stats}")
    else:
        log(f"❌ GET /api/flowchantier/stats - FAILED: {response.status_code}")
    
    # 7. Cleanup - DELETE /api/flowchantier/chantiers/{id}
    log("\n=== Testing Cleanup ===")
    response = session.delete(f"{BACKEND_URL}/flowchantier/chantiers/{chantier_id}")
    if response.status_code == 200:
        log("✅ DELETE /api/flowchantier/chantiers/{id} - SUCCESS")
    else:
        log(f"❌ DELETE /api/flowchantier/chantiers/{{id}} - FAILED: {response.status_code}")
    
    log("\n=== All Endpoint Tests Completed ===")

if __name__ == "__main__":
    test_specific_endpoints()