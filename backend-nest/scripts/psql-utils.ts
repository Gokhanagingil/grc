import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../src/data-source';
import {
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  RiskCatalogEntity,
  StandardMappingEntity,
} from '../src/entities/app';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

interface VerificationReport {
  tenantId: string;
  counts: {
    standards: number;
    clauses: number;
    clausesSynthetic: number;
    controls: number;
    risks: number;
    mappings: number;
    mappingsSynthetic: number;
  };
  thresholds: {
    risksMin: number;
    controlsMin: number;
    clausesMin: number;
    mappingsMin: number;
  };
  results: {
    risks: 'PASS' | 'FAIL';
    controls: 'PASS' | 'FAIL';
    clauses: 'PASS' | 'FAIL';
    mappings: 'PASS' | 'FAIL';
  };
  syntheticRatios: {
    clausesRatio: number;
    mappingsRatio: number;
  };
  crossImpact?: {
    clause: string;
    count: number;
    status: 'PASS' | 'FAIL';
  };
  overall: 'PASS' | 'FAIL';
}

async function verifyDataFoundations(): Promise<VerificationReport> {
  const tenantId = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
  
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  try {
    const stdRepo = AppDataSource.getRepository(StandardEntity);
    const clauseRepo = AppDataSource.getRepository(StandardClauseEntity);
    const controlRepo = AppDataSource.getRepository(ControlLibraryEntity);
    const riskRepo = AppDataSource.getRepository(RiskCatalogEntity);
    const mappingRepo = AppDataSource.getRepository(StandardMappingEntity);

    const [standards, clauses, clausesSynthetic, controls, risks, mappings, mappingsSynthetic] = await Promise.all([
      stdRepo.count({ where: { tenant_id: tenantId } }),
      clauseRepo.count({ where: { tenant_id: tenantId } }),
      clauseRepo.count({ where: { tenant_id: tenantId, synthetic: true } }),
      controlRepo.count({ where: { tenant_id: tenantId } }),
      riskRepo.count({ where: { tenant_id: tenantId } }),
      mappingRepo.count({ where: { tenant_id: tenantId } }),
      mappingRepo.count({ where: { tenant_id: tenantId, synthetic: true } }),
    ]);

    // Cross-impact test (ISO20000:8.4)
    let crossImpactCount = 0;
    try {
      const testClause = await clauseRepo.findOne({
        where: { clause_code: '8.4', tenant_id: tenantId },
        relations: ['standard'],
      });
      
      if (testClause) {
        const mappings = await mappingRepo.find({
          where: [
            { from_clause_id: testClause.id, tenant_id: tenantId },
            { to_clause_id: testClause.id, tenant_id: tenantId },
          ],
        });
        crossImpactCount = mappings.length;
      }
    } catch {
      // Ignore cross-impact errors
    }

    const thresholds = {
      risksMin: 300,
      controlsMin: 150,
      clausesMin: 400,
      mappingsMin: 200,
    };

    const results = {
      risks: (risks >= thresholds.risksMin ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
      controls: (controls >= thresholds.controlsMin ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
      clauses: (clauses >= thresholds.clausesMin ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
      mappings: (mappings >= thresholds.mappingsMin ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
    };

    const overall = Object.values(results).every((r) => r === 'PASS') && crossImpactCount >= 1 ? 'PASS' : 'FAIL';

    // Calculate synthetic ratios
    const clausesRatio = clauses > 0 ? clausesSynthetic / clauses : 0;
    const mappingsRatio = mappings > 0 ? mappingsSynthetic / mappings : 0;

    const report: VerificationReport = {
      tenantId,
      counts: {
        standards,
        clauses,
        clausesSynthetic,
        controls,
        risks,
        mappings,
        mappingsSynthetic,
      },
      thresholds,
      results,
      syntheticRatios: {
        clausesRatio,
        mappingsRatio,
      },
      crossImpact: {
        clause: 'ISO20000:8.4',
        count: crossImpactCount,
        status: crossImpactCount >= 1 ? 'PASS' : 'FAIL',
      },
      overall,
    };

    return report;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

async function generateReport() {
  const report = await verifyDataFoundations();
  
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'DATA-FOUNDATIONS-DB-REPORT.md');
  
  const mdContent = `# Data Foundations Database Verification Report

Generated: ${new Date().toISOString()}

## Summary

**Overall Status:** ${report.overall === 'PASS' ? '✅ PASS' : '❌ FAIL'}

## Counts

- **Standards:** ${report.counts.standards}
- **Clauses:** ${report.counts.clauses} ${report.results.clauses === 'PASS' ? '✅' : '❌'} (threshold: ≥${report.thresholds.clausesMin})
  - Synthetic: ${report.counts.clausesSynthetic} (${(report.syntheticRatios.clausesRatio * 100).toFixed(1)}%)
- **Controls:** ${report.counts.controls} ${report.results.controls === 'PASS' ? '✅' : '❌'} (threshold: ≥${report.thresholds.controlsMin})
- **Risks:** ${report.counts.risks} ${report.results.risks === 'PASS' ? '✅' : '❌'} (threshold: ≥${report.thresholds.risksMin})
- **Mappings:** ${report.counts.mappings} ${report.results.mappings === 'PASS' ? '✅' : '❌'} (threshold: ≥${report.thresholds.mappingsMin})
  - Synthetic: ${report.counts.mappingsSynthetic} (${(report.syntheticRatios.mappingsRatio * 100).toFixed(1)}%)

## Cross-Impact Test

- **Clause:** ${report.crossImpact?.clause}
- **Related Mappings:** ${report.crossImpact?.count} ${report.crossImpact?.status === 'PASS' ? '✅' : '❌'}

## Thresholds

| Metric | Threshold | Actual | Status |
|--------|-----------|--------|--------|
| Risks | ≥${report.thresholds.risksMin} | ${report.counts.risks} | ${report.results.risks} |
| Controls | ≥${report.thresholds.controlsMin} | ${report.counts.controls} | ${report.results.controls} |
| Clauses | ≥${report.thresholds.clausesMin} | ${report.counts.clauses} | ${report.results.clauses} |
| Mappings | ≥${report.thresholds.mappingsMin} | ${report.counts.mappings} | ${report.results.mappings} |
| Cross-Impact | ≥1 | ${report.crossImpact?.count} | ${report.crossImpact?.status} |

## Synthetic Data

- **Clauses Synthetic Ratio:** ${(report.syntheticRatios.clausesRatio * 100).toFixed(1)}%
- **Mappings Synthetic Ratio:** ${(report.syntheticRatios.mappingsRatio * 100).toFixed(1)}%

## Tenant ID

\`${report.tenantId}\`
`;

  fs.writeFileSync(reportPath, mdContent, 'utf-8');
  console.log(`\n✅ Report generated: ${reportPath}\n`);
  console.log(mdContent);
  
  return report;
}

if (require.main === module) {
  generateReport()
    .then((report) => {
      process.exit(report.overall === 'PASS' ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export { verifyDataFoundations, VerificationReport };

