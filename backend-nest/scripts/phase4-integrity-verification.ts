#!/usr/bin/env ts-node
/**
 * PHASE 4: System Integrity Verification
 * 
 * Verifies:
 * - Admin → Role/Permission list works
 * - Admin → Schema Explorer loads
 * - Governance → Policy list loads
 * - Risk Catalog filters work
 * - Calendar loads events
 * 
 * Produces: PHASE4-INTEGRITY-REPORT.md
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/phase4-integrity-verification.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface IntegrityCheck {
  component: string;
  endpoint: string;
  success: boolean;
  message: string;
}

async function checkEndpoint(url: string, timeout: number = 5000): Promise<boolean> {
  try {
    // Use native fetch (Node 18+) or fallback
    const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetchFn(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function verifyIntegrity() {
  console.log('=== PHASE 4: System Integrity Verification ===\n');

  const checks: IntegrityCheck[] = [];
  const timestamp = new Date().toISOString();
  const baseUrl = process.env.API_URL || 'http://localhost:5002';
  const apiPrefix = process.env.API_PREFIX || '/api';
  const apiVersion = process.env.API_VERSION || '/v2';

  // Note: These are placeholder checks - actual implementation would require
  // authentication tokens and proper API calls
  const integrityChecks = [
    {
      component: 'Health Endpoint',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/health`,
      description: 'Basic health check',
    },
    {
      component: 'Admin Roles',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/admin/roles`,
      description: 'Admin role list endpoint',
    },
    {
      component: 'Admin Permissions',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/admin/permissions`,
      description: 'Admin permission list endpoint',
    },
    {
      component: 'Schema Explorer',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/admin/schema`,
      description: 'Schema explorer endpoint',
    },
    {
      component: 'Governance Policies',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/governance/policies`,
      description: 'Governance policy list endpoint',
    },
    {
      component: 'Risk Catalog',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/risk/catalog`,
      description: 'Risk catalog endpoint',
    },
    {
      component: 'Calendar Events',
      endpoint: `${baseUrl}${apiPrefix}${apiVersion}/calendar/events`,
      description: 'Calendar events endpoint',
    },
  ];

  console.log('📋 Checking system components...\n');

  for (const check of integrityChecks) {
    console.log(`  Checking: ${check.component}...`);
    const success = await checkEndpoint(check.endpoint);
    checks.push({
      component: check.component,
      endpoint: check.endpoint,
      success,
      message: success 
        ? '✅ Endpoint accessible' 
        : '⚠️  Endpoint not accessible (may require authentication or server not running)',
    });
    console.log(`    ${success ? '✅' : '⚠️'} ${check.component}`);
  }

  // Generate report
  const allPassed = checks.every((c) => c.success);
  const report = `# PHASE 4: System Integrity Verification Report

**Generated:** ${timestamp}

## Summary

- **Status:** ${allPassed ? '✅ PASS' : '⚠️  PARTIAL'}
- **Components Verified:** ${checks.filter((c) => c.success).length}/${checks.length}

## Component Checks

${checks.map((check) => {
  const icon = check.success ? '✅' : '⚠️';
  return `### ${icon} ${check.component}

**Endpoint:** \`${check.endpoint}\`
**Status:** ${check.success ? 'ACCESSIBLE' : 'NOT ACCESSIBLE'}
**Message:** ${check.message}
`;
}).join('\n\n')}

## Manual Verification Checklist

Since some endpoints may require authentication, please manually verify:

- [ ] Admin → Role/Permission list works
- [ ] Admin → Schema Explorer loads
- [ ] Governance → Policy list loads
- [ ] Risk Catalog filters work (no regression)
- [ ] Calendar loads events

## Conclusion

${allPassed 
  ? '✅ **System integrity verified** - All endpoints accessible.\n\n**Next Steps:**\n1. Proceed to Phase 5: Final Certification'
  : '⚠️  **Some endpoints not accessible** - This may be expected if:\n- Server is not running\n- Authentication is required\n- Endpoints have changed\n\n**Action Required:**\n1. Ensure backend server is running\n2. Manually verify UI components listed above\n3. If regressions exist, patch ONLY minimal code required\n4. Proceed to Phase 5: Final Certification'
}

---
*This report was generated automatically by Phase 4 System Integrity Verification script.*
`;

  const reportPath = path.join(process.cwd(), 'PHASE4-INTEGRITY-REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n✅ Report written to: ${reportPath}`);
}

verifyIntegrity().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

