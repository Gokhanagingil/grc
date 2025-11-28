# PHASE 9 Acceptance Validation Report

**Generated**: 2025-11-02 09:26:50
**API URL**: http://localhost:5002

## Summary

- **Total Tests**: 9
- **Passed**: 4
- **Failed**: 5
- **Success Rate**: 44.44%

## Test Results

### Event Ingestion

**Status**: âŒ FAIL

**Error**: The request was aborted: The operation has timed out.

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: error success
- Values: The request was aborted: The operation has timed out. False
- SyncRoot: System.Object
- Count: 2

### Health and Metrics

**Status**: âŒ FAIL

**Error**: The operation has timed out.

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: error success
- Values: The operation has timed out. False
- SyncRoot: System.Object
- Count: 2

### Idempotency

**Status**: âŒ FAIL

**Error**: Unable to connect to the remote server

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: error success
- Values: Unable to connect to the remote server False
- SyncRoot: System.Object
- Count: 2

### Ingest Token Validation

**Status**: âŒ FAIL

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: statusCode success
- Values:  False
- SyncRoot: System.Object
- Count: 2

### Queue Statistics

**Status**: âŒ FAIL

**Error**: Invalid object passed in, ':' or '}' expected. (2): {

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: error success
- Values: Invalid object passed in, ':' or '}' expected. (2): { False
- SyncRoot: System.Object
- Count: 2

### Rate Limiting

**Status**: âŒ FAIL

**Error**: Rate limit report not found

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: error success
- Values: Rate limit report not found False
- SyncRoot: System.Object
- Count: 2

### Refresh Token Rotation

**Status**: âŒ FAIL

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: success output
- Values: False       at Object.<anonymous> (../src/common/interceptors/audit-log.interceptor.ts:7:1)
      at Object.<anonymous> (../src/app.module.ts:6:1)
      at Object.<anonymous> (e2e/auth.refresh.e2e-spec.ts:4:1)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        9.553 s
Ran all test suites matching /auth.refresh.e2e-spec.ts/i.

- SyncRoot: System.Object
- Count: 2

### SQL Validation

**Status**: âœ… PASS

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: criticalMajorLast5min rawCount severityDistribution success
- Values: 1 1 LINE 1 True
- SyncRoot: System.Object
- Count: 4

### Tenant Isolation

**Status**: âŒ FAIL

**Error**: The remote server returned an error: (500) Internal Server Error.

**Details**:
- IsReadOnly: False
- IsFixedSize: False
- IsSynchronized: False
- Keys: error success
- Values: The remote server returned an error: (500) Internal Server Error. False
- SyncRoot: System.Object
- Count: 2

## Quality Thresholds

| Kriter | Beklenen | Durum |
|--------|----------|-------|
| Queue lag | < 1000 |  |
| DLQ depth | = 0 |  |
| P95 ingest | â‰¤ 250 ms |  ms |
| Rate-limit 429 ratio | â‰¥ 10 % | % |
| Tenant sÄ±zÄ±ntÄ±sÄ± | 0 kayÄ±t | âœ… |
| Refresh rotation success | â‰¥ 100 % | False |

## Files Generated

- `reports/health.json`
- `reports/metrics-preview.txt`
- `reports/rate-limit.json`
- `reports/queue-stats.json`
- `reports/ACCEPTANCE-VALIDATION-REPORT.md`

---
**Validation Complete**

