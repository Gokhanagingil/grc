process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { CmdbService } from '../itsm/cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../itsm/cmdb/service-offering/cmdb-service-offering.entity';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';
import { CmdbCiClass } from '../itsm/cmdb/ci-class/ci-class.entity';
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
import { ChangePolicy } from '../itsm/change/risk/change-policy.entity';
import { CustomerRiskCatalog } from '../grc/entities/customer-risk-catalog.entity';
import { CustomerRiskBinding } from '../grc/entities/customer-risk-binding.entity';
import { CustomerRiskObservation } from '../grc/entities/customer-risk-observation.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Fixed IDs for idempotent upserts
const SVC_ERP_ID = '44444444-4444-4444-4444-444444440001';
const SVC_PAYMENT_ID = '44444444-4444-4444-4444-444444440002';
const OFF_ERP_FULL_ID = '44444444-4444-4444-4444-444444440011';
const OFF_PAYMENT_API_ID = '44444444-4444-4444-4444-444444440012';
const CI_DB_SERVER_ID = '44444444-4444-4444-4444-444444440021';
const CI_APP_SERVER_ID = '44444444-4444-4444-4444-444444440022';
const CI_PAYMENT_GW_ID = '44444444-4444-4444-4444-444444440023';

const CHANGE_LOW_RISK_ID = '44444444-4444-4444-4444-444444441001';
const CHANGE_HIGH_RISK_ID = '44444444-4444-4444-4444-444444441002';
const CHANGE_CRITICAL_ID = '44444444-4444-4444-4444-444444441003';

const ASSESSMENT_LOW_ID = '44444444-4444-4444-4444-444444442001';
const ASSESSMENT_HIGH_ID = '44444444-4444-4444-4444-444444442002';
const ASSESSMENT_CRITICAL_ID = '44444444-4444-4444-4444-444444442003';

const POLICY_CUSTOMER_RISK_CAB_ID = '44444444-4444-4444-4444-444444443001';
const POLICY_CUSTOMER_RISK_BLOCK_ID = '44444444-4444-4444-4444-444444443002';

const BINDING_PREFIX = '44444444-4444-4444-4444-44444444b';
const OBS_PREFIX = '44444444-4444-4444-4444-44444444c';

function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0');
}

