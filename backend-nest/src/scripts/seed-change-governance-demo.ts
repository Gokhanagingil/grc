process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import {
  FreezeScope,
  FreezeWindow,
} from '../itsm/change/calendar/freeze-window.entity';
import { ChangePolicy } from '../itsm/change/risk/change-policy.entity';
import {
  ChangeApprovalStatus,
  ChangeRisk,
  ChangeState,
  ChangeType,
  ItsmChange,
} from '../itsm/change/change.entity';
import {
  RiskAssessment,
  RiskLevel,
} from '../itsm/change/risk/risk-assessment.entity';
import { SysNotificationTemplate } from '../notification-engine/entities/sys-notification-template.entity';
import {
  NotificationChannel,
  RecipientType,
  SysNotificationRule,
} from '../notification-engine/entities/sys-notification-rule.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

const POLICY_BLOCK_FREEZE_ID = '33333333-3333-3333-3333-333333330001';
const POLICY_REQUIRE_CAB_HIGH_RISK_ID = '33333333-3333-3333-3333-333333330002';

const FREEZE_WINDOW_ID = '33333333-3333-3333-3333-333333330010';

const TEMPLATE_APPROVAL_REQUESTED_ID = '33333333-3333-3333-3333-333333330101';
const TEMPLATE_APPROVED_ID = '33333333-3333-3333-3333-333333330102';
const TEMPLATE_REJECTED_ID = '33333333-3333-3333-3333-333333330103';

const RULE_APPROVAL_REQUESTED_ID = '33333333-3333-3333-3333-333333330201';
const RULE_APPROVED_ID = '33333333-3333-3333-3333-333333330202';
const RULE_REJECTED_ID = '33333333-3333-3333-3333-333333330203';

const CHANGE_HIGH_RISK_ID = '33333333-3333-3333-3333-333333331001';
const CHANGE_FREEZE_BLOCKED_ID = '33333333-3333-3333-3333-333333331002';

const ASSESSMENT_HIGH_RISK_ID = '33333333-3333-3333-3333-333333332001';
const ASSESSMENT_FREEZE_BLOCKED_ID = '33333333-3333-3333-3333-333333332002';

function nextUtcTime(hour: number, minute = 0): Date {
  const now = new Date();
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0,
    ),
  );

  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return candidate;
}

