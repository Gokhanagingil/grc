# Risk Intelligence Advisory Pack v1 — Runbook

## What & Why

The Risk Intelligence Advisory Pack v1 adds a **deterministic, explainable** risk advisory system to the GRC platform. It analyzes risk records using heuristic rules (no LLM required) and generates structured mitigation recommendations that humans can review and act upon.

**Key Principles:**
- **Human-in-the-loop**: No automatic production actions. All recommendations are proposals/drafts.
- **Deterministic heuristics**: Explainable, repeatable results based on keyword matching and rule templates.
- **AI-ready contract**: The `AiProviderAdapter` interface is ready for Phase 2 LLM integration.
- **Tenant-scoped**: All operations respect multi-tenant isolation.

---

## Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| POST | `/grc/risks/:id/advisory/analyze` | Generate advisory from risk context + linked entities + CMDB |
| GET | `/grc/risks/:id/advisory/latest` | Return last advisory result (in-memory cache) |
| POST | `/grc/risks/:id/advisory/create-drafts` | Create draft records from selected advisory suggestions |

### Frontend API Paths (via Nginx)
- `POST /api/grc/risks/:id/advisory/analyze`
- `GET /api/grc/risks/:id/advisory/latest`
- `POST /api/grc/risks/:id/advisory/create-drafts`

### Required Headers
- `Authorization: Bearer <token>`
- `x-tenant-id: <uuid>`

### Required Permissions
- `GRC_RISK_READ` (for analyze and latest)
- `GRC_RISK_WRITE` (for create-drafts)

---

## Example Advisory Response

```json
{
  "riskId": "uuid-of-risk",
  "generatedAt": "2026-02-25T10:00:00.000Z",
  "riskTheme": "PATCHING",
  "confidence": 72,
  "summary": "This risk relates to patch management. Unpatched systems may be vulnerable...",
  "affectedServices": [
    { "id": "svc-1", "name": "Payment Service", "criticality": "CRITICAL", "source": "LINKED" }
  ],
  "affectedCis": [
    { "id": "ci-1", "name": "Server-01", "source": "KEYWORD_MATCH" }
  ],
  "topologyImpactSummary": {
    "totalDependencies": 5,
    "criticalDependencies": 2,
    "affectedServiceCount": 3,
    "highestCriticality": "CRITICAL",
    "impactDescription": "5 dependencies found, 2 critical."
  },
  "mitigationPlan": {
    "immediateActions": [
      {
        "id": "uuid",
        "title": "Emergency Patch Assessment",
        "description": "Assess scope and impact of required patches...",
        "timeframe": "IMMEDIATE",
        "priority": "HIGH",
        "estimatedEffort": "4-8 hours"
      }
    ],
    "shortTermActions": [...],
    "permanentActions": [...],
    "verificationSteps": [...]
  },
  "suggestedRecords": [
    {
      "id": "uuid",
      "type": "CHANGE",
      "title": "Patch Rollout Change Request",
      "description": "...",
      "priority": "HIGH",
      "mitigationActionId": "uuid-of-action"
    }
  ],
  "explainability": [
    {
      "signal": "Keyword match: patch, unpatched, hotfix",
      "reasoning": "Risk title and description contain patching-related keywords",
      "confidence": 85,
      "source": "HEURISTIC_THEME_CLASSIFIER"
    }
  ],
  "warnings": [
    "No controls linked to this risk. Advisory confidence is reduced.",
    "No CMDB CIs found. Topology impact may be incomplete."
  ],
  "assumptions": [
    "Risk description accurately reflects the current state",
    "CMDB data is up to date"
  ]
}
```

---

## Risk Theme Classification

The heuristics engine classifies risks into one of 12 themes:

