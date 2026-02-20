# Impact & Blast Radius (PR-B4)

## Overview

The Impact & Blast Radius feature allows tracking of affected Configuration Items (CIs) on ITSM incidents and derives impacted services/offerings via CMDB mapping. This provides visibility into the full blast radius of an incident.

## API Endpoints

All endpoints require `Authorization: Bearer <token>` and `x-tenant-id` headers.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/grc/itsm/incidents/:id/affected-cis` | ITSM_INCIDENT_READ | List affected CIs (paginated) |
| POST | `/api/grc/itsm/incidents/:id/affected-cis` | ITSM_INCIDENT_WRITE | Add an affected CI link |
| DELETE | `/api/grc/itsm/incidents/:id/affected-cis/:linkId` | ITSM_INCIDENT_WRITE | Remove an affected CI link |
| GET | `/api/grc/itsm/incidents/:id/impact-summary` | ITSM_INCIDENT_READ | Get impact/blast radius summary |

### POST /api/grc/itsm/incidents/:id/affected-cis

Request body:
```json
{
  "ciId": "uuid",
  "relationshipType": "affected_by | caused_by | related_to",
  "impactScope": "service_impacting | informational"  // optional
}
```

### GET /api/grc/itsm/incidents/:id/impact-summary

Response:
```json
{
  "affectedCis": {
    "count": 3,
    "topClasses": [{ "className": "Server", "count": 2 }],
    "criticalCount": 1
  },
  "impactedServices": [
    {
      "serviceId": "uuid",
      "name": "Email Service",
      "criticality": "high",
      "status": "operational",
      "offeringsCount": 2,
      "isBoundToIncident": true
    }
  ],
  "impactedOfferings": [
    {
      "offeringId": "uuid",
      "name": "Email Premium",
      "serviceId": "uuid",
      "serviceName": "Email Service",
      "status": "operational",
      "isInferred": true
    }
  ]
}
```

## Staging Verification Steps

1. **Run migration:**
   ```bash
   docker compose -f docker-compose.staging.yml exec backend \
     npx typeorm migration:run -d dist/data-source.js
   ```

2. **Seed choices:**
   ```bash
   docker compose -f docker-compose.staging.yml exec backend \
     node dist/scripts/seed-itsm-choices.js
   ```

3. **Verify table exists:**
   ```bash
   docker compose -f docker-compose.staging.yml exec db \
     psql -U postgres -d grc -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='itsm_incident_ci';"
   ```

4. **Verify choices seeded:**
   ```bash
   docker compose -f docker-compose.staging.yml exec db \
     psql -U postgres -d grc -c "SELECT table_name, field_name, value, label FROM sys_choice WHERE table_name='itsm_incident_ci';"
   ```

5. **Test API - List affected CIs:**
   ```bash
   curl -s http://localhost/api/grc/itsm/incidents/<INCIDENT_ID>/affected-cis \
     -H "Authorization: Bearer <TOKEN>" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
   ```

6. **Test API - Add affected CI:**
   ```bash
   curl -s -X POST http://localhost/api/grc/itsm/incidents/<INCIDENT_ID>/affected-cis \
     -H "Authorization: Bearer <TOKEN>" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"ciId":"<CI_ID>","relationshipType":"affected_by","impactScope":"service_impacting"}' | jq .
   ```

7. **Test API - Impact summary:**
   ```bash
   curl -s http://localhost/api/grc/itsm/incidents/<INCIDENT_ID>/impact-summary \
     -H "Authorization: Bearer <TOKEN>" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq .
   ```

## Troubleshooting

### Permission 403
- Ensure the user has `ITSM_INCIDENT_READ` permission for GET endpoints
- Ensure the user has `ITSM_INCIDENT_WRITE` permission for POST/DELETE endpoints
- Verify the `x-tenant-id` header matches the user's tenant

### Missing CMDB Mappings (Empty Impact Summary)
- Verify CIs are linked to services via `cmdb_service_ci` table
- Check that the CI exists in the same tenant as the incident
- Verify the service is not soft-deleted (`is_deleted = false`)

### Empty Impact Results
- Ensure affected CIs have been added to the incident first
- Verify CIs are linked to CMDB services (via cmdb_service_ci)
- Check that services have offerings for the offerings section
- The bound service (incident.serviceId) is always included if set

### Choice Validation Errors (400)
- `relationshipType` must be one of: `affected_by`, `caused_by`, `related_to`
- `impactScope` must be one of: `service_impacting`, `informational` (or omitted)
- Verify choices are seeded in `sys_choice` table for `itsm_incident_ci`

### Duplicate Link Error (400)
- Each (tenant, incident, CI, relationshipType) combination must be unique
- To change the relationship type, delete the existing link and create a new one

## Acceptance Checklist

1. [ ] Migration creates `itsm_incident_ci` table successfully
2. [ ] `sys_choice` entries exist for `relationshipType` and `impactScope`
3. [ ] POST affected CI validates `relationshipType` via ChoiceService
4. [ ] POST affected CI validates CI exists in same tenant
5. [ ] POST affected CI rejects duplicate links (400)
6. [ ] GET affected CIs returns paginated LIST-CONTRACT response
7. [ ] DELETE affected CI soft-deletes the link (204)
8. [ ] GET impact-summary returns correct shape with affectedCis, impactedServices, impactedOfferings
9. [ ] Impact summary derives services from CMDB mapping (cmdb_service_ci)
10. [ ] Impact summary includes incident's bound service (isBoundToIncident=true)
11. [ ] Impact summary sorts services by criticality DESC then name
12. [ ] All endpoints enforce tenant isolation (x-tenant-id)
13. [ ] All endpoints require proper RBAC permissions
14. [ ] Frontend Impact tab shows Affected CIs list with add/delete
15. [ ] Frontend shows Impacted Services and Offerings widgets with empty states