async function seedCustomerRiskDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Customer Risk Intelligence Demo Seed');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    // ---------------------------------------------------------------
    // 1. Verify tenant + existing catalog risks
    // ---------------------------------------------------------------
    console.log('1. Verifying demo tenant...');
    const tenantRepo = ds.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({
      where: { id: DEMO_TENANT_ID },
    });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log('   Demo tenant found: ' + tenant.name);

    const catalogRepo = ds.getRepository(CustomerRiskCatalog);
    const catalogItems = await catalogRepo.find({
      where: { tenantId: DEMO_TENANT_ID, status: 'ACTIVE' },
      order: { code: 'ASC' },
    });

    if (catalogItems.length === 0) {
      console.error(
        '   ERROR: No customer risk catalog items found. Run seed:customer-risk-catalog first.',
      );
      process.exit(1);
    }
    console.log(`   Found ${catalogItems.length} active catalog risks`);

    // Pick specific catalog risks for demo scenarios
    const riskEOS = catalogItems.find((c) => c.code === 'CRK-000001'); // OS End-of-Support (CRITICAL)
    const riskPatch = catalogItems.find((c) => c.code === 'CRK-000002'); // Critical Patch Overdue (HIGH)
    const riskBackup = catalogItems.find((c) => c.code === 'CRK-000004'); // Backup Job Failed (HIGH)
    const riskSPOF = catalogItems.find((c) => c.code === 'CRK-000007'); // Single Point of Dependency (HIGH)
    const riskCert = catalogItems.find((c) => c.code === 'CRK-000008'); // Certificate Nearing Expiry (HIGH)
    const riskDBEOL = catalogItems.find((c) => c.code === 'CRK-000009'); // Unsupported DB Version (CRITICAL)
    const riskVuln = catalogItems.find((c) => c.code === 'CRK-000010'); // Vuln Scan Critical (CRITICAL)
    const riskOwner = catalogItems.find((c) => c.code === 'CRK-000011'); // CMDB Owner Missing (MEDIUM)
    const riskReboot = catalogItems.find((c) => c.code === 'CRK-000005'); // No Recent Restart (MEDIUM)

    // ---------------------------------------------------------------
    // 2. Ensure CMDB services exist
    // ---------------------------------------------------------------
    console.log('');
    console.log('2. Seeding CMDB services...');
    const svcRepo = ds.getRepository(CmdbService);

    const services = [
      {
        id: SVC_ERP_ID,
        name: 'ERP Finance (Demo)',
        description:
          'Enterprise resource planning – finance module. Mission-critical for month-end close and compliance reporting.',
        type: 'business_service',
        status: 'live',
        tier: 'tier_0',
        criticality: 'critical',
      },
      {
        id: SVC_PAYMENT_ID,
        name: 'Payment Gateway (Demo)',
        description:
          'Processes all customer payment transactions. Downtime directly impacts revenue.',
        type: 'business_service',
        status: 'live',
        tier: 'tier_0',
        criticality: 'critical',
      },
    ];

    for (const s of services) {
      let svc = await svcRepo.findOne({
        where: { id: s.id, tenantId: DEMO_TENANT_ID },
      });
      if (!svc) {
        svc = svcRepo.create({
          id: s.id,
          tenantId: DEMO_TENANT_ID,
          name: s.name,
          description: s.description,
          type: s.type,
          status: s.status,
          tier: s.tier,
          criticality: s.criticality,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(svc, {
          name: s.name,
          description: s.description,
          type: s.type,
          status: s.status,
          tier: s.tier,
          criticality: s.criticality,
          updatedBy: DEMO_ADMIN_ID,
        });
      }
      await svcRepo.save(svc);
      console.log(`   Upserted service: ${s.name}`);
    }

    // ---------------------------------------------------------------
    // 3. Ensure service offerings exist
    // ---------------------------------------------------------------
    console.log('');
    console.log('3. Seeding service offerings...');
    const offRepo = ds.getRepository(CmdbServiceOffering);

    const offerings = [
      {
        id: OFF_ERP_FULL_ID,
        serviceId: SVC_ERP_ID,
        name: 'ERP Finance – Full Access',
        status: 'live',
        supportHours: '24x7',
      },
      {
        id: OFF_PAYMENT_API_ID,
        serviceId: SVC_PAYMENT_ID,
        name: 'Payment API – Production',
        status: 'live',
        supportHours: '24x7',
      },
    ];

    for (const o of offerings) {
      let off = await offRepo.findOne({
        where: { id: o.id, tenantId: DEMO_TENANT_ID },
      });
      if (!off) {
        off = offRepo.create({
          id: o.id,
          tenantId: DEMO_TENANT_ID,
          serviceId: o.serviceId,
          name: o.name,
          status: o.status,
          supportHours: o.supportHours,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(off, {
          name: o.name,
          status: o.status,
          supportHours: o.supportHours,
          updatedBy: DEMO_ADMIN_ID,
        });
      }
      await offRepo.save(off);
      console.log(`   Upserted offering: ${o.name}`);
    }

    // ---------------------------------------------------------------
    // 4. Ensure CI classes + CIs exist
    // ---------------------------------------------------------------
    console.log('');
    console.log('4. Seeding configuration items...');
    const classRepo = ds.getRepository(CmdbCiClass);
    const ciRepo = ds.getRepository(CmdbCi);

    // Resolve CI class IDs (created by seed-cmdb-baseline)
    const classMap: Record<string, string> = {};
    for (const className of ['server', 'database', 'network_device']) {
      const cls = await classRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: className, isDeleted: false },
      });
      if (cls) {
        classMap[className] = cls.id;
      } else {
        console.warn(
          `   WARN: CI class '${className}' not found. Run seed:cmdb-baseline first.`,
        );
      }
    }

    const cis = [
      {
        id: CI_DB_SERVER_ID,
        name: 'db-erp-prod-01',
        description: 'ERP Finance primary database server (PostgreSQL 9.6)',
        className: 'database',
        lifecycle: 'active',
        environment: 'production',
        category: 'Database Server',
        ipAddress: '10.0.5.10',
        dnsName: 'db-erp-prod-01.internal',
      },
      {
        id: CI_APP_SERVER_ID,
        name: 'app-erp-prod-01',
        description: 'ERP Finance application server (Windows Server 2012 R2)',
        className: 'server',
        lifecycle: 'active',
        environment: 'production',
        category: 'Application Server',
        ipAddress: '10.0.5.20',
        dnsName: 'app-erp-prod-01.internal',
      },
      {
        id: CI_PAYMENT_GW_ID,
        name: 'gw-payment-prod-01',
        description: 'Payment gateway — single instance, no failover',
        className: 'server',
        lifecycle: 'active',
        environment: 'production',
        category: 'Gateway',
        ipAddress: '10.0.6.10',
        dnsName: 'gw-payment-prod-01.internal',
      },
    ];

    for (const ci of cis) {
      const classId = classMap[ci.className];
      if (!classId) {
        console.warn(
          `   WARN: Skipping CI '${ci.name}' — class '${ci.className}' not found`,
        );
        continue;
      }
      let item = await ciRepo.findOne({
        where: { id: ci.id, tenantId: DEMO_TENANT_ID },
      });
      if (!item) {
        item = ciRepo.create({
          id: ci.id,
          tenantId: DEMO_TENANT_ID,
          name: ci.name,
          description: ci.description,
          classId,
          lifecycle: ci.lifecycle,
          environment: ci.environment,
          category: ci.category,
          ipAddress: ci.ipAddress,
          dnsName: ci.dnsName,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(item, {
          name: ci.name,
          description: ci.description,
          classId,
          lifecycle: ci.lifecycle,
          environment: ci.environment,
          category: ci.category,
          ipAddress: ci.ipAddress,
          dnsName: ci.dnsName,
          updatedBy: DEMO_ADMIN_ID,
        });
      }
      await ciRepo.save(item);
      console.log(`   Upserted CI: ${ci.name}`);
    }

    // ---------------------------------------------------------------
    // 5. Create customer risk bindings
    // ---------------------------------------------------------------
    console.log('');
    console.log('5. Seeding customer risk bindings...');
    const bindingRepo = ds.getRepository(CustomerRiskBinding);

    interface BindingSeed {
      id: string;
      catalogRiskId: string;
      targetType: string;
      targetId: string;
      notes: string;
    }

    const bindings: BindingSeed[] = [];
    let bIdx = 1;

    // Service-level bindings (ERP Finance)
    if (riskEOS) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskEOS.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_ERP_ID,
        notes: 'ERP Finance runs on Windows Server 2012 R2 (end-of-support)',
      });
    }
    if (riskBackup) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskBackup.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_ERP_ID,
        notes:
          'Last successful backup was 5 days ago — job failing intermittently',
      });
    }

    // Service-level bindings (Payment Gateway)
    if (riskSPOF) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskSPOF.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_PAYMENT_ID,
        notes:
          'Payment gateway has no failover — single instance processing all transactions',
      });
    }
    if (riskCert) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskCert.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_PAYMENT_ID,
        notes: 'TLS certificate for payment.example.com expires in 18 days',
      });
    }

    // CI-level bindings (db-erp-prod-01)
    if (riskDBEOL) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskDBEOL.id,
        targetType: 'CI',
        targetId: CI_DB_SERVER_ID,
        notes: 'Running PostgreSQL 9.6 — end-of-life since November 2021',
      });
    }
    if (riskPatch) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskPatch.id,
        targetType: 'CI',
        targetId: CI_DB_SERVER_ID,
        notes: 'Critical kernel patch CVE-2025-12345 overdue by 45 days',
      });
    }

    // CI-level bindings (app-erp-prod-01)
    if (riskVuln) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskVuln.id,
        targetType: 'CI',
        targetId: CI_APP_SERVER_ID,
        notes:
          'Vulnerability scanner found 3 critical findings (CVE-2025-11111, CVE-2025-22222, CVE-2025-33333)',
      });
    }
    if (riskReboot) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskReboot.id,
        targetType: 'CI',
        targetId: CI_APP_SERVER_ID,
        notes:
          'Server uptime 142 days — last reboot pre-dates latest kernel patches',
      });
    }

    // CI-level binding (gw-payment-prod-01)
    if (riskOwner) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskOwner.id,
        targetType: 'CI',
        targetId: CI_PAYMENT_GW_ID,
        notes: 'No assigned owner — previous owner left the organization',
      });
    }

    // Offering-level binding
    if (riskPatch) {
      bindings.push({
        id: `${BINDING_PREFIX}${pad(bIdx++)}`,
        catalogRiskId: riskPatch.id,
        targetType: 'CMDB_OFFERING',
        targetId: OFF_PAYMENT_API_ID,
        notes:
          'Payment API offering inherits patch risk from gateway infrastructure',
      });
    }

    let bindCreated = 0;
    let bindSkipped = 0;
    for (const b of bindings) {
      let binding = await bindingRepo.findOne({
        where: { id: b.id, tenantId: DEMO_TENANT_ID },
      });
      if (!binding) {
        binding = bindingRepo.create({
          id: b.id,
          tenantId: DEMO_TENANT_ID,
          catalogRiskId: b.catalogRiskId,
          targetType: b.targetType,
          targetId: b.targetId,
          scopeMode: 'DIRECT',
          enabled: true,
          notes: b.notes,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await bindingRepo.save(binding);
        bindCreated++;
      } else {
        bindSkipped++;
      }
    }
    console.log(
      `   Bindings: ${bindCreated} created, ${bindSkipped} skipped (${bindings.length} total)`,
    );

    // ---------------------------------------------------------------
    // 6. Create customer risk observations
    // ---------------------------------------------------------------
    console.log('');
    console.log('6. Seeding customer risk observations...');
    const obsRepo = ds.getRepository(CustomerRiskObservation);

    interface ObsSeed {
      id: string;
      catalogRiskId: string;
      targetType: string;
      targetId: string;
      status: string;
      evidenceType: string;
      calculatedScore: number;
    }

    const observations: ObsSeed[] = [];
    let oIdx = 1;

    // Active observations for HIGH/CRITICAL scenario
    if (riskEOS) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskEOS.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_ERP_ID,
        status: 'OPEN',
        evidenceType: 'HEALTH_RULE',
        calculatedScore: 25,
      });
    }
    if (riskDBEOL) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskDBEOL.id,
        targetType: 'CI',
        targetId: CI_DB_SERVER_ID,
        status: 'OPEN',
        evidenceType: 'HEALTH_RULE',
        calculatedScore: 22,
      });
    }
    if (riskVuln) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskVuln.id,
        targetType: 'CI',
        targetId: CI_APP_SERVER_ID,
        status: 'OPEN',
        evidenceType: 'CONNECTOR',
        calculatedScore: 24,
      });
    }
    if (riskPatch) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskPatch.id,
        targetType: 'CI',
        targetId: CI_DB_SERVER_ID,
        status: 'ACKNOWLEDGED',
        evidenceType: 'SYSTEM',
        calculatedScore: 20,
      });
    }
    if (riskSPOF) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskSPOF.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_PAYMENT_ID,
        status: 'OPEN',
        evidenceType: 'MANUAL',
        calculatedScore: 18,
      });
    }
    if (riskCert) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskCert.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_PAYMENT_ID,
        status: 'OPEN',
        evidenceType: 'CONNECTOR',
        calculatedScore: 18,
      });
    }

    // Waived/Resolved observations for variety
    if (riskBackup) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskBackup.id,
        targetType: 'CMDB_SERVICE',
        targetId: SVC_ERP_ID,
        status: 'WAIVED',
        evidenceType: 'HEALTH_RULE',
        calculatedScore: 18,
      });
    }
    if (riskOwner) {
      observations.push({
        id: `${OBS_PREFIX}${pad(oIdx++)}`,
        catalogRiskId: riskOwner.id,
        targetType: 'CI',
        targetId: CI_PAYMENT_GW_ID,
        status: 'RESOLVED',
        evidenceType: 'MANUAL',
        calculatedScore: 10,
      });
    }

    let obsCreated = 0;
    let obsSkipped = 0;
    for (const o of observations) {
      let obs = await obsRepo.findOne({
        where: { id: o.id, tenantId: DEMO_TENANT_ID },
      });
      if (!obs) {
        obs = obsRepo.create({
          id: o.id,
          tenantId: DEMO_TENANT_ID,
          catalogRiskId: o.catalogRiskId,
          targetType: o.targetType,
          targetId: o.targetId,
          observedAt: new Date(),
          status: o.status,
          evidenceType: o.evidenceType,
          calculatedScore: o.calculatedScore,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await obsRepo.save(obs);
        obsCreated++;
      } else {
        obsSkipped++;
      }
    }
    console.log(
      `   Observations: ${obsCreated} created, ${obsSkipped} skipped (${observations.length} total)`,
    );

    // ---------------------------------------------------------------
    // 7. Create change policies for customer risk
    // ---------------------------------------------------------------
    console.log('');
    console.log('7. Seeding customer risk change policies...');
    const policyRepo = ds.getRepository(ChangePolicy);

    const policies = [
      {
        id: POLICY_CUSTOMER_RISK_CAB_ID,
        name: 'Require CAB when customer risk score >= 60',
        description:
          'Changes with high customer risk exposure require CAB approval to ensure governance oversight.',
        isActive: true,
        priority: 30,
        conditions: {
          customerRiskScoreMin: 60,
          riskLevelMin: 'HIGH',
        },
        actions: {
          requireCABApproval: true,
          requireImplementationPlan: true,
        },
      },
      {
        id: POLICY_CUSTOMER_RISK_BLOCK_ID,
        name: 'Block changes with CRITICAL customer risk and no backout plan',
        description:
          'Changes impacting services with CRITICAL customer risk must have a backout plan.',
        isActive: true,
        priority: 5,
        conditions: {
          customerRiskLabelMin: 'CRITICAL',
        },
        actions: {
          requireCABApproval: true,
          requireBackoutPlan: true,
          requireImplementationPlan: true,
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
          description: p.description,
          isActive: p.isActive,
          priority: p.priority,
          conditions: p.conditions,
          actions: p.actions,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(policy, {
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          priority: p.priority,
          conditions: p.conditions,
          actions: p.actions,
          updatedBy: DEMO_ADMIN_ID,
        });
      }
      await policyRepo.save(policy);
      console.log(`   Upserted policy: ${p.name}`);
    }

    // ---------------------------------------------------------------
    // 8. Create demo changes with risk assessments
    // ---------------------------------------------------------------
    console.log('');
    console.log('8. Seeding demo changes...');
    const changeRepo = ds.getRepository(ItsmChange);
    const riskRepo = ds.getRepository(RiskAssessment);

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(10, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    nextWeek.setUTCHours(14, 0, 0, 0);

    const changes = [
      {
        id: CHANGE_LOW_RISK_ID,
        number: 'CHG800001',
        title: 'Demo: Low risk — CI/CD pipeline version bump',
        description:
          'Upgrade CI/CD runner agents from v3.8 to v3.9. No customer-facing services impacted. Low risk change for demo.',
        type: ChangeType.STANDARD,
        state: ChangeState.ASSESS,
        risk: ChangeRisk.LOW,
        serviceId: null as string | null,
        offeringId: null as string | null,
        plannedStartAt: nextWeek,
        plannedEndAt: new Date(nextWeek.getTime() + 60 * 60 * 1000),
        assessmentId: ASSESSMENT_LOW_ID,
        riskScore: 15,
        riskLevel: RiskLevel.LOW,
      },
      {
        id: CHANGE_HIGH_RISK_ID,
        number: 'CHG800002',
        title: 'Demo: HIGH risk — ERP Finance database maintenance',
        description:
          'Emergency maintenance on ERP Finance database server (db-erp-prod-01). Server has end-of-support OS, overdue patches, and failed backup job. Customer risk exposure is HIGH.',
        type: ChangeType.NORMAL,
        state: ChangeState.ASSESS,
        risk: ChangeRisk.HIGH,
        serviceId: SVC_ERP_ID,
        offeringId: OFF_ERP_FULL_ID,
        plannedStartAt: tomorrow,
        plannedEndAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        assessmentId: ASSESSMENT_HIGH_ID,
        riskScore: 75,
        riskLevel: RiskLevel.HIGH,
      },
      {
        id: CHANGE_CRITICAL_ID,
        number: 'CHG800003',
        title:
          'Demo: CRITICAL risk — Payment gateway TLS rotation + infra change',
        description:
          'TLS certificate rotation and infrastructure changes on payment gateway (gw-payment-prod-01). Service is a single point of failure with no redundancy, cert expiring in 18 days, and critical vulnerability findings open. Customer risk exposure is CRITICAL.',
        type: ChangeType.NORMAL,
        state: ChangeState.ASSESS,
        risk: ChangeRisk.HIGH,
        serviceId: SVC_PAYMENT_ID,
        offeringId: OFF_PAYMENT_API_ID,
        plannedStartAt: tomorrow,
        plannedEndAt: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000),
        assessmentId: ASSESSMENT_CRITICAL_ID,
        riskScore: 92,
        riskLevel: RiskLevel.HIGH,
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
          type: c.type,
          state: c.state,
          risk: c.risk,
          approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
          requesterId: DEMO_ADMIN_ID,
          assigneeId: DEMO_ADMIN_ID,
          serviceId: c.serviceId,
          offeringId: c.offeringId,
          plannedStartAt: c.plannedStartAt,
          plannedEndAt: c.plannedEndAt,
          implementationPlan:
            '1. Pre-checks and snapshot\n2. Execute change\n3. Validate services\n4. Monitor for 30 minutes',
          backoutPlan:
            'Restore from snapshot if validation fails. Rollback within 15 minutes.',
          justification: 'Customer Risk Intelligence demo scenario.',
          metadata: { demo: true, scenario: 'customer-risk-intelligence' },
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(change, {
          title: c.title,
          description: c.description,
          type: c.type,
          state: c.state,
          risk: c.risk,
          serviceId: c.serviceId,
          offeringId: c.offeringId,
          plannedStartAt: c.plannedStartAt,
          plannedEndAt: c.plannedEndAt,
          metadata: { demo: true, scenario: 'customer-risk-intelligence' },
          updatedBy: DEMO_ADMIN_ID,
        });
      }

      change = await changeRepo.save(change);
      console.log(
        `   Upserted change: ${c.number} (${c.title.slice(0, 50)}...)`,
      );

      // Upsert risk assessment
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
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          computedAt: new Date(),
          breakdown: [],
          impactedCiCount: c.serviceId ? 2 : 0,
          impactedServiceCount: c.serviceId ? 1 : 0,
          hasFreezeConflict: false,
          hasSlaRisk: false,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
      } else {
        Object.assign(assessment, {
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          computedAt: new Date(),
          impactedCiCount: c.serviceId ? 2 : 0,
          impactedServiceCount: c.serviceId ? 1 : 0,
          updatedBy: DEMO_ADMIN_ID,
        });
      }

      await riskRepo.save(assessment);
      console.log(
        `   Upserted risk assessment: score=${c.riskScore}, level=${c.riskLevel}`,
      );
    }

    // ---------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------
    console.log('');
    console.log('='.repeat(60));
    console.log('Customer Risk Intelligence Demo Seed — Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('Demo scenarios ready:');
    console.log('');
    console.log('  LOW RISK:      CHG800001 — CI/CD pipeline version bump');
    console.log(
      '                 No service/offering linked. No customer risk exposure.',
    );
    console.log('                 Expected: aggregate score 0, decision ALLOW');
    console.log('');
    console.log(
      '  HIGH RISK:     CHG800002 — ERP Finance database maintenance',
    );
    console.log(
      '                 Service: ERP Finance (Demo), CIs: db-erp-prod-01, app-erp-prod-01',
    );
    console.log(
      '                 Risks: OS End-of-Support, Unsupported DB, Critical Patch Overdue, Vuln Scan Critical, Backup Failed',
    );
    console.log(
      '                 Expected: aggregate score HIGH, decision CAB_REQUIRED',
    );
    console.log('');
    console.log(
      '  CRITICAL:      CHG800003 — Payment gateway TLS rotation + infra change',
    );
    console.log(
      '                 Service: Payment Gateway (Demo), CI: gw-payment-prod-01',
    );
    console.log(
      '                 Risks: Single Point of Failure, Certificate Expiry, Owner Missing, Patch Overdue',
    );
    console.log(
      '                 Expected: aggregate score CRITICAL, decision CAB_REQUIRED / BLOCK',
    );
    console.log('');
    console.log('1-minute demo:');
    console.log(
      '  1. Open /itsm/changes/CHG800001 → Customer Risk panel shows LOW / empty',
    );
    console.log(
      '  2. Open /itsm/changes/CHG800002 → HIGH risk, multiple risks listed, governance banner',
    );
    console.log(
      '  3. Open /itsm/changes/CHG800003 → CRITICAL risk, policy blocks without backout plan',
    );
    console.log('  4. Click "Recalculate" → see score refresh');
    console.log(
      '  5. Click "Create Mitigation" → create an action from the risk panel',
    );
    console.log('');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedCustomerRiskDemo();
