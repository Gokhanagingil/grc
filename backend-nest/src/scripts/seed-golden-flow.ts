/**
 * Golden Flow Demo Data Seed Script
 *
 * Seeds a complete Golden Flow scenario for testing the compliance control lifecycle:
 * Standard/Requirement -> Control -> Evidence -> ControlTest -> TestResult -> Issue -> CAPA -> CAPATasks
 *
 * Usage: npm run seed:golden-flow
 *
 * This script is idempotent - it checks for existing data before creating.
 */

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { User, UserRole } from '../users/user.entity';
import { GrcControl } from '../grc/entities/grc-control.entity';
import { GrcRequirement } from '../grc/entities/grc-requirement.entity';
import { GrcEvidence } from '../grc/entities/grc-evidence.entity';
import { GrcControlTest } from '../grc/entities/grc-control-test.entity';
import { GrcTestResult } from '../grc/entities/grc-test-result.entity';
import { GrcIssue } from '../grc/entities/grc-issue.entity';
import { GrcCapa } from '../grc/entities/grc-capa.entity';
import { GrcCapaTask } from '../grc/entities/grc-capa-task.entity';
import { GrcControlEvidence } from '../grc/entities/grc-control-evidence.entity';
import { GrcIssueEvidence } from '../grc/entities/grc-issue-evidence.entity';
import { GrcStatusHistory } from '../grc/entities/grc-status-history.entity';
import { GrcRequirementControl } from '../grc/entities/grc-requirement-control.entity';
import {
  ControlStatus,
  ComplianceFramework,
  ControlTestStatus,
  ControlTestType,
  TestResultOutcome,
  ControlFrequency,
  IssueStatus,
  IssueSeverity,
  IssueSource,
  IssueType,
  CapaStatus,
  CAPATaskStatus,
  EvidenceType,
  ControlEvidenceType,
  StatusHistoryEntityType,
  EffectivenessRating,
} from '../grc/enums';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const GOLDEN_FLOW_PREFIX = 'GF-';

