# Incident Copilot - ServiceNow Integration Setup

## Overview

The Incident Copilot connects to ServiceNow Table API to fetch incidents, KB articles, and post comments. Each tenant can have its own ServiceNow instance and credentials.

## Environment Variables

### Global (fallback for all tenants)

```env
SERVICENOW_INSTANCE_URL=https://your-instance.service-now.com
SERVICENOW_USERNAME=api_user
SERVICENOW_PASSWORD=api_password
SERVICENOW_INCIDENT_TABLE=incident
SERVICENOW_KB_TABLE=kb_knowledge
```

### Per-Tenant Override

Replace hyphens in the tenant UUID with underscores and uppercase:

```env
# For tenant 00000000-0000-0000-0000-000000000001:
SERVICENOW_00000000_0000_0000_0000_000000000001_INSTANCE_URL=https://tenant1.service-now.com
SERVICENOW_00000000_0000_0000_0000_000000000001_USERNAME=tenant1_user
SERVICENOW_00000000_0000_0000_0000_000000000001_PASSWORD=tenant1_pass
SERVICENOW_00000000_0000_0000_0000_000000000001_INCIDENT_TABLE=incident
SERVICENOW_00000000_0000_0000_0000_000000000001_KB_TABLE=kb_knowledge
```

If tenant-specific variables are not set, the global variables are used as fallback.

## ServiceNow Requirements

1. **API User**: Create a ServiceNow user with `rest_api_explorer` and `itil` roles
2. **Table Access**: The user needs read access to `incident` and `kb_knowledge` tables
3. **Write Access**: The user needs write access to `incident.work_notes` and `incident.comments` fields
4. **Network**: Ensure the backend server can reach the ServiceNow instance URL

## API Endpoints

### Incidents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/grc/copilot/incidents` | List incidents from ServiceNow |
| GET | `/api/grc/copilot/incidents/:sysId` | Get single incident |
| POST | `/api/grc/copilot/incidents/:sysId/suggest` | Generate AI suggestions |
| POST | `/api/grc/copilot/incidents/:sysId/apply` | Apply comment to ServiceNow |

### Learning Events

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/grc/copilot/learning/events` | Record learning event |

### Indexing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/grc/copilot/indexing/incidents` | Index resolved incidents |
| POST | `/api/grc/copilot/indexing/kb` | Index KB articles |
| GET | `/api/grc/copilot/indexing/stats` | Get index statistics |

## Request/Response Examples

### Generate Suggestions

```bash
curl -X POST /api/grc/copilot/incidents/abc123/suggest \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"similarLimit": 5, "kbLimit": 3}'
```

Response:
```json
{
  "success": true,
  "data": {
    "incidentSysId": "abc123",
    "incidentNumber": "INC0001",
    "actionCards": [
      {
        "id": "summary",
        "type": "summary",
        "title": "Incident Summary",
        "content": "...",
        "confidence": 0.9,
        "canApply": false
      },
      {
        "id": "work_notes_draft",
        "type": "work_notes_draft",
        "title": "Work Notes Draft",
        "content": "...",
        "confidence": 0.8,
        "targetField": "work_notes",
        "canApply": true
      }
    ],
    "similarIncidents": [],
    "kbSuggestions": [],
    "generatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Apply Comment

```bash
curl -X POST /api/grc/copilot/incidents/abc123/apply \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "work_notes_draft",
    "targetField": "work_notes",
    "text": "Investigation notes from copilot analysis..."
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "success": true,
    "incidentSysId": "abc123",
    "targetField": "work_notes",
    "appliedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Allowed target fields (Sprint 1):** `work_notes`, `additional_comments` only. Any other field returns 400.

### Record Learning Event

```bash
curl -X POST /api/grc/copilot/learning/events \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{
    "incidentSysId": "abc123",
    "eventType": "SUGGESTION_APPLIED",
    "actionType": "work_notes_draft",
    "confidence": 0.8,
    "evidenceIds": ["sim1", "kb1"]
  }'
```

## Security Notes

- All ServiceNow content is treated as untrusted data (prompt injection defense)
- Credentials are masked in all log output
- Rate limiting with exponential backoff (max 3 retries) for ServiceNow API calls
- Sprint 1 only allows writing to `work_notes` and `additional_comments` fields
- Multi-tenant isolation enforced at every layer (API guards, service, database)

## Staging Verification Checklist

1. Open Copilot page at `/copilot`
2. Search/select an incident from the list
3. Click "Generate Suggestions"
4. Review action cards (Summary, Next Steps, Customer Update, Work Notes)
5. Click "Apply" on Work Notes Draft
6. Confirm in the dialog and submit
7. Verify the comment appears in ServiceNow
