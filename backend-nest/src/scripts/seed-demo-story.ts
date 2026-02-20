/**
 * Demo Story Seed Script - "3-Minute Story"
 *
 * Creates an idempotent demo dataset for the Golden Flow demonstration:
 * - 1 Control
 * - 1 Evidence linked to that Control
 * - 1 FAIL TestResult for that Control linked to the Evidence
 * - 1 Issue linked to that FAIL TestResult (and Evidence)
 * - 1 CAPA linked to that Issue, with status history
 *
 * Usage: npm run seed:demo-story
 *
 * This script is idempotent - running it multiple times produces the same result.
 * Uses deterministic IDs and titles for consistency.
 */

// Disable job scheduling for seed scripts to ensure deterministic exit
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { GrcControl } from '../grc/entities/grc-control.entity';
import { GrcEvidence } from '../grc/entities/grc-evidence.entity';
import { GrcControlTest } from '../grc/entities/grc-control-test.entity';
import { GrcTestResult } from '../grc/entities/grc-test-result.entity';
import { GrcIssue } from '../grc/entities/grc-issue.entity';
import { GrcCapa } from '../grc/entities/grc-capa.entity';
import { GrcControlEvidence } from '../grc/entities/grc-control-evidence.entity';
import { GrcEvidenceTestResult } from '../grc/entities/grc-evidence-test-result.entity';
import { GrcIssueEvidence } from '../grc/entities/grc-issue-evidence.entity';
import { GrcStatusHistory } from '../grc/entities/grc-status-history.entity';
import {
  ControlStatus,
  EvidenceType,
  EvidenceSourceType,
  EvidenceStatus,
  ControlTestType,
  ControlTestStatus,
  ControlEvidenceType,
  TestResultOutcome,
  EffectivenessRating,
  IssueType,
  IssueStatus,
  IssueSeverity,
  CapaType,
  CapaStatus,
  CAPAPriority,
} from '../grc/enums';

// Demo tenant and user IDs (consistent with seed-grc.ts)
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Demo Story deterministic IDs (using UUIDv4 format with recognizable pattern)
const DEMO_STORY_CONTROL_ID = '11111111-1111-1111-1111-111111111001';
const DEMO_STORY_EVIDENCE_ID = '11111111-1111-1111-1111-111111111002';
const DEMO_STORY_CONTROL_TEST_ID = '11111111-1111-1111-1111-111111111003';
const DEMO_STORY_TEST_RESULT_ID = '11111111-1111-1111-1111-111111111004';
const DEMO_STORY_ISSUE_ID = '11111111-1111-1111-1111-111111111005';
const DEMO_STORY_CAPA_ID = '11111111-1111-1111-1111-111111111006';

