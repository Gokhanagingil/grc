# ITSM Module Smoke Test Runbook

This runbook provides steps to verify the ITSM Core v1 module functionality on staging.

## Prerequisites

- Access to the staging environment at http://46.224.99.150
- Valid user credentials with ITSM module access
- Demo tenant ID: `00000000-0000-0000-0000-000000000001`

## 1. Module Switcher Verification

### 1.1 Switch to ITSM Module
1. Log in to the platform
2. Locate the module selector in the top-left navigation area
3. Click on the module selector dropdown
4. Select "ITSM" from the available options
5. Verify the selector now shows "Current Module: ITSM"
6. Verify the sidebar navigation updates to show ITSM menu items:
   - Services
   - Incidents
   - Changes

### 1.2 Module Persistence
1. Refresh the browser page
2. Verify the module selection persists (still shows ITSM)
3. Close and reopen the browser tab
4. Verify the module selection is restored from localStorage

### 1.3 Switch Back to GRC
1. Click on the module selector
2. Select "GRC"
3. Verify the sidebar shows GRC menu items
4. Verify GRC routes still work correctly

## 2. ITSM Services Verification

### 2.1 List Services
1. Navigate to ITSM > Services
2. Verify the services list page loads
3. Verify the table displays columns: Name, Description, Criticality, Status, Last Updated

### 2.2 Create Service
1. Click "New Service" button
2. Fill in the form:
   - Name: "Test Service"
   - Description: "Test service for smoke testing"
   - Criticality: "HIGH"
   - Status: "ACTIVE"
3. Click Save
4. Verify the service appears in the list

### 2.3 View/Edit Service
1. Click on the created service row
2. Verify the detail page loads with correct data
3. Edit the description
4. Save changes
5. Verify changes are persisted

## 3. ITSM Incidents Verification

### 3.1 List Incidents
1. Navigate to ITSM > Incidents
2. Verify the incidents list page loads
3. Verify the table displays columns: Number, Short Description, State, Priority, Service, Assignee, Last Updated

### 3.2 Create Incident
1. Click "New Incident" button
2. Fill in the form:
   - Short Description: "Test incident for smoke testing"
   - Description: "Detailed description of the test incident"
   - Priority: "P2"
   - Impact: "MEDIUM"
   - Urgency: "MEDIUM"
   - Service: Select the test service created earlier
3. Click Save
4. Verify the incident appears in the list with auto-generated number (INC-XXXXX)

### 3.3 View/Edit Incident
1. Click on the created incident row
2. Verify the detail page loads with correct data
3. Change the state to "IN_PROGRESS"
4. Save changes
5. Verify state change is persisted

### 3.4 Risk Review Required Flag
1. Create a new incident with:
   - Priority: "P1"
   - Service: A service with criticality "CRITICAL"
2. Verify the "Risk Review Required" badge appears on the incident

## 4. ITSM Changes Verification

### 4.1 List Changes
1. Navigate to ITSM > Changes
2. Verify the changes list page loads
3. Verify the table displays columns: Number, Title, Type, State, Risk, Approval, Service, Last Updated

### 4.2 Create Change
1. Click "New Change" button
2. Fill in the form:
   - Title: "Test change for smoke testing"
   - Description: "Detailed description of the test change"
   - Type: "NORMAL"
   - Risk: "MEDIUM"
3. Click Save
4. Verify the change appears in the list with auto-generated number (CHG-XXXXX)

### 4.3 View/Edit Change
1. Click on the created change row
2. Verify the detail page loads with correct data
3. Change the state to "ASSESS"
4. Save changes
5. Verify state change is persisted

## 5. GRC Bridge Verification

### 5.1 Link Risk to Incident
1. Open an incident detail page
2. Scroll to the "Linked Risks" section
3. Click "Link Risk" button
4. Select a risk from the modal
5. Verify the risk appears in the linked risks list

### 5.2 Link Control to Incident
1. On the same incident detail page
2. Scroll to the "Linked Controls" section
3. Click "Link Control" button
4. Select a control from the modal
5. Verify the control appears in the linked controls list

### 5.3 Unlink Risk/Control
1. Click the unlink button next to a linked risk
2. Confirm the unlink action
3. Verify the risk is removed from the list

### 5.4 Link Risk/Control to Change
1. Open a change detail page
2. Repeat steps 5.1-5.3 for changes

## 6. API Verification (Optional)

### 6.1 Services API
```bash
# List services
curl -X GET "http://46.224.99.150/api/grc/itsm/services" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Create service
curl -X POST "http://46.224.99.150/api/grc/itsm/services" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"name": "API Test Service", "criticality": "MEDIUM", "status": "ACTIVE"}'
```

### 6.2 Incidents API
```bash
# List incidents
curl -X GET "http://46.224.99.150/api/grc/itsm/incidents" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Create incident
curl -X POST "http://46.224.99.150/api/grc/itsm/incidents" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"shortDescription": "API Test Incident", "priority": "P3", "impact": "LOW", "urgency": "LOW"}'
```

### 6.3 Changes API
```bash
# List changes
curl -X GET "http://46.224.99.150/api/grc/itsm/changes" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"

# Create change
curl -X POST "http://46.224.99.150/api/grc/itsm/changes" \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"title": "API Test Change", "type": "STANDARD", "risk": "LOW"}'
```

## 7. Cleanup (Optional)

After smoke testing, you may want to clean up test data:
1. Delete test changes
2. Delete test incidents
3. Delete test services

## Expected Results

All steps should complete without errors. The ITSM module should:
- Allow switching between GRC and ITSM modules
- Persist module selection across page refreshes
- Display ITSM-specific navigation when ITSM is selected
- Support full CRUD operations for Services, Incidents, and Changes
- Support linking/unlinking Risks and Controls to ITSM records
- Automatically flag incidents for risk review based on priority and service criticality
