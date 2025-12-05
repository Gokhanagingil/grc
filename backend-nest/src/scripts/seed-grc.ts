/**
 * GRC Demo Data Seed Script
 *
 * Seeds realistic GRC demo data for one tenant and admin user.
 * Includes: Risks, Policies, Requirements, Controls, and Mappings.
 *
 * Usage: npm run seed:grc
 *
 * This script is idempotent - it checks for existing data before creating.
 */

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { User, UserRole } from '../users/user.entity';
import { GrcRisk } from '../grc/entities/grc-risk.entity';
import { GrcPolicy } from '../grc/entities/grc-policy.entity';
import { GrcRequirement } from '../grc/entities/grc-requirement.entity';
import { GrcControl } from '../grc/entities/grc-control.entity';
import { GrcRiskControl } from '../grc/entities/grc-risk-control.entity';
import { GrcPolicyControl } from '../grc/entities/grc-policy-control.entity';
import { GrcRequirementControl } from '../grc/entities/grc-requirement-control.entity';
import {
  RiskSeverity,
  RiskLikelihood,
  RiskStatus,
  PolicyStatus,
  ControlStatus,
  ComplianceFramework,
} from '../grc/enums';

// Demo tenant and user IDs (consistent for idempotency)
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

async function seedGrcData() {
  console.log('Starting GRC demo data seed...\n');

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
      adminUser = userRepo.create({
        id: DEMO_ADMIN_ID,
        email: 'admin@grc-platform.local',
        firstName: 'Demo',
        lastName: 'Admin',
        passwordHash: '$2b$10$demohashdemohashdemohashdemohashdemohashdemoha', // Not a real hash
        role: UserRole.ADMIN,
        tenantId: DEMO_TENANT_ID,
      });
      await userRepo.save(adminUser);
      console.log('   Created demo admin: admin@grc-platform.local');
    } else {
      console.log('   Demo admin already exists');
    }

    // 3. Seed Controls (central hub for mappings)
    console.log('3. Seeding controls...');
    const controlRepo = dataSource.getRepository(GrcControl);
    const existingControls = await controlRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const controlsData = [
      {
        name: 'Access Control Policy',
        code: 'CTL-001',
        description:
          'Implement role-based access control for all systems and applications',
        category: 'Access Management',
        status: ControlStatus.IMPLEMENTED,
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        name: 'Data Encryption at Rest',
        code: 'CTL-002',
        description:
          'Encrypt all sensitive data stored in databases and file systems',
        category: 'Data Protection',
        status: ControlStatus.IMPLEMENTED,
      },
      {
        name: 'Network Segmentation',
        code: 'CTL-003',
        description:
          'Segment network into zones based on data sensitivity and function',
        category: 'Network Security',
        status: ControlStatus.IN_DESIGN,
      },
      {
        name: 'Security Awareness Training',
        code: 'CTL-004',
        description:
          'Conduct annual security awareness training for all employees',
        category: 'Human Resources',
        status: ControlStatus.IMPLEMENTED,
      },
      {
        name: 'Incident Response Plan',
        code: 'CTL-005',
        description:
          'Maintain and test incident response procedures quarterly',
        category: 'Incident Management',
        status: ControlStatus.IN_DESIGN,
      },
      {
        name: 'Vulnerability Management',
        code: 'CTL-006',
        description:
          'Scan systems for vulnerabilities monthly and remediate critical issues within 30 days',
        category: 'Technical Security',
        status: ControlStatus.IMPLEMENTED,
      },
      {
        name: 'Backup and Recovery',
        code: 'CTL-007',
        description:
          'Perform daily backups with weekly recovery testing',
        category: 'Business Continuity',
        status: ControlStatus.IMPLEMENTED,
      },
      {
        name: 'Change Management',
        code: 'CTL-008',
        description:
          'All system changes must go through formal change management process',
        category: 'Operations',
        status: ControlStatus.IN_DESIGN,
      },
    ];

    const controls: GrcControl[] = [];
    for (const data of controlsData) {
      const existing = existingControls.find((c) => c.code === data.code);
      if (existing) {
        controls.push(existing);
      } else {
        const control = controlRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
        });
        await controlRepo.save(control);
        controls.push(control);
        console.log(`   Created control: ${data.code} - ${data.name}`);
      }
    }

    // 4. Seed Risks
    console.log('4. Seeding risks...');
    const riskRepo = dataSource.getRepository(GrcRisk);
    const existingRisks = await riskRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const risksData = [
      {
        title: 'Ransomware Attack',
        description:
          'Risk of ransomware infection leading to data encryption and business disruption',
        category: 'Cybersecurity',
        severity: RiskSeverity.CRITICAL,
        likelihood: RiskLikelihood.POSSIBLE,
        impact: RiskSeverity.CRITICAL,
        score: 64,
        status: RiskStatus.IDENTIFIED,
        ownerUserId: DEMO_ADMIN_ID,
        mitigationPlan:
          'Implement endpoint detection and response (EDR), maintain offline backups, conduct phishing simulations',
        dueDate: new Date('2025-03-31'),
        tags: ['cyber', 'malware', 'critical'],
      },
      {
        title: 'Data Breach via Third Party',
        description:
          'Risk of sensitive data exposure through compromised vendor or partner systems',
        category: 'Third Party',
        severity: RiskSeverity.HIGH,
        likelihood: RiskLikelihood.LIKELY,
        impact: RiskSeverity.HIGH,
        score: 48,
        status: RiskStatus.MITIGATING,
        ownerUserId: DEMO_ADMIN_ID,
        mitigationPlan:
          'Conduct vendor security assessments, implement data sharing agreements, monitor third-party access',
        dueDate: new Date('2025-02-28'),
        tags: ['vendor', 'data-breach', 'third-party'],
      },
      {
        title: 'Insider Threat',
        description:
          'Risk of malicious or negligent actions by employees leading to data loss or system compromise',
        category: 'Human Resources',
        severity: RiskSeverity.HIGH,
        likelihood: RiskLikelihood.POSSIBLE,
        impact: RiskSeverity.HIGH,
        score: 36,
        status: RiskStatus.IDENTIFIED,
        mitigationPlan:
          'Implement DLP solutions, conduct background checks, enforce least privilege access',
        dueDate: new Date('2025-04-30'),
        tags: ['insider', 'employee', 'dlp'],
      },
      {
        title: 'Cloud Misconfiguration',
        description:
          'Risk of data exposure due to misconfigured cloud storage or services',
        category: 'Cloud Security',
        severity: RiskSeverity.MEDIUM,
        likelihood: RiskLikelihood.LIKELY,
        impact: RiskSeverity.HIGH,
        score: 32,
        status: RiskStatus.MITIGATING,
        mitigationPlan:
          'Implement cloud security posture management (CSPM), conduct regular configuration audits',
        dueDate: new Date('2025-01-31'),
        tags: ['cloud', 'aws', 'azure', 'configuration'],
      },
      {
        title: 'Business Email Compromise',
        description:
          'Risk of financial loss through phishing or social engineering attacks targeting executives',
        category: 'Fraud',
        severity: RiskSeverity.HIGH,
        likelihood: RiskLikelihood.LIKELY,
        impact: RiskSeverity.MEDIUM,
        score: 24,
        status: RiskStatus.IDENTIFIED,
        mitigationPlan:
          'Implement email authentication (DMARC/DKIM/SPF), train executives on BEC tactics',
        dueDate: new Date('2025-02-15'),
        tags: ['phishing', 'bec', 'fraud'],
      },
      {
        title: 'Regulatory Non-Compliance',
        description:
          'Risk of fines and reputational damage due to failure to meet regulatory requirements',
        category: 'Compliance',
        severity: RiskSeverity.HIGH,
        likelihood: RiskLikelihood.UNLIKELY,
        impact: RiskSeverity.CRITICAL,
        score: 28,
        status: RiskStatus.MITIGATING,
        mitigationPlan:
          'Maintain compliance calendar, conduct regular audits, engage external compliance consultants',
        dueDate: new Date('2025-06-30'),
        tags: ['compliance', 'gdpr', 'regulatory'],
      },
      {
        title: 'System Availability Failure',
        description:
          'Risk of critical system downtime affecting business operations',
        category: 'Operations',
        severity: RiskSeverity.MEDIUM,
        likelihood: RiskLikelihood.POSSIBLE,
        impact: RiskSeverity.HIGH,
        score: 18,
        status: RiskStatus.ACCEPTED,
        mitigationPlan:
          'Implement high availability architecture, maintain disaster recovery plan',
        tags: ['availability', 'downtime', 'dr'],
      },
      {
        title: 'Physical Security Breach',
        description:
          'Risk of unauthorized physical access to data centers or office facilities',
        category: 'Physical Security',
        severity: RiskSeverity.LOW,
        likelihood: RiskLikelihood.RARE,
        impact: RiskSeverity.MEDIUM,
        score: 6,
        status: RiskStatus.CLOSED,
        mitigationPlan:
          'Implement badge access, CCTV monitoring, visitor management procedures',
        tags: ['physical', 'access', 'datacenter'],
      },
    ];

    const risks: GrcRisk[] = [];
    for (const data of risksData) {
      const existing = existingRisks.find((r) => r.title === data.title);
      if (existing) {
        risks.push(existing);
      } else {
        const risk = riskRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await riskRepo.save(risk);
        risks.push(risk);
        console.log(`   Created risk: ${data.title}`);
      }
    }

    // 5. Seed Policies
    console.log('5. Seeding policies...');
    const policyRepo = dataSource.getRepository(GrcPolicy);
    const existingPolicies = await policyRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const policiesData = [
      {
        name: 'Information Security Policy',
        code: 'POL-001',
        version: '2.0',
        status: PolicyStatus.ACTIVE,
        category: 'Security',
        summary:
          'Establishes the framework for protecting organizational information assets',
        content:
          'This policy defines the requirements for protecting the confidentiality, integrity, and availability of information assets...',
        ownerUserId: DEMO_ADMIN_ID,
        effectiveDate: new Date('2024-01-01'),
        reviewDate: new Date('2025-01-01'),
      },
      {
        name: 'Acceptable Use Policy',
        code: 'POL-002',
        version: '1.5',
        status: PolicyStatus.ACTIVE,
        category: 'Human Resources',
        summary:
          'Defines acceptable use of company IT resources and systems',
        content:
          'All employees must use company IT resources responsibly and in accordance with this policy...',
        ownerUserId: DEMO_ADMIN_ID,
        effectiveDate: new Date('2024-03-15'),
        reviewDate: new Date('2025-03-15'),
      },
      {
        name: 'Data Classification Policy',
        code: 'POL-003',
        version: '1.0',
        status: PolicyStatus.ACTIVE,
        category: 'Data Governance',
        summary:
          'Defines data classification levels and handling requirements',
        content:
          'Data shall be classified as Public, Internal, Confidential, or Restricted based on sensitivity...',
        effectiveDate: new Date('2024-06-01'),
        reviewDate: new Date('2025-06-01'),
      },
      {
        name: 'Incident Response Policy',
        code: 'POL-004',
        version: '2.1',
        status: PolicyStatus.ACTIVE,
        category: 'Security',
        summary:
          'Defines procedures for detecting, responding to, and recovering from security incidents',
        content:
          'Security incidents must be reported within 24 hours of detection...',
        ownerUserId: DEMO_ADMIN_ID,
        effectiveDate: new Date('2024-02-01'),
        reviewDate: new Date('2025-02-01'),
      },
      {
        name: 'Access Control Policy',
        code: 'POL-005',
        version: '1.2',
        status: PolicyStatus.UNDER_REVIEW,
        category: 'Security',
        summary:
          'Defines requirements for managing access to systems and data',
        content:
          'Access to systems shall be granted based on the principle of least privilege...',
        effectiveDate: new Date('2024-04-01'),
        reviewDate: new Date('2024-12-01'),
      },
      {
        name: 'Business Continuity Policy',
        code: 'POL-006',
        version: '1.0',
        status: PolicyStatus.DRAFT,
        category: 'Operations',
        summary:
          'Establishes requirements for business continuity planning and disaster recovery',
        content:
          'Critical business functions must have documented continuity plans...',
      },
      {
        name: 'Third Party Risk Management Policy',
        code: 'POL-007',
        version: '1.1',
        status: PolicyStatus.ACTIVE,
        category: 'Vendor Management',
        summary:
          'Defines requirements for assessing and managing third-party risks',
        content:
          'All third parties with access to sensitive data must undergo security assessment...',
        ownerUserId: DEMO_ADMIN_ID,
        effectiveDate: new Date('2024-05-01'),
        reviewDate: new Date('2025-05-01'),
      },
      {
        name: 'Password Policy',
        code: 'POL-008',
        version: '3.0',
        status: PolicyStatus.ACTIVE,
        category: 'Security',
        summary:
          'Defines password requirements and authentication standards',
        content:
          'Passwords must be at least 12 characters with complexity requirements...',
        effectiveDate: new Date('2024-01-15'),
        reviewDate: new Date('2025-01-15'),
      },
    ];

    const policies: GrcPolicy[] = [];
    for (const data of policiesData) {
      const existing = existingPolicies.find((p) => p.code === data.code);
      if (existing) {
        policies.push(existing);
      } else {
        const policy = policyRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await policyRepo.save(policy);
        policies.push(policy);
        console.log(`   Created policy: ${data.code} - ${data.name}`);
      }
    }

    // 6. Seed Requirements
    console.log('6. Seeding compliance requirements...');
    const requirementRepo = dataSource.getRepository(GrcRequirement);
    const existingRequirements = await requirementRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const requirementsData = [
      {
        framework: ComplianceFramework.ISO27001,
        referenceCode: 'A.5.1.1',
        title: 'Policies for information security',
        description:
          'A set of policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties',
        category: 'Information Security Policies',
        priority: 'High',
        status: 'Compliant',
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        framework: ComplianceFramework.ISO27001,
        referenceCode: 'A.6.1.2',
        title: 'Segregation of duties',
        description:
          'Conflicting duties and areas of responsibility shall be segregated to reduce opportunities for unauthorized or unintentional modification or misuse of the organization assets',
        category: 'Organization of Information Security',
        priority: 'Medium',
        status: 'Partially Compliant',
      },
      {
        framework: ComplianceFramework.ISO27001,
        referenceCode: 'A.9.2.3',
        title: 'Management of privileged access rights',
        description:
          'The allocation and use of privileged access rights shall be restricted and controlled',
        category: 'Access Control',
        priority: 'High',
        status: 'Compliant',
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        framework: ComplianceFramework.ISO27001,
        referenceCode: 'A.12.3.1',
        title: 'Information backup',
        description:
          'Backup copies of information, software and system images shall be taken and tested regularly in accordance with an agreed backup policy',
        category: 'Operations Security',
        priority: 'High',
        status: 'Compliant',
      },
      {
        framework: ComplianceFramework.SOC2,
        referenceCode: 'CC6.1',
        title: 'Logical and Physical Access Controls',
        description:
          'The entity implements logical access security software, infrastructure, and architectures over protected information assets',
        category: 'Common Criteria',
        priority: 'High',
        status: 'Compliant',
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        framework: ComplianceFramework.SOC2,
        referenceCode: 'CC7.2',
        title: 'System Monitoring',
        description:
          'The entity monitors system components and the operation of those components for anomalies',
        category: 'Common Criteria',
        priority: 'Medium',
        status: 'Partially Compliant',
      },
      {
        framework: ComplianceFramework.GDPR,
        referenceCode: 'Art.32',
        title: 'Security of processing',
        description:
          'Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk',
        category: 'Data Protection',
        priority: 'High',
        status: 'Compliant',
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        framework: ComplianceFramework.GDPR,
        referenceCode: 'Art.33',
        title: 'Notification of personal data breach',
        description:
          'Notify the supervisory authority of a personal data breach within 72 hours',
        category: 'Breach Notification',
        priority: 'Critical',
        status: 'Compliant',
      },
      {
        framework: ComplianceFramework.HIPAA,
        referenceCode: '164.312(a)(1)',
        title: 'Access Control',
        description:
          'Implement technical policies and procedures for electronic information systems that maintain electronic protected health information',
        category: 'Technical Safeguards',
        priority: 'High',
        status: 'Not Applicable',
      },
      {
        framework: ComplianceFramework.PCI_DSS,
        referenceCode: 'Req.3.4',
        title: 'Render PAN unreadable',
        description:
          'Render PAN unreadable anywhere it is stored using strong cryptography',
        category: 'Protect Stored Cardholder Data',
        priority: 'High',
        status: 'Not Applicable',
      },
    ];

    const requirements: GrcRequirement[] = [];
    for (const data of requirementsData) {
      const existing = existingRequirements.find(
        (r) =>
          r.framework === data.framework &&
          r.referenceCode === data.referenceCode,
      );
      if (existing) {
        requirements.push(existing);
      } else {
        const requirement = requirementRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await requirementRepo.save(requirement);
        requirements.push(requirement);
        console.log(
          `   Created requirement: ${data.framework} ${data.referenceCode} - ${data.title}`,
        );
      }
    }

    // 7. Create Risk-Control Mappings
    console.log('7. Creating risk-control mappings...');
    const riskControlRepo = dataSource.getRepository(GrcRiskControl);

    const riskControlMappings = [
      { riskTitle: 'Ransomware Attack', controlCodes: ['CTL-002', 'CTL-005', 'CTL-006', 'CTL-007'] },
      { riskTitle: 'Data Breach via Third Party', controlCodes: ['CTL-001', 'CTL-002', 'CTL-003'] },
      { riskTitle: 'Insider Threat', controlCodes: ['CTL-001', 'CTL-004', 'CTL-008'] },
      { riskTitle: 'Cloud Misconfiguration', controlCodes: ['CTL-001', 'CTL-002', 'CTL-008'] },
      { riskTitle: 'Business Email Compromise', controlCodes: ['CTL-004'] },
      { riskTitle: 'Regulatory Non-Compliance', controlCodes: ['CTL-001', 'CTL-002', 'CTL-004', 'CTL-008'] },
      { riskTitle: 'System Availability Failure', controlCodes: ['CTL-005', 'CTL-007'] },
    ];

    for (const mapping of riskControlMappings) {
      const risk = risks.find((r) => r.title === mapping.riskTitle);
      if (!risk) continue;

      for (const controlCode of mapping.controlCodes) {
        const control = controls.find((c) => c.code === controlCode);
        if (!control) continue;

        const existing = await riskControlRepo.findOne({
          where: { riskId: risk.id, controlId: control.id },
        });

        if (!existing) {
          const riskControl = riskControlRepo.create({
            riskId: risk.id,
            controlId: control.id,
            tenantId: DEMO_TENANT_ID,
          });
          await riskControlRepo.save(riskControl);
          console.log(`   Mapped: ${risk.title} -> ${control.code}`);
        }
      }
    }

    // 8. Create Policy-Control Mappings
    console.log('8. Creating policy-control mappings...');
    const policyControlRepo = dataSource.getRepository(GrcPolicyControl);

    const policyControlMappings = [
      { policyCode: 'POL-001', controlCodes: ['CTL-001', 'CTL-002', 'CTL-003', 'CTL-006'] },
      { policyCode: 'POL-002', controlCodes: ['CTL-001', 'CTL-004'] },
      { policyCode: 'POL-003', controlCodes: ['CTL-002'] },
      { policyCode: 'POL-004', controlCodes: ['CTL-005'] },
      { policyCode: 'POL-005', controlCodes: ['CTL-001'] },
      { policyCode: 'POL-006', controlCodes: ['CTL-005', 'CTL-007'] },
      { policyCode: 'POL-007', controlCodes: ['CTL-001', 'CTL-003'] },
      { policyCode: 'POL-008', controlCodes: ['CTL-001'] },
    ];

    for (const mapping of policyControlMappings) {
      const policy = policies.find((p) => p.code === mapping.policyCode);
      if (!policy) continue;

      for (const controlCode of mapping.controlCodes) {
        const control = controls.find((c) => c.code === controlCode);
        if (!control) continue;

        const existing = await policyControlRepo.findOne({
          where: { policyId: policy.id, controlId: control.id },
        });

        if (!existing) {
          const policyControl = policyControlRepo.create({
            policyId: policy.id,
            controlId: control.id,
            tenantId: DEMO_TENANT_ID,
          });
          await policyControlRepo.save(policyControl);
          console.log(`   Mapped: ${policy.code} -> ${control.code}`);
        }
      }
    }

    // 9. Create Requirement-Control Mappings
    console.log('9. Creating requirement-control mappings...');
    const requirementControlRepo = dataSource.getRepository(
      GrcRequirementControl,
    );

    const requirementControlMappings = [
      { framework: ComplianceFramework.ISO27001, refCode: 'A.5.1.1', controlCodes: ['CTL-001', 'CTL-004'] },
      { framework: ComplianceFramework.ISO27001, refCode: 'A.6.1.2', controlCodes: ['CTL-001', 'CTL-008'] },
      { framework: ComplianceFramework.ISO27001, refCode: 'A.9.2.3', controlCodes: ['CTL-001'] },
      { framework: ComplianceFramework.ISO27001, refCode: 'A.12.3.1', controlCodes: ['CTL-007'] },
      { framework: ComplianceFramework.SOC2, refCode: 'CC6.1', controlCodes: ['CTL-001', 'CTL-002', 'CTL-003'] },
      { framework: ComplianceFramework.SOC2, refCode: 'CC7.2', controlCodes: ['CTL-005', 'CTL-006'] },
      { framework: ComplianceFramework.GDPR, refCode: 'Art.32', controlCodes: ['CTL-002', 'CTL-003', 'CTL-006'] },
      { framework: ComplianceFramework.GDPR, refCode: 'Art.33', controlCodes: ['CTL-005'] },
    ];

    for (const mapping of requirementControlMappings) {
      const requirement = requirements.find(
        (r) =>
          r.framework === mapping.framework &&
          r.referenceCode === mapping.refCode,
      );
      if (!requirement) continue;

      for (const controlCode of mapping.controlCodes) {
        const control = controls.find((c) => c.code === controlCode);
        if (!control) continue;

        const existing = await requirementControlRepo.findOne({
          where: { requirementId: requirement.id, controlId: control.id },
        });

        if (!existing) {
          const requirementControl = requirementControlRepo.create({
            requirementId: requirement.id,
            controlId: control.id,
            tenantId: DEMO_TENANT_ID,
          });
          await requirementControlRepo.save(requirementControl);
          console.log(
            `   Mapped: ${requirement.framework} ${requirement.referenceCode} -> ${control.code}`,
          );
        }
      }
    }

    console.log('\n========================================');
    console.log('GRC Demo Data Seed Complete!');
    console.log('========================================');
    console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
    console.log(`Admin Email: admin@grc-platform.local`);
    console.log(`Admin Password: TestPassword123! (use existing auth)`);
    console.log('');
    console.log('Summary:');
    console.log(`  - Controls: ${controls.length}`);
    console.log(`  - Risks: ${risks.length}`);
    console.log(`  - Policies: ${policies.length}`);
    console.log(`  - Requirements: ${requirements.length}`);
    console.log('');
    console.log('To test the API:');
    console.log('  1. Start NestJS: cd backend-nest && npm run start:dev');
    console.log('  2. Login to get JWT token');
    console.log(`  3. Use x-tenant-id: ${DEMO_TENANT_ID} header`);
    console.log('  4. Call GET /grc/risks, /grc/policies, /grc/requirements');
    console.log('========================================\n');
  } catch (error) {
    console.error('Error seeding GRC data:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the seed
seedGrcData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