async function seedChangeGovernanceDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Change Governance Demo Seed');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('1. Verifying demo tenant exists...');
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log('   Demo tenant found: ' + tenant.name);

    console.log('');
    console.log('2. Seeding policies...');
    const policyRepo = dataSource.getRepository(ChangePolicy);

    const policies: Array<{
      id: string;
      name: string;
      data: Partial<ChangePolicy>;
    }> = [
      {
        id: POLICY_BLOCK_FREEZE_ID,
        name: 'Block changes during freeze windows',
        data: {
          description:
            'Blocks changes if the planned window overlaps a freeze window.',
          isActive: true,
          priority: 10,
          conditions: { hasFreezeConflict: true },
          actions: { blockDuringFreeze: true },
        },
      },
      {
        id: POLICY_REQUIRE_CAB_HIGH_RISK_ID,
        name: 'Require CAB approval for HIGH risk changes',
        data: {
          description:
            'Requires CAB approval for changes with risk level HIGH or above.',
          isActive: true,
          priority: 20,
          conditions: { riskLevelMin: 'HIGH' },
          actions: { requireCABApproval: true },
        },
      },
    ];

    for (const p of policies) {
      let policy = await policyRepo.findOne({
        where: { id: p.id, tenantId: DEMO_TENANT_ID, isDeleted: false },
      });

      if (!policy) {
        policy = policyRepo.create({
          id: p.id,
          tenantId: DEMO_TENANT_ID,
          name: p.name,
          ...p.data,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(policy, {
          name: p.name,
          ...p.data,
          updatedBy: DEMO_ADMIN_ID,
        });
      }

      await policyRepo.save(policy);
      console.log(`   Upserted policy: ${p.name}`);
    }

    console.log('');
    console.log('3. Seeding freeze window...');
    const freezeRepo = dataSource.getRepository(FreezeWindow);

    const freezeStart = nextUtcTime(22, 0);
    const freezeEnd = new Date(freezeStart.getTime());
    freezeEnd.setUTCHours(6, 0, 0, 0);
    freezeEnd.setUTCDate(freezeStart.getUTCDate() + 1);

    let freeze = await freezeRepo.findOne({
      where: {
        id: FREEZE_WINDOW_ID,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      },
    });

    if (!freeze) {
      freeze = freezeRepo.create({
        id: FREEZE_WINDOW_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Demo Change Freeze Window',
        description: 'Nightly freeze window for change governance demo.',
        startAt: freezeStart,
        endAt: freezeEnd,
        scope: FreezeScope.GLOBAL,
        scopeRefId: null,
        recurrence: null,
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
    } else {
      Object.assign(freeze, {
        name: 'Demo Change Freeze Window',
        description: 'Nightly freeze window for change governance demo.',
        startAt: freezeStart,
        endAt: freezeEnd,
        scope: FreezeScope.GLOBAL,
        scopeRefId: null,
        recurrence: null,
        isActive: true,
        updatedBy: DEMO_ADMIN_ID,
      });
    }

    await freezeRepo.save(freeze);
    console.log(
      `   Upserted freeze window: ${freezeStart.toISOString()} -> ${freezeEnd.toISOString()}`,
    );

    console.log('');
    console.log('4. Seeding notification templates + rules...');
    const templateRepo = dataSource.getRepository(SysNotificationTemplate);
    const ruleRepo = dataSource.getRepository(SysNotificationRule);

    const templates: Array<{
      id: string;
      name: string;
      subject: string;
      body: string;
      allowedVariables: string[];
    }> = [
      {
        id: TEMPLATE_APPROVAL_REQUESTED_ID,
        name: 'Change - CAB Approval Requested',
        subject: 'CAB approval requested: {{change_number}} - {{change_title}}',
        body: 'A change requires CAB approval.\n\nChange: {{change_number}}\nTitle: {{change_title}}\nRisk: {{risk_level}}\nPlanned window: {{planned_start_at}} -> {{planned_end_at}}\nApprover roles: {{approver_roles}}\nApprovals requested: {{approvals_requested}}',
        allowedVariables: [
          'change_number',
          'change_title',
          'risk_level',
          'planned_start_at',
          'planned_end_at',
          'approver_roles',
          'approvals_requested',
        ],
      },
      {
        id: TEMPLATE_APPROVED_ID,
        name: 'Change - Approved',
        subject: 'Change approved: {{change_number}} - {{change_title}}',
        body: 'CAB approval granted.\n\nChange: {{change_number}}\nTitle: {{change_title}}\nApproved by: {{approver_role}} ({{approver_user_id}})\nComment: {{comment}}',
        allowedVariables: [
          'change_number',
          'change_title',
          'approval_id',
          'approver_role',
          'approver_user_id',
          'requester_id',
          'assignee_id',
          'comment',
        ],
      },
      {
        id: TEMPLATE_REJECTED_ID,
        name: 'Change - Rejected',
        subject: 'Change rejected: {{change_number}} - {{change_title}}',
        body: 'CAB approval rejected.\n\nChange: {{change_number}}\nTitle: {{change_title}}\nRejected by: {{approver_role}} ({{approver_user_id}})\nComment: {{comment}}',
        allowedVariables: [
          'change_number',
          'change_title',
          'approval_id',
          'approver_role',
          'approver_user_id',
          'requester_id',
          'assignee_id',
          'comment',
        ],
      },
    ];

    for (const t of templates) {
      let template = await templateRepo.findOne({
        where: { id: t.id, tenantId: DEMO_TENANT_ID },
      });

      if (!template) {
        template = templateRepo.create({
          id: t.id,
          tenantId: DEMO_TENANT_ID,
          name: t.name,
          subject: t.subject,
          body: t.body,
          allowedVariables: t.allowedVariables,
          isActive: true,
        });
      } else {
        Object.assign(template, {
          name: t.name,
          subject: t.subject,
          body: t.body,
          allowedVariables: t.allowedVariables,
          isActive: true,
        });
      }

      await templateRepo.save(template);
      console.log(`   Upserted template: ${t.name}`);
    }

    const rules: Array<{
      id: string;
      name: string;
      data: Partial<SysNotificationRule>;
    }> = [
      {
        id: RULE_APPROVAL_REQUESTED_ID,
        name: 'Change approval requested -> notify approvers',
        data: {
          eventName: 'itsm.change.approval_requested',
          condition: {},
          channels: [NotificationChannel.IN_APP],
          recipients: [
            { type: RecipientType.ROLE, value: 'manager' },
            { type: RecipientType.ROLE, value: 'admin' },
          ],
          templateId: TEMPLATE_APPROVAL_REQUESTED_ID,
          isActive: true,
          rateLimitPerHour: 500,
          tableName: 'itsm_changes',
          description:
            'Sends in-app notifications to managers/admins when CAB approval is requested for a change.',
        },
      },
      {
        id: RULE_APPROVED_ID,
        name: 'Change approved -> notify requester/assignee',
        data: {
          eventName: 'itsm.change.approved',
          condition: {},
          channels: [NotificationChannel.IN_APP],
          recipients: [
            { type: RecipientType.USER_FIELD, value: 'requester_id' },
            { type: RecipientType.USER_FIELD, value: 'assignee_id' },
          ],
          templateId: TEMPLATE_APPROVED_ID,
          isActive: true,
          rateLimitPerHour: 500,
          tableName: 'itsm_changes',
          description:
            'Sends in-app notifications to change requester/assignee when CAB approval is granted.',
        },
      },
      {
        id: RULE_REJECTED_ID,
        name: 'Change rejected -> notify requester/assignee',
        data: {
          eventName: 'itsm.change.rejected',
          condition: {},
          channels: [NotificationChannel.IN_APP],
          recipients: [
            { type: RecipientType.USER_FIELD, value: 'requester_id' },
            { type: RecipientType.USER_FIELD, value: 'assignee_id' },
          ],
          templateId: TEMPLATE_REJECTED_ID,
          isActive: true,
          rateLimitPerHour: 500,
          tableName: 'itsm_changes',
          description:
            'Sends in-app notifications to change requester/assignee when CAB approval is rejected.',
        },
      },
    ];

    for (const r of rules) {
      let rule = await ruleRepo.findOne({
        where: { id: r.id, tenantId: DEMO_TENANT_ID },
      });

      if (!rule) {
        rule = ruleRepo.create({
          id: r.id,
          tenantId: DEMO_TENANT_ID,
          name: r.name,
          ...r.data,
        });
      } else {
        Object.assign(rule, {
          name: r.name,
          ...r.data,
        });
      }

      await ruleRepo.save(rule);
      console.log(`   Upserted rule: ${r.name}`);
    }

    console.log('');
    console.log('5. Seeding demo changes + risk assessments...');
    const changeRepo = dataSource.getRepository(ItsmChange);
    const riskRepo = dataSource.getRepository(RiskAssessment);

    const mainChangeStart = new Date(freezeEnd.getTime() + 2 * 60 * 60 * 1000);
    const mainChangeEnd = new Date(mainChangeStart.getTime() + 60 * 60 * 1000);

    const blockedChangeStart = new Date(freezeStart.getTime() + 60 * 60 * 1000);
    const blockedChangeEnd = new Date(
      blockedChangeStart.getTime() + 60 * 60 * 1000,
    );

    const changes: Array<{
      id: string;
      number: string;
      title: string;
      description: string;
      plannedStartAt: Date;
      plannedEndAt: Date;
      assessmentId: string;
      hasFreezeConflict: boolean;
    }> = [
      {
        id: CHANGE_HIGH_RISK_ID,
        number: 'CHG900001',
        title: 'Demo: High risk change requiring CAB approval',
        description:
          'Demo change used for CAB approval workflow (request approval -> approve -> implement).',
        plannedStartAt: mainChangeStart,
        plannedEndAt: mainChangeEnd,
        assessmentId: ASSESSMENT_HIGH_RISK_ID,
        hasFreezeConflict: false,
      },
      {
        id: CHANGE_FREEZE_BLOCKED_ID,
        number: 'CHG900002',
        title: 'Demo: Change blocked by freeze window',
        description:
          'Demo change used to validate UI error handling for freeze window conflicts (409).',
        plannedStartAt: blockedChangeStart,
        plannedEndAt: blockedChangeEnd,
        assessmentId: ASSESSMENT_FREEZE_BLOCKED_ID,
        hasFreezeConflict: true,
      },
    ];

    for (const c of changes) {
      let change = await changeRepo.findOne({
        where: { id: c.id, tenantId: DEMO_TENANT_ID, isDeleted: false },
      });

      if (!change) {
        change = changeRepo.create({
          id: c.id,
          tenantId: DEMO_TENANT_ID,
          number: c.number,
          title: c.title,
          description: c.description,
          type: ChangeType.NORMAL,
          state: ChangeState.ASSESS,
          risk: ChangeRisk.HIGH,
          approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
          requesterId: DEMO_ADMIN_ID,
          assigneeId: DEMO_ADMIN_ID,
          plannedStartAt: c.plannedStartAt,
          plannedEndAt: c.plannedEndAt,
          implementationPlan:
            'Step 1: do the thing\nStep 2: validate\nStep 3: monitor',
          backoutPlan:
            'Rollback to previous version and validate service health.',
          justification: 'Risk-managed change as part of governance demo.',
          metadata: { demo: true },
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(change, {
          number: c.number,
          title: c.title,
          description: c.description,
          type: ChangeType.NORMAL,
          state: ChangeState.ASSESS,
          risk: ChangeRisk.HIGH,
          approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
          requesterId: DEMO_ADMIN_ID,
          assigneeId: DEMO_ADMIN_ID,
          plannedStartAt: c.plannedStartAt,
          plannedEndAt: c.plannedEndAt,
          implementationPlan:
            'Step 1: do the thing\nStep 2: validate\nStep 3: monitor',
          backoutPlan:
            'Rollback to previous version and validate service health.',
          justification: 'Risk-managed change as part of governance demo.',
          metadata: { demo: true },
          updatedBy: DEMO_ADMIN_ID,
        });
      }

      change = await changeRepo.save(change);
      console.log(`   Upserted change: ${change.number} (${change.title})`);

      let assessment = await riskRepo.findOne({
        where: {
          id: c.assessmentId,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        },
      });

      if (!assessment) {
        assessment = riskRepo.create({
          id: c.assessmentId,
          tenantId: DEMO_TENANT_ID,
          changeId: change.id,
          change,
          riskScore: 85,
          riskLevel: RiskLevel.HIGH,
          computedAt: new Date(),
          breakdown: [],
          impactedCiCount: 2,
          impactedServiceCount: 1,
          hasFreezeConflict: c.hasFreezeConflict,
          hasSlaRisk: false,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(assessment, {
          changeId: change.id,
          riskScore: 85,
          riskLevel: RiskLevel.HIGH,
          computedAt: new Date(),
          breakdown: [],
          impactedCiCount: 2,
          impactedServiceCount: 1,
          hasFreezeConflict: c.hasFreezeConflict,
          hasSlaRisk: false,
          updatedBy: DEMO_ADMIN_ID,
        });
      }

      await riskRepo.save(assessment);
      console.log(`   Upserted risk assessment for ${change.number}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Change Governance Demo Seed Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Demo change IDs:');
    console.log(`  - High risk: ${CHANGE_HIGH_RISK_ID}`);
    console.log(`  - Freeze blocked: ${CHANGE_FREEZE_BLOCKED_ID}`);
    console.log('');
  } catch (error) {
    console.error('Error seeding change governance demo:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedChangeGovernanceDemo();