async function seedDemoStory() {
  console.log('='.repeat(60));
  console.log('Demo Story Seed - "3-Minute Golden Flow"');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Verify demo tenant exists
    console.log('1. Verifying demo tenant exists...');
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log('   Demo tenant found: ' + tenant.name);

    // Verify demo admin exists
    console.log('2. Verifying demo admin exists...');
    const userRepo = dataSource.getRepository(User);
    const adminUser = await userRepo.findOne({ where: { id: DEMO_ADMIN_ID } });
    if (!adminUser) {
      console.error('   ERROR: Demo admin not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log('   Demo admin found: ' + adminUser.email);

    // Step 1: Create Demo Control
    console.log('');
    console.log('3. Creating Demo Story Control...');
    const controlRepo = dataSource.getRepository(GrcControl);
    let control = await controlRepo.findOne({
      where: { id: DEMO_STORY_CONTROL_ID },
    });

    if (!control) {
      control = controlRepo.create({
        id: DEMO_STORY_CONTROL_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Demo: Password Complexity Requirements',
        code: 'DEMO-CTL-001',
        description:
          'Ensure all user passwords meet minimum complexity requirements including length, special characters, and rotation policy.',
        status: ControlStatus.IMPLEMENTED,
        ownerUserId: DEMO_ADMIN_ID,
      });
      await controlRepo.save(control);
      console.log(
        '   Created control: DEMO-CTL-001 - Password Complexity Requirements',
      );
    } else {
      console.log('   Control already exists: DEMO-CTL-001');
    }

    // Step 2: Create Demo Evidence
    console.log('');
    console.log('4. Creating Demo Story Evidence...');
    const evidenceRepo = dataSource.getRepository(GrcEvidence);
    let evidence = await evidenceRepo.findOne({
      where: { id: DEMO_STORY_EVIDENCE_ID },
    });

    if (!evidence) {
      evidence = evidenceRepo.create({
        id: DEMO_STORY_EVIDENCE_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Demo: Password Policy Configuration Export',
        description:
          'Screenshot and configuration export showing current password policy settings in the identity management system.',
        type: EvidenceType.CONFIG_EXPORT,
        sourceType: EvidenceSourceType.SYSTEM,
        status: EvidenceStatus.APPROVED,
        collectedAt: new Date(),
        location: '/evidence/password-policy-config-2024.pdf',
        externalUrl: null,
      });
      await evidenceRepo.save(evidence);
      console.log('   Created evidence: Password Policy Configuration Export');
    } else {
      console.log(
        '   Evidence already exists: Password Policy Configuration Export',
      );
    }

    // Step 3: Link Evidence to Control
    console.log('');
    console.log('5. Linking Evidence to Control...');
    const controlEvidenceRepo = dataSource.getRepository(GrcControlEvidence);
    let controlEvidence = await controlEvidenceRepo.findOne({
      where: {
        controlId: DEMO_STORY_CONTROL_ID,
        evidenceId: DEMO_STORY_EVIDENCE_ID,
      },
    });

    if (!controlEvidence) {
      controlEvidence = controlEvidenceRepo.create({
        tenantId: DEMO_TENANT_ID,
        controlId: DEMO_STORY_CONTROL_ID,
        evidenceId: DEMO_STORY_EVIDENCE_ID,
        evidenceType: ControlEvidenceType.BASELINE,
      });
      await controlEvidenceRepo.save(controlEvidence);
      console.log('   Linked evidence to control');
    } else {
      console.log('   Evidence-Control link already exists');
    }

    // Step 4: Create Control Test
    console.log('');
    console.log('6. Creating Demo Story Control Test...');
    const controlTestRepo = dataSource.getRepository(GrcControlTest);
    let controlTest = await controlTestRepo.findOne({
      where: { id: DEMO_STORY_CONTROL_TEST_ID },
    });

    if (!controlTest) {
      controlTest = controlTestRepo.create({
        id: DEMO_STORY_CONTROL_TEST_ID,
        tenantId: DEMO_TENANT_ID,
        controlId: DEMO_STORY_CONTROL_ID,
        name: 'Demo: Q4 2024 Password Policy Compliance Test',
        description:
          'Quarterly test to verify password complexity requirements are enforced across all systems.',
        testType: ControlTestType.MANUAL,
        status: ControlTestStatus.COMPLETED,
        scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        completedAt: new Date(),
      });
      await controlTestRepo.save(controlTest);
      console.log(
        '   Created control test: Q4 2024 Password Policy Compliance Test',
      );
    } else {
      console.log('   Control test already exists');
    }

    // Step 5: Create FAIL Test Result
    console.log('');
    console.log('7. Creating Demo Story FAIL Test Result...');
    const testResultRepo = dataSource.getRepository(GrcTestResult);
    let testResult = await testResultRepo.findOne({
      where: { id: DEMO_STORY_TEST_RESULT_ID },
    });

    if (!testResult) {
      testResult = testResultRepo.create({
        id: DEMO_STORY_TEST_RESULT_ID,
        tenantId: DEMO_TENANT_ID,
        controlTestId: DEMO_STORY_CONTROL_TEST_ID,
        result: TestResultOutcome.FAIL,
        effectivenessRating: EffectivenessRating.PARTIALLY_EFFECTIVE,
        resultDetails:
          'Test revealed that 15% of legacy system accounts do not meet the minimum password length requirement of 12 characters.',
        exceptionsNoted:
          'Finding: Legacy HR system allows 8-character passwords. Recommendation: Update legacy system password policy or migrate to SSO.',
        exceptionsCount: 15,
        recommendations:
          'Update legacy system password policy or migrate to SSO.',
      });
      await testResultRepo.save(testResult);
      console.log('   Created FAIL test result: Password Policy Test - FAILED');
    } else {
      console.log('   Test result already exists');
    }

    // Step 6: Link Evidence to Test Result
    console.log('');
    console.log('8. Linking Evidence to Test Result...');
    const evidenceTestResultRepo = dataSource.getRepository(
      GrcEvidenceTestResult,
    );
    let evidenceTestResult = await evidenceTestResultRepo.findOne({
      where: {
        evidenceId: DEMO_STORY_EVIDENCE_ID,
        testResultId: DEMO_STORY_TEST_RESULT_ID,
      },
    });

    if (!evidenceTestResult) {
      evidenceTestResult = evidenceTestResultRepo.create({
        tenantId: DEMO_TENANT_ID,
        evidenceId: DEMO_STORY_EVIDENCE_ID,
        testResultId: DEMO_STORY_TEST_RESULT_ID,
      });
      await evidenceTestResultRepo.save(evidenceTestResult);
      console.log('   Linked evidence to test result');
    } else {
      console.log('   Evidence-TestResult link already exists');
    }

    // Step 7: Create Issue from FAIL Test Result
    console.log('');
    console.log('9. Creating Demo Story Issue...');
    const issueRepo = dataSource.getRepository(GrcIssue);
    let issue = await issueRepo.findOne({
      where: { id: DEMO_STORY_ISSUE_ID },
    });

    if (!issue) {
      issue = issueRepo.create({
        id: DEMO_STORY_ISSUE_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'Demo: Legacy System Password Policy Non-Compliance',
        description:
          'The Q4 2024 password policy compliance test revealed that the legacy HR system does not enforce the required 12-character minimum password length. Approximately 15% of accounts are affected.',
        type: IssueType.INTERNAL_AUDIT,
        status: IssueStatus.IN_PROGRESS,
        severity: IssueSeverity.HIGH,
        controlId: DEMO_STORY_CONTROL_ID,
        testResultId: DEMO_STORY_TEST_RESULT_ID,
        ownerUserId: DEMO_ADMIN_ID,
        raisedByUserId: DEMO_ADMIN_ID,
        discoveredDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        rootCause:
          'Legacy HR system was deployed before current password policy standards were established and was not updated during the last security hardening initiative.',
      });
      await issueRepo.save(issue);
      console.log(
        '   Created issue: Legacy System Password Policy Non-Compliance',
      );
    } else {
      console.log('   Issue already exists');
    }

    // Step 8: Link Evidence to Issue
    console.log('');
    console.log('10. Linking Evidence to Issue...');
    const issueEvidenceRepo = dataSource.getRepository(GrcIssueEvidence);
    let issueEvidence = await issueEvidenceRepo.findOne({
      where: {
        issueId: DEMO_STORY_ISSUE_ID,
        evidenceId: DEMO_STORY_EVIDENCE_ID,
      },
    });

    if (!issueEvidence) {
      issueEvidence = issueEvidenceRepo.create({
        tenantId: DEMO_TENANT_ID,
        issueId: DEMO_STORY_ISSUE_ID,
        evidenceId: DEMO_STORY_EVIDENCE_ID,
      });
      await issueEvidenceRepo.save(issueEvidence);
      console.log('   Linked evidence to issue');
    } else {
      console.log('   Evidence-Issue link already exists');
    }

    // Step 9: Create CAPA linked to Issue
    console.log('');
    console.log('11. Creating Demo Story CAPA...');
    const capaRepo = dataSource.getRepository(GrcCapa);
    let capa = await capaRepo.findOne({
      where: { id: DEMO_STORY_CAPA_ID },
    });

    if (!capa) {
      capa = capaRepo.create({
        id: DEMO_STORY_CAPA_ID,
        tenantId: DEMO_TENANT_ID,
        issueId: DEMO_STORY_ISSUE_ID,
        title: 'Demo: Upgrade Legacy HR System Password Policy',
        description:
          'Implement corrective action to update the legacy HR system password policy to meet the 12-character minimum requirement.',
        type: CapaType.CORRECTIVE,
        status: CapaStatus.IN_PROGRESS,
        priority: CAPAPriority.HIGH,
        ownerUserId: DEMO_ADMIN_ID,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        rootCauseAnalysis:
          'The legacy HR system was not included in the 2023 security hardening project scope due to planned retirement. However, the retirement timeline has been extended.',
        actionPlan:
          '1. Coordinate with HR system vendor for password policy update\n2. Test updated policy in staging environment\n3. Deploy to production with user communication\n4. Force password reset for affected accounts',
        implementationNotes:
          'Vendor has confirmed the password policy can be updated. Staging deployment scheduled for next week.',
      });
      await capaRepo.save(capa);
      console.log('   Created CAPA: Upgrade Legacy HR System Password Policy');
    } else {
      console.log('   CAPA already exists');
    }

    // Step 10: Create Status History for CAPA (showing progression)
    console.log('');
    console.log('12. Creating Status History for CAPA...');
    const statusHistoryRepo = dataSource.getRepository(GrcStatusHistory);

    // Check if history already exists
    const existingHistory = await statusHistoryRepo.find({
      where: {
        tenantId: DEMO_TENANT_ID,
        entityType: 'CAPA',
        entityId: DEMO_STORY_CAPA_ID,
      },
    });

    if (existingHistory.length === 0) {
      // Create initial status (PLANNED)
      const history1 = statusHistoryRepo.create({
        tenantId: DEMO_TENANT_ID,
        entityType: 'CAPA',
        entityId: DEMO_STORY_CAPA_ID,
        previousStatus: null,
        newStatus: CapaStatus.PLANNED,
        changedByUserId: DEMO_ADMIN_ID,
        changeReason: 'CAPA created from failed test result',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });
      await statusHistoryRepo.save(history1);

      // Create transition to IN_PROGRESS
      const history2 = statusHistoryRepo.create({
        tenantId: DEMO_TENANT_ID,
        entityType: 'CAPA',
        entityId: DEMO_STORY_CAPA_ID,
        previousStatus: CapaStatus.PLANNED,
        newStatus: CapaStatus.IN_PROGRESS,
        changedByUserId: DEMO_ADMIN_ID,
        changeReason:
          'Vendor coordination initiated, staging deployment scheduled',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      });
      await statusHistoryRepo.save(history2);

      console.log('   Created 2 status history entries for CAPA');
    } else {
      console.log(
        '   Status history already exists (' +
          existingHistory.length +
          ' entries)',
      );
    }

    // Also create status history for Issue
    console.log('');
    console.log('13. Creating Status History for Issue...');
    const existingIssueHistory = await statusHistoryRepo.find({
      where: {
        tenantId: DEMO_TENANT_ID,
        entityType: 'ISSUE',
        entityId: DEMO_STORY_ISSUE_ID,
      },
    });

    if (existingIssueHistory.length === 0) {
      // Create initial status (OPEN)
      const issueHistory1 = statusHistoryRepo.create({
        tenantId: DEMO_TENANT_ID,
        entityType: 'ISSUE',
        entityId: DEMO_STORY_ISSUE_ID,
        previousStatus: null,
        newStatus: IssueStatus.OPEN,
        changedByUserId: DEMO_ADMIN_ID,
        changeReason: 'Issue created from failed password policy test',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });
      await statusHistoryRepo.save(issueHistory1);

      // Create transition to IN_PROGRESS
      const issueHistory2 = statusHistoryRepo.create({
        tenantId: DEMO_TENANT_ID,
        entityType: 'ISSUE',
        entityId: DEMO_STORY_ISSUE_ID,
        previousStatus: IssueStatus.OPEN,
        newStatus: IssueStatus.IN_PROGRESS,
        changedByUserId: DEMO_ADMIN_ID,
        changeReason: 'CAPA assigned and remediation work started',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      });
      await statusHistoryRepo.save(issueHistory2);

      console.log('   Created 2 status history entries for Issue');
    } else {
      console.log(
        '   Issue status history already exists (' +
          existingIssueHistory.length +
          ' entries)',
      );
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Demo Story Seed Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Created entities:');
    console.log('  - Control: DEMO-CTL-001 (Password Complexity Requirements)');
    console.log('  - Evidence: Password Policy Configuration Export');
    console.log('  - Control Test: Q4 2024 Password Policy Compliance Test');
    console.log('  - Test Result: FAIL - Password Policy Test');
    console.log('  - Issue: Legacy System Password Policy Non-Compliance');
    console.log('  - CAPA: Upgrade Legacy HR System Password Policy');
    console.log('');
    console.log('Relationships:');
    console.log('  - Evidence linked to Control');
    console.log('  - Evidence linked to Test Result');
    console.log('  - Evidence linked to Issue');
    console.log('  - Issue linked to Control and Test Result');
    console.log('  - CAPA linked to Issue');
    console.log('');
    console.log('Status History:');
    console.log('  - CAPA: PLANNED -> IN_PROGRESS');
    console.log('  - Issue: OPEN -> IN_PROGRESS');
    console.log('');
    console.log('Demo IDs (for testing):');
    console.log('  - Control ID: ' + DEMO_STORY_CONTROL_ID);
    console.log('  - Evidence ID: ' + DEMO_STORY_EVIDENCE_ID);
    console.log('  - Test Result ID: ' + DEMO_STORY_TEST_RESULT_ID);
    console.log('  - Issue ID: ' + DEMO_STORY_ISSUE_ID);
    console.log('  - CAPA ID: ' + DEMO_STORY_CAPA_ID);
    console.log('');
  } catch (error) {
    console.error('Error seeding demo story:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedDemoStory();