async function seedGoldenFlowData() {
  console.log('Starting Golden Flow demo data seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // 1. Ensure demo tenant exists
    console.log('1. Checking/creating demo tenant...');
    const tenantRepo = dataSource.getRepository(Tenant);
    let tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });

    if (!tenant) {
      tenant = tenantRepo.create({
        id: DEMO_TENANT_ID,
        name: 'Demo Organization',
        description: 'Demo tenant for GRC platform testing',
      });
      await tenantRepo.save(tenant);
      console.log('   Created demo tenant: Demo Organization');
    } else {
      console.log('   Demo tenant already exists');
    }

    // 2. Ensure demo admin user exists
    console.log('2. Checking/creating demo admin user...');
    const userRepo = dataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { id: DEMO_ADMIN_ID } });

    if (!adminUser) {
      const demoPassword =
        process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(demoPassword, saltRounds);

      adminUser = userRepo.create({
        id: DEMO_ADMIN_ID,
        email: process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local',
        firstName: 'Demo',
        lastName: 'Admin',
        passwordHash,
        role: UserRole.ADMIN,
        tenantId: DEMO_TENANT_ID,
      });
      await userRepo.save(adminUser);
      console.log('   Created demo admin: admin@grc-platform.local');
    } else {
      console.log('   Demo admin already exists');
    }

    // 3. Create Golden Flow Requirement (Standard)
    console.log('3. Creating Golden Flow requirement...');
    const requirementRepo = dataSource.getRepository(GrcRequirement);
    let requirement = await requirementRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        referenceCode: `${GOLDEN_FLOW_PREFIX}REQ-001`,
      },
    });

    if (!requirement) {
      requirement = requirementRepo.create({
        tenantId: DEMO_TENANT_ID,
        framework: ComplianceFramework.ISO27001,
        referenceCode: `${GOLDEN_FLOW_PREFIX}REQ-001`,
        title: 'Access Control Testing Requirement',
        description:
          'Access controls must be tested quarterly to ensure effectiveness and compliance with security policies.',
        category: 'Access Control',
        priority: 'High',
        status: 'Active',
        ownerUserId: DEMO_ADMIN_ID,
      });
      await requirementRepo.save(requirement);
      console.log(
        `   Created requirement: ${requirement.referenceCode} - ${requirement.title}`,
      );
    } else {
      console.log('   Golden Flow requirement already exists');
    }

    // 4. Create Golden Flow Control
    console.log('4. Creating Golden Flow control...');
    const controlRepo = dataSource.getRepository(GrcControl);
    let control = await controlRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, code: `${GOLDEN_FLOW_PREFIX}CTL-001` },
    });

    if (!control) {
      control = controlRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: 'Role-Based Access Control',
        code: `${GOLDEN_FLOW_PREFIX}CTL-001`,
        description:
          'Implement and maintain role-based access control (RBAC) for all critical systems. Access rights must be reviewed quarterly.',
        status: ControlStatus.IMPLEMENTED,
        ownerUserId: DEMO_ADMIN_ID,
        testFrequency: ControlFrequency.QUARTERLY,
      });
      await controlRepo.save(control);
      console.log(`   Created control: ${control.code} - ${control.name}`);
    } else {
      console.log('   Golden Flow control already exists');
    }

    // 5. Link Control to Requirement
    console.log('5. Linking control to requirement...');
    const requirementControlRepo = dataSource.getRepository(
      GrcRequirementControl,
    );
    let requirementControl = await requirementControlRepo.findOne({
      where: { requirementId: requirement.id, controlId: control.id },
    });

    if (!requirementControl) {
      requirementControl = requirementControlRepo.create({
        tenantId: DEMO_TENANT_ID,
        requirementId: requirement.id,
        controlId: control.id,
      });
      await requirementControlRepo.save(requirementControl);
      console.log('   Linked control to requirement');
    } else {
      console.log('   Control-requirement link already exists');
    }

    // 6. Create Golden Flow Evidence
    console.log('6. Creating Golden Flow evidence...');
    const evidenceRepo = dataSource.getRepository(GrcEvidence);
    let evidence = await evidenceRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        name: `${GOLDEN_FLOW_PREFIX}Access Control Policy Document`,
      },
    });

    if (!evidence) {
      evidence = evidenceRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: `${GOLDEN_FLOW_PREFIX}Access Control Policy Document`,
        description:
          'Documented access control policy including RBAC matrix and approval workflows.',
        type: EvidenceType.DOCUMENT,
        location: '/documents/policies/access-control-policy-v2.pdf',
        collectedAt: new Date(),
        collectedByUserId: DEMO_ADMIN_ID,
        metadata: {
          documentType: 'Policy',
          version: '2.0',
          lastReviewed: new Date().toISOString(),
        },
      });
      await evidenceRepo.save(evidence);
      console.log(`   Created evidence: ${evidence.name}`);
    } else {
      console.log('   Golden Flow evidence already exists');
    }

    // 7. Link Evidence to Control
    console.log('7. Linking evidence to control...');
    const controlEvidenceRepo = dataSource.getRepository(GrcControlEvidence);
    let controlEvidence = await controlEvidenceRepo.findOne({
      where: { controlId: control.id, evidenceId: evidence.id },
    });

    if (!controlEvidence) {
      controlEvidence = controlEvidenceRepo.create({
        tenantId: DEMO_TENANT_ID,
        controlId: control.id,
        evidenceId: evidence.id,
        evidenceType: ControlEvidenceType.BASELINE,
        notes: 'Primary policy document supporting RBAC implementation',
      });
      await controlEvidenceRepo.save(controlEvidence);
      console.log('   Linked evidence to control');
    } else {
      console.log('   Control-evidence link already exists');
    }

    // 8. Create Golden Flow Control Test (Scheduled)
    console.log('8. Creating Golden Flow control test...');
    const controlTestRepo = dataSource.getRepository(GrcControlTest);
    let controlTest = await controlTestRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        controlId: control.id,
        status: ControlTestStatus.COMPLETED,
      },
    });

    if (!controlTest) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() - 7); // Scheduled 7 days ago

      controlTest = controlTestRepo.create({
        tenantId: DEMO_TENANT_ID,
        controlId: control.id,
        name: 'Q4 2025 Access Control Review',
        description: 'Quarterly access control review for Q4 2025',
        testType: ControlTestType.MANUAL,
        scheduledDate,
        testerUserId: DEMO_ADMIN_ID,
        status: ControlTestStatus.COMPLETED,
        completedAt: new Date(),
      });
      await controlTestRepo.save(controlTest);
      console.log(`   Created control test: ${controlTest.id}`);

      // Create status history for test creation
      const statusHistoryRepo = dataSource.getRepository(GrcStatusHistory);
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.CONTROL_TEST,
          entityId: controlTest.id,
          previousStatus: null,
          newStatus: ControlTestStatus.PLANNED,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'Control test scheduled',
        }),
      );
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.CONTROL_TEST,
          entityId: controlTest.id,
          previousStatus: ControlTestStatus.PLANNED,
          newStatus: ControlTestStatus.IN_PROGRESS,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'Test execution started',
        }),
      );
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.CONTROL_TEST,
          entityId: controlTest.id,
          previousStatus: ControlTestStatus.IN_PROGRESS,
          newStatus: ControlTestStatus.COMPLETED,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'Test execution completed',
        }),
      );
    } else {
      console.log('   Golden Flow control test already exists');
    }

    // 9. Create Golden Flow Test Result (FAIL)
    console.log('9. Creating Golden Flow test result (FAIL)...');
    const testResultRepo = dataSource.getRepository(GrcTestResult);
    let testResult = await testResultRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, controlTestId: controlTest.id },
    });

    if (!testResult) {
      testResult = testResultRepo.create({
        tenantId: DEMO_TENANT_ID,
        controlTestId: controlTest.id,
        result: TestResultOutcome.FAIL,
        effectivenessRating: EffectivenessRating.PARTIALLY_EFFECTIVE,
        resultDetails:
          'Access control review identified several issues: 1) 15 dormant accounts with active access, 2) 3 users with excessive privileges, 3) Missing documentation for 2 service accounts.',
        recommendations:
          'Immediate remediation required: disable dormant accounts, review and reduce excessive privileges, document all service accounts.',
        exceptionsCount: 20,
      });
      await testResultRepo.save(testResult);
      console.log(`   Created test result: ${testResult.id} (FAIL)`);

      // Update control with last test result
      control.lastTestResult = TestResultOutcome.FAIL;
      control.lastTestedDate = new Date();
      await controlRepo.save(control);
    } else {
      console.log('   Golden Flow test result already exists');
    }

    // 10. Create Golden Flow Issue (from failing test)
    console.log('10. Creating Golden Flow issue...');
    const issueRepo = dataSource.getRepository(GrcIssue);
    let issue = await issueRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        title: `${GOLDEN_FLOW_PREFIX}Access Control Deficiencies`,
      },
    });

    if (!issue) {
      issue = issueRepo.create({
        tenantId: DEMO_TENANT_ID,
        title: `${GOLDEN_FLOW_PREFIX}Access Control Deficiencies`,
        description:
          'Quarterly access control review identified multiple deficiencies requiring immediate remediation.',
        severity: IssueSeverity.HIGH,
        status: IssueStatus.IN_PROGRESS,
        source: IssueSource.TEST_RESULT,
        type: IssueType.SELF_ASSESSMENT,
        rootCause:
          'Lack of automated access review process and incomplete offboarding procedures.',
        controlId: control.id,
        testResultId: testResult.id,
        ownerUserId: DEMO_ADMIN_ID,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      });
      await issueRepo.save(issue);
      console.log(`   Created issue: ${issue.title}`);

      // Create status history for issue
      const statusHistoryRepo = dataSource.getRepository(GrcStatusHistory);
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.ISSUE,
          entityId: issue.id,
          previousStatus: null,
          newStatus: IssueStatus.OPEN,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'Issue created from failing test result',
        }),
      );
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.ISSUE,
          entityId: issue.id,
          previousStatus: IssueStatus.OPEN,
          newStatus: IssueStatus.IN_PROGRESS,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'Remediation work started',
        }),
      );
    } else {
      console.log('   Golden Flow issue already exists');
    }

    // 10a. Link Evidence to Issue
    console.log('10a. Linking evidence to issue...');
    const issueEvidenceRepo = dataSource.getRepository(GrcIssueEvidence);
    let issueEvidence = await issueEvidenceRepo.findOne({
      where: { issueId: issue.id, evidenceId: evidence.id },
    });

    if (!issueEvidence) {
      issueEvidence = issueEvidenceRepo.create({
        tenantId: DEMO_TENANT_ID,
        issueId: issue.id,
        evidenceId: evidence.id,
        notes: 'Evidence supporting the access control deficiency issue',
      });
      await issueEvidenceRepo.save(issueEvidence);
      console.log('   Linked evidence to issue');
    } else {
      console.log('   Issue-evidence link already exists');
    }

    // 10b. Create second Golden Flow Issue (manual, linked to control only)
    console.log('10b. Creating second Golden Flow issue (manual)...');
    let manualIssue = await issueRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        title: `${GOLDEN_FLOW_PREFIX}Documentation Gap - Control Procedures`,
      },
    });

    if (!manualIssue) {
      manualIssue = issueRepo.create({
        tenantId: DEMO_TENANT_ID,
        title: `${GOLDEN_FLOW_PREFIX}Documentation Gap - Control Procedures`,
        description:
          'Manual review identified that control procedures documentation is incomplete and requires updates to reflect current operational practices.',
        severity: IssueSeverity.MEDIUM,
        status: IssueStatus.OPEN,
        source: IssueSource.MANUAL,
        type: IssueType.INTERNAL_AUDIT,
        rootCause:
          'Documentation not updated during last system upgrade cycle.',
        controlId: control.id,
        ownerUserId: DEMO_ADMIN_ID,
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      });
      await issueRepo.save(manualIssue);
      console.log(`   Created manual issue: ${manualIssue.title}`);

      // Create status history for manual issue
      const statusHistoryRepo = dataSource.getRepository(GrcStatusHistory);
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.ISSUE,
          entityId: manualIssue.id,
          previousStatus: null,
          newStatus: IssueStatus.OPEN,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'Issue created manually during internal audit',
        }),
      );
    } else {
      console.log('   Golden Flow manual issue already exists');
    }

    // 11. Create Golden Flow CAPA (from issue)
    console.log('11. Creating Golden Flow CAPA...');
    const capaRepo = dataSource.getRepository(GrcCapa);
    let capa = await capaRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        title: `${GOLDEN_FLOW_PREFIX}Access Control Remediation Plan`,
      },
    });

    if (!capa) {
      capa = capaRepo.create({
        tenantId: DEMO_TENANT_ID,
        title: `${GOLDEN_FLOW_PREFIX}Access Control Remediation Plan`,
        description:
          'Corrective and preventive action plan to address access control deficiencies identified in Q4 2025 review.',
        actionPlan:
          '1. Disable all dormant accounts within 5 business days\n2. Review and remediate excessive privileges within 10 business days\n3. Document all service accounts within 15 business days\n4. Implement automated access review tool within 30 days\n5. Update offboarding procedures within 20 days',
        status: CapaStatus.IN_PROGRESS,
        issueId: issue.id,
        ownerUserId: DEMO_ADMIN_ID,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        verificationMethod:
          'Verify all remediation tasks are complete, conduct follow-up access review to confirm no dormant accounts or excessive privileges remain.',
      });
      await capaRepo.save(capa);
      console.log(`   Created CAPA: ${capa.title}`);

      // Create status history for CAPA
      const statusHistoryRepo = dataSource.getRepository(GrcStatusHistory);
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.CAPA,
          entityId: capa.id,
          previousStatus: null,
          newStatus: CapaStatus.PLANNED,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'CAPA created from issue',
        }),
      );
      await statusHistoryRepo.save(
        statusHistoryRepo.create({
          tenantId: DEMO_TENANT_ID,
          entityType: StatusHistoryEntityType.CAPA,
          entityId: capa.id,
          previousStatus: CapaStatus.PLANNED,
          newStatus: CapaStatus.IN_PROGRESS,
          changedByUserId: DEMO_ADMIN_ID,
          changeReason: 'CAPA implementation started',
        }),
      );
    } else {
      console.log('   Golden Flow CAPA already exists');
    }

    // 12. Create Golden Flow CAPA Tasks
    console.log('12. Creating Golden Flow CAPA tasks...');
    const capaTaskRepo = dataSource.getRepository(GrcCapaTask);
    const existingTasks = await capaTaskRepo.find({
      where: { tenantId: DEMO_TENANT_ID, capaId: capa.id },
    });

    const tasksData = [
      {
        title: 'Disable Dormant Accounts',
        description:
          'Identify and disable all user accounts that have been inactive for more than 90 days.',
        status: CAPATaskStatus.COMPLETED,
        sequenceOrder: 1,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        completedAt: new Date(),
        notes:
          'Disabled 15 dormant accounts. Notified account owners via email.',
      },
      {
        title: 'Review Excessive Privileges',
        description:
          'Review all users with administrative or elevated privileges and reduce to minimum required access.',
        status: CAPATaskStatus.IN_PROGRESS,
        sequenceOrder: 2,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
      },
    ];

    for (const taskData of tasksData) {
      const existing = existingTasks.find((t) => t.title === taskData.title);
      if (!existing) {
        const task = capaTaskRepo.create({
          tenantId: DEMO_TENANT_ID,
          capaId: capa.id,
          ...taskData,
          assigneeUserId: DEMO_ADMIN_ID,
        });
        await capaTaskRepo.save(task);
        console.log(`   Created CAPA task: ${task.title}`);

        // Create status history for task
        const statusHistoryRepo = dataSource.getRepository(GrcStatusHistory);
        await statusHistoryRepo.save(
          statusHistoryRepo.create({
            tenantId: DEMO_TENANT_ID,
            entityType: StatusHistoryEntityType.CAPA_TASK,
            entityId: task.id,
            previousStatus: null,
            newStatus: CAPATaskStatus.PENDING,
            changedByUserId: DEMO_ADMIN_ID,
            changeReason: 'Task created',
          }),
        );

        if (taskData.status === CAPATaskStatus.IN_PROGRESS) {
          await statusHistoryRepo.save(
            statusHistoryRepo.create({
              tenantId: DEMO_TENANT_ID,
              entityType: StatusHistoryEntityType.CAPA_TASK,
              entityId: task.id,
              previousStatus: CAPATaskStatus.PENDING,
              newStatus: CAPATaskStatus.IN_PROGRESS,
              changedByUserId: DEMO_ADMIN_ID,
              changeReason: 'Task started',
            }),
          );
        } else if (taskData.status === CAPATaskStatus.COMPLETED) {
          await statusHistoryRepo.save(
            statusHistoryRepo.create({
              tenantId: DEMO_TENANT_ID,
              entityType: StatusHistoryEntityType.CAPA_TASK,
              entityId: task.id,
              previousStatus: CAPATaskStatus.PENDING,
              newStatus: CAPATaskStatus.IN_PROGRESS,
              changedByUserId: DEMO_ADMIN_ID,
              changeReason: 'Task started',
            }),
          );
          await statusHistoryRepo.save(
            statusHistoryRepo.create({
              tenantId: DEMO_TENANT_ID,
              entityType: StatusHistoryEntityType.CAPA_TASK,
              entityId: task.id,
              previousStatus: CAPATaskStatus.IN_PROGRESS,
              newStatus: CAPATaskStatus.COMPLETED,
              changedByUserId: DEMO_ADMIN_ID,
              changeReason: 'Task completed',
            }),
          );
        }
      } else {
        console.log(`   CAPA task already exists: ${taskData.title}`);
      }
    }

    console.log('\n=== Golden Flow Seed Summary ===');
    console.log(`Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`Admin: ${adminUser.email} (${adminUser.id})`);
    console.log(
      `Requirement: ${requirement.referenceCode} - ${requirement.title}`,
    );
    console.log(`Control: ${control.code} - ${control.name}`);
    console.log(`Evidence: ${evidence.name}`);
    console.log(`Control Test: ${controlTest.id} (${controlTest.status})`);
    console.log(`Test Result: ${testResult.id} (${testResult.result})`);
    console.log(`Issue 1 (test_result): ${issue.title} (${issue.status})`);
    console.log(
      `Issue 2 (manual): ${manualIssue?.title || 'N/A'} (${manualIssue?.status || 'N/A'})`,
    );
    console.log(`Total Issues: 2 (1 linked to test result, 1 manual)`);
    console.log(`CAPA: ${capa.title} (${capa.status})`);
    console.log(`CAPA Tasks: ${tasksData.length} tasks created`);
    console.log('\nGolden Flow seed completed successfully!');
  } catch (error) {
    console.error('Error seeding Golden Flow data:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedGoldenFlowData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