| Theme | Keywords (sample) |
|-------|-------------------|
| PATCHING | patch, update, upgrade, hotfix, CVE |
| ACCESS | access, permission, MFA, authentication, RBAC |
| BACKUP | backup, restore, disaster recovery, RPO, RTO |
| END_OF_SUPPORT | EOL, end of life, deprecated, legacy |
| VULNERABILITY | vulnerability, exploit, injection, pentest |
| CERTIFICATE | certificate, SSL, TLS, expir, PKI |
| NETWORK_EXPOSURE | firewall, port, DMZ, segmentation |
| CONFIGURATION | configuration, hardening, baseline, drift |
| COMPLIANCE | compliance, regulation, audit, ISO, GDPR |
| AVAILABILITY | availability, uptime, SLA, redundancy, HA |
| DATA_PROTECTION | encryption, privacy, PII, DLP, data breach |
| GENERAL | (fallback when no specific theme matches) |

---

## Manual UI Verification Checklist

1. Navigate to any Risk detail page
2. Click the **"Advisory"** tab (5th tab)
3. Verify the empty state shows "Analyze Risk" button
4. Click **"Analyze Risk"**
5. Verify loading skeleton appears during analysis
6. Verify advisory summary card renders with:
   - Risk theme chip
   - Confidence badge (%)
   - Summary text
   - Generated timestamp
7. Verify **Mitigation Plan** sections appear (Immediate/Short-term/Permanent/Verification)
8. Verify **Affected Services & CIs** section (if CMDB data exists)
9. Verify **Topology Impact** card (if topology data exists)
10. Verify **Warnings** panel shows relevant warnings
11. Verify **Explainability** accordion expands to show reasoning
12. Verify **Assumptions** section
13. Verify **Suggested Draft Records** table with checkboxes
14. Select one or more records, click **"Create Drafts"**
15. Verify success/error feedback appears
16. Click **"Re-analyze"** to regenerate
17. Verify error state shows retry button
18. Verify tenant isolation (switch tenant, confirm no cross-data)

---

## Troubleshooting Matrix

| Symptom | Probable Cause | Resolution |
|---------|---------------|------------|
| 401 on analyze endpoint | Missing/invalid JWT or tenant header | Check Authorization header and x-tenant-id |
| 403 on analyze endpoint | Missing GRC_RISK_READ permission | Assign permission to user role |
| 404 on analyze endpoint | Risk ID not found or wrong tenant | Verify risk exists in the correct tenant |
| Empty affectedServices | No CMDB services linked to risk | Link services via CMDB or check keyword matching |
| "Change creation deferred" error in drafts | ChangeService not available (Phase 1 limitation) | Expected in v1 — Change draft creation deferred to Phase 2 |
| "Control test creation unavailable" | ControlTestService not injected | Verify GRC module includes ControlTestService |
| Low confidence score | Few signals available (no controls, no CMDB) | Link controls and CMDB CIs to improve confidence |
| Advisory tab not visible | Frontend not deployed with latest code | Rebuild and redeploy frontend |

---

## Known Limitations / Next Phase

### Phase 1 (Current) Limitations
1. **No LLM integration** — Uses deterministic heuristics only. `AiProviderAdapter` interface exists as stub.
2. **In-memory cache** — Advisory results are cached in-memory per risk. Cache is lost on service restart.
3. **Change draft creation deferred** — ChangeService is in ItsmModule, creating cross-module dependency. Deferred to Phase 2.
4. **No risk-record linkage** — Created draft records are not automatically linked back to the risk.
5. **No background/scheduled analysis** — Advisory is triggered manually only.

### Phase 2 (Planned)
- Real LLM provider integration (OpenAI/Azure/Bedrock) via `AiProviderAdapter`
- Cross-module Change draft creation
- Automatic risk-record linkage
- Advisory result persistence (database)
- Scheduled/periodic advisory refresh
- Policy engine integration for auto-recommendation

### Phase 3 (Future)
- Matrix drift detection
- Continuous risk monitoring
- Advisory comparison over time
- Integration with external threat intelligence feeds
