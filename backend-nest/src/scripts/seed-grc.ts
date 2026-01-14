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
import * as bcrypt from 'bcrypt';
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
  ControlType,
  ControlImplementationType,
  ComplianceFramework,
  ProcessControlMethod,
  ProcessControlFrequency,
  ControlResultType,
  ControlResultSource,
  ViolationSeverity,
  ViolationStatus,
  // Golden Flow Sprint 1B enums
  EvidenceType,
  EvidenceSourceType,
  EvidenceStatus,
  IssueType,
  IssueStatus,
  IssueSeverity,
  ControlTestType,
  ControlTestStatus,
  TestResultOutcome,
  EffectivenessRating,
} from '../grc/enums';
import { Process } from '../grc/entities/process.entity';
import { ProcessControl } from '../grc/entities/process-control.entity';
import { ControlResult } from '../grc/entities/control-result.entity';
import { ProcessViolation } from '../grc/entities/process-violation.entity';
import { GrcControlProcess } from '../grc/entities/grc-control-process.entity';
// Golden Flow Sprint 1B entities
import { GrcEvidence } from '../grc/entities/grc-evidence.entity';
import { GrcIssue } from '../grc/entities/grc-issue.entity';
import { GrcControlTest } from '../grc/entities/grc-control-test.entity';
import { GrcTestResult } from '../grc/entities/grc-test-result.entity';
import { GrcControlEvidence } from '../grc/entities/grc-control-evidence.entity';
import { GrcEvidenceTestResult } from '../grc/entities/grc-evidence-test-result.entity';
import { GrcIssueEvidence } from '../grc/entities/grc-issue-evidence.entity';

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
      // Hash the demo password properly using bcrypt
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
        description: 'Maintain and test incident response procedures quarterly',
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
        description: 'Perform daily backups with weekly recovery testing',
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
        summary: 'Defines acceptable use of company IT resources and systems',
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
        summary: 'Defines data classification levels and handling requirements',
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
        summary: 'Defines requirements for managing access to systems and data',
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
        summary: 'Defines password requirements and authentication standards',
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
      {
        riskTitle: 'Ransomware Attack',
        controlCodes: ['CTL-002', 'CTL-005', 'CTL-006', 'CTL-007'],
      },
      {
        riskTitle: 'Data Breach via Third Party',
        controlCodes: ['CTL-001', 'CTL-002', 'CTL-003'],
      },
      {
        riskTitle: 'Insider Threat',
        controlCodes: ['CTL-001', 'CTL-004', 'CTL-008'],
      },
      {
        riskTitle: 'Cloud Misconfiguration',
        controlCodes: ['CTL-001', 'CTL-002', 'CTL-008'],
      },
      { riskTitle: 'Business Email Compromise', controlCodes: ['CTL-004'] },
      {
        riskTitle: 'Regulatory Non-Compliance',
        controlCodes: ['CTL-001', 'CTL-002', 'CTL-004', 'CTL-008'],
      },
      {
        riskTitle: 'System Availability Failure',
        controlCodes: ['CTL-005', 'CTL-007'],
      },
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
      {
        policyCode: 'POL-001',
        controlCodes: ['CTL-001', 'CTL-002', 'CTL-003', 'CTL-006'],
      },
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
      {
        framework: ComplianceFramework.ISO27001,
        refCode: 'A.5.1.1',
        controlCodes: ['CTL-001', 'CTL-004'],
      },
      {
        framework: ComplianceFramework.ISO27001,
        refCode: 'A.6.1.2',
        controlCodes: ['CTL-001', 'CTL-008'],
      },
      {
        framework: ComplianceFramework.ISO27001,
        refCode: 'A.9.2.3',
        controlCodes: ['CTL-001'],
      },
      {
        framework: ComplianceFramework.ISO27001,
        refCode: 'A.12.3.1',
        controlCodes: ['CTL-007'],
      },
      {
        framework: ComplianceFramework.SOC2,
        refCode: 'CC6.1',
        controlCodes: ['CTL-001', 'CTL-002', 'CTL-003'],
      },
      {
        framework: ComplianceFramework.SOC2,
        refCode: 'CC7.2',
        controlCodes: ['CTL-005', 'CTL-006'],
      },
      {
        framework: ComplianceFramework.GDPR,
        refCode: 'Art.32',
        controlCodes: ['CTL-002', 'CTL-003', 'CTL-006'],
      },
      {
        framework: ComplianceFramework.GDPR,
        refCode: 'Art.33',
        controlCodes: ['CTL-005'],
      },
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

    // 10. Seed Processes (Sprint 5)
    console.log('10. Seeding processes...');
    const processRepo = dataSource.getRepository(Process);
    const existingProcesses = await processRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const processesData = [
      {
        name: 'Change Management Process',
        code: 'CHG-MGMT',
        description:
          'Process for managing changes to IT systems and infrastructure',
        category: 'ITSM',
        ownerUserId: DEMO_ADMIN_ID,
        isActive: true,
      },
      {
        name: 'Incident Management Process',
        code: 'INC-MGMT',
        description: 'Process for handling and resolving IT incidents',
        category: 'ITSM',
        ownerUserId: DEMO_ADMIN_ID,
        isActive: true,
      },
      {
        name: 'Access Review Process',
        code: 'ACC-REV',
        description: 'Quarterly review of user access rights and permissions',
        category: 'Security',
        ownerUserId: DEMO_ADMIN_ID,
        isActive: true,
      },
      {
        name: 'Vendor Risk Assessment Process',
        code: 'VND-RISK',
        description:
          'Process for assessing and monitoring third-party vendor risks',
        category: 'Third Party',
        isActive: true,
      },
    ];

    const processes: Process[] = [];
    for (const data of processesData) {
      const existing = existingProcesses.find((p) => p.code === data.code);
      if (existing) {
        processes.push(existing);
      } else {
        const process = processRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await processRepo.save(process);
        processes.push(process);
        console.log(`   Created process: ${data.code} - ${data.name}`);
      }
    }

    // 11. Seed Process Controls (Sprint 5)
    console.log('11. Seeding process controls...');
    const processControlRepo = dataSource.getRepository(ProcessControl);
    const existingProcessControls = await processControlRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const processControlsData = [
      {
        processCode: 'CHG-MGMT',
        name: 'Change Request Approval',
        description:
          'Verify that all change requests have proper approval before implementation',
        isAutomated: false,
        method: ProcessControlMethod.WALKTHROUGH,
        frequency: ProcessControlFrequency.WEEKLY,
        expectedResultType: ControlResultType.BOOLEAN,
      },
      {
        processCode: 'CHG-MGMT',
        name: 'Change Testing Verification',
        description:
          'Verify that changes are tested in non-production environment before deployment',
        isAutomated: true,
        method: ProcessControlMethod.SCRIPT,
        frequency: ProcessControlFrequency.DAILY,
        expectedResultType: ControlResultType.BOOLEAN,
      },
      {
        processCode: 'INC-MGMT',
        name: 'Incident Response Time',
        description:
          'Measure average incident response time against SLA targets',
        isAutomated: true,
        method: ProcessControlMethod.SCRIPT,
        frequency: ProcessControlFrequency.DAILY,
        expectedResultType: ControlResultType.NUMERIC,
        parameters: { targetMinutes: 30, criticalTargetMinutes: 15 },
      },
      {
        processCode: 'INC-MGMT',
        name: 'Incident Root Cause Analysis',
        description:
          'Verify that root cause analysis is completed for all major incidents',
        isAutomated: false,
        method: ProcessControlMethod.SAMPLING,
        frequency: ProcessControlFrequency.WEEKLY,
        expectedResultType: ControlResultType.BOOLEAN,
      },
      {
        processCode: 'ACC-REV',
        name: 'Access Review Completion',
        description:
          'Verify that quarterly access reviews are completed on time',
        isAutomated: false,
        method: ProcessControlMethod.WALKTHROUGH,
        frequency: ProcessControlFrequency.QUARTERLY,
        expectedResultType: ControlResultType.BOOLEAN,
      },
      {
        processCode: 'ACC-REV',
        name: 'Orphaned Account Detection',
        description: 'Automated detection of accounts without active owners',
        isAutomated: true,
        method: ProcessControlMethod.SCRIPT,
        frequency: ProcessControlFrequency.WEEKLY,
        expectedResultType: ControlResultType.NUMERIC,
        parameters: { maxOrphanedAccounts: 0 },
      },
      {
        processCode: 'VND-RISK',
        name: 'Vendor Security Assessment',
        description:
          'Verify that all critical vendors have completed security assessments',
        isAutomated: false,
        method: ProcessControlMethod.INTERVIEW,
        frequency: ProcessControlFrequency.ANNUALLY,
        expectedResultType: ControlResultType.QUALITATIVE,
      },
    ];

    const processControls: ProcessControl[] = [];
    for (const data of processControlsData) {
      const process = processes.find((p) => p.code === data.processCode);
      if (!process) continue;

      const existing = existingProcessControls.find(
        (pc) => pc.processId === process.id && pc.name === data.name,
      );
      if (existing) {
        processControls.push(existing);
      } else {
        const { processCode, ...controlData } = data;
        const processControl = processControlRepo.create({
          ...controlData,
          processId: process.id,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await processControlRepo.save(processControl);
        processControls.push(processControl);
        console.log(
          `   Created process control: ${data.name} (${processCode})`,
        );
      }
    }

    // 12. Seed sample Control Results (Sprint 5)
    console.log('12. Seeding sample control results...');
    const controlResultRepo = dataSource.getRepository(ControlResult);
    const violationRepo = dataSource.getRepository(ProcessViolation);

    // Only seed if no results exist yet
    const existingResults = await controlResultRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
      take: 1,
    });

    if (existingResults.length === 0) {
      // Create some sample results for demonstration
      for (const control of processControls.slice(0, 4)) {
        // Create a compliant result
        const compliantResult = controlResultRepo.create({
          tenantId: DEMO_TENANT_ID,
          controlId: control.id,
          executionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          executorUserId: DEMO_ADMIN_ID,
          source: ControlResultSource.MANUAL,
          resultValueBoolean:
            control.expectedResultType === ControlResultType.BOOLEAN
              ? true
              : null,
          resultValueNumber:
            control.expectedResultType === ControlResultType.NUMERIC
              ? 25
              : null,
          resultValueText:
            control.expectedResultType === ControlResultType.QUALITATIVE
              ? 'Assessment completed successfully'
              : null,
          isCompliant: true,
          isDeleted: false,
        });
        await controlResultRepo.save(compliantResult);
        console.log(`   Created compliant result for: ${control.name}`);

        // Create a non-compliant result (which should trigger violation creation)
        const nonCompliantResult = controlResultRepo.create({
          tenantId: DEMO_TENANT_ID,
          controlId: control.id,
          executionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          executorUserId: DEMO_ADMIN_ID,
          source: ControlResultSource.MANUAL,
          resultValueBoolean:
            control.expectedResultType === ControlResultType.BOOLEAN
              ? false
              : null,
          resultValueNumber:
            control.expectedResultType === ControlResultType.NUMERIC
              ? 45
              : null,
          resultValueText:
            control.expectedResultType === ControlResultType.QUALITATIVE
              ? 'Issues found during assessment'
              : null,
          isCompliant: false,
          isDeleted: false,
        });
        await controlResultRepo.save(nonCompliantResult);
        console.log(`   Created non-compliant result for: ${control.name}`);

        // Create violation for non-compliant result
        const violation = violationRepo.create({
          tenantId: DEMO_TENANT_ID,
          controlId: control.id,
          controlResultId: nonCompliantResult.id,
          severity: ViolationSeverity.MEDIUM,
          status: ViolationStatus.OPEN,
          title: `Violation: ${control.name} - ${nonCompliantResult.executionDate.toISOString().split('T')[0]}`,
          description: `Non-compliant result recorded for control "${control.name}"`,
          isDeleted: false,
        });
        await violationRepo.save(violation);
        console.log(`   Created violation for: ${control.name}`);
      }
    } else {
      console.log('   Control results already exist, skipping...');
    }

    // 13. Seed Process-Only Control Example (Unified Control Library)
    console.log('13. Seeding process-only control example...');
    const controlProcessRepo = dataSource.getRepository(GrcControlProcess);

    // Create "Sales Order Management" process if it doesn't exist
    let salesProcess = await processRepo.findOne({
      where: { code: 'PRC-SALES-001', tenantId: DEMO_TENANT_ID },
    });

    if (!salesProcess) {
      salesProcess = processRepo.create({
        name: 'Sales Order Management',
        code: 'PRC-SALES-001',
        description:
          'End-to-end process for managing sales orders from creation to fulfillment',
        category: 'Sales',
        ownerUserId: DEMO_ADMIN_ID,
        isActive: true,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      });
      await processRepo.save(salesProcess);
      console.log('   Created process: PRC-SALES-001 - Sales Order Management');
    } else {
      console.log('   Sales Order Management process already exists');
    }

    // Create "Sales Approval Control" if it doesn't exist
    let salesControl = await controlRepo.findOne({
      where: { code: 'CTL-SALES-001', tenantId: DEMO_TENANT_ID },
    });

    if (!salesControl) {
      salesControl = controlRepo.create({
        name: 'Sales Approval Control',
        code: 'CTL-SALES-001',
        description:
          'Ensures all sales orders above threshold require manager approval before processing',
        type: ControlType.PREVENTIVE,
        implementationType: ControlImplementationType.MANUAL,
        status: ControlStatus.IMPLEMENTED,
        ownerUserId: DEMO_ADMIN_ID,
        tenantId: DEMO_TENANT_ID,
      });
      await controlRepo.save(salesControl);
      console.log('   Created control: CTL-SALES-001 - Sales Approval Control');
    } else {
      console.log('   Sales Approval Control already exists');
    }

    // Link control to process (process-only control - no requirement link)
    const existingLink = await controlProcessRepo.findOne({
      where: {
        controlId: salesControl.id,
        processId: salesProcess.id,
        tenantId: DEMO_TENANT_ID,
      },
    });

    if (!existingLink) {
      const controlProcessLink = controlProcessRepo.create({
        controlId: salesControl.id,
        processId: salesProcess.id,
        tenantId: DEMO_TENANT_ID,
        notes:
          'Process-only control example - not linked to any compliance requirement',
      });
      await controlProcessRepo.save(controlProcessLink);
      console.log(
        '   Linked CTL-SALES-001 to PRC-SALES-001 (process-only control)',
      );
    } else {
      console.log('   Control-process link already exists');
    }

    // ============================================
    // Golden Flow Sprint 1B: Evidence, Tests, Issues
    // ============================================

    // 12. Seed Evidence
    console.log('12. Seeding evidence records...');
    const evidenceRepo = dataSource.getRepository(GrcEvidence);
    const existingEvidence = await evidenceRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const evidenceData = [
      {
        name: 'Access Control Policy Document',
        description:
          'Official access control policy document approved by management',
        type: EvidenceType.DOCUMENT,
        sourceType: EvidenceSourceType.MANUAL,
        status: EvidenceStatus.APPROVED,
        location: '/documents/policies/access-control-policy-v2.pdf',
        collectedAt: new Date('2024-12-01'),
        collectedByUserId: DEMO_ADMIN_ID,
        tags: ['policy', 'access-control', 'approved'],
      },
      {
        name: 'Firewall Configuration Screenshot',
        description:
          'Screenshot of firewall rules showing network segmentation',
        type: EvidenceType.SCREENSHOT,
        sourceType: EvidenceSourceType.MANUAL,
        status: EvidenceStatus.APPROVED,
        location: '/evidence/screenshots/firewall-config-2024-12.png',
        collectedAt: new Date('2024-12-15'),
        collectedByUserId: DEMO_ADMIN_ID,
        tags: ['network', 'firewall', 'screenshot'],
      },
      {
        name: 'Security Training Completion Report',
        description:
          'Report showing all employees completed security awareness training',
        type: EvidenceType.DOCUMENT,
        sourceType: EvidenceSourceType.SYSTEM,
        status: EvidenceStatus.APPROVED,
        location: '/reports/training/security-awareness-2024-q4.pdf',
        collectedAt: new Date('2024-11-30'),
        tags: ['training', 'compliance', 'hr'],
      },
      {
        name: 'Vulnerability Scan Results',
        description: 'Monthly vulnerability scan results from security scanner',
        type: EvidenceType.LOG,
        sourceType: EvidenceSourceType.SYSTEM,
        status: EvidenceStatus.DRAFT,
        location: '/scans/vulnerability/scan-2024-12.json',
        externalUrl: 'https://scanner.example.com/reports/2024-12',
        collectedAt: new Date('2024-12-20'),
        tags: ['vulnerability', 'scan', 'security'],
      },
    ];

    const evidenceRecords: GrcEvidence[] = [];
    for (const data of evidenceData) {
      const existing = existingEvidence.find((e) => e.name === data.name);
      if (existing) {
        evidenceRecords.push(existing);
      } else {
        const evidence = evidenceRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await evidenceRepo.save(evidence);
        evidenceRecords.push(evidence);
        console.log(`   Created evidence: ${data.name}`);
      }
    }

    // 13. Seed Control Tests and Test Results
    console.log('13. Seeding control tests and test results...');
    const controlTestRepo = dataSource.getRepository(GrcControlTest);
    const testResultRepo = dataSource.getRepository(GrcTestResult);
    const existingControlTests = await controlTestRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    // Create control tests for the first two controls
    const controlTestsData = [
      {
        name: 'Access Control Policy Test Q4 2024',
        description: 'Quarterly test of access control policy implementation',
        controlId: controls[0].id, // Access Control Policy
        testType: ControlTestType.MANUAL,
        status: ControlTestStatus.COMPLETED,
        scheduledDate: new Date('2024-12-01'),
        startedAt: new Date('2024-12-05'),
        completedAt: new Date('2024-12-10'),
        testerUserId: DEMO_ADMIN_ID,
        testProcedure:
          'Review access control lists, verify least privilege, check access reviews',
        sampleSize: 50,
        populationSize: 200,
      },
      {
        name: 'Data Encryption Test Q4 2024',
        description: 'Quarterly test of data encryption at rest',
        controlId: controls[1].id, // Data Encryption at Rest
        testType: ControlTestType.AUTOMATED,
        status: ControlTestStatus.COMPLETED,
        scheduledDate: new Date('2024-12-01'),
        startedAt: new Date('2024-12-03'),
        completedAt: new Date('2024-12-03'),
        testerUserId: DEMO_ADMIN_ID,
        testProcedure:
          'Run automated encryption verification script on all databases',
        sampleSize: 100,
        populationSize: 100,
      },
      {
        name: 'Network Segmentation Test Q4 2024',
        description: 'Quarterly test of network segmentation controls',
        controlId: controls[2].id, // Network Segmentation
        testType: ControlTestType.MANUAL,
        status: ControlTestStatus.COMPLETED,
        scheduledDate: new Date('2024-12-01'),
        startedAt: new Date('2024-12-08'),
        completedAt: new Date('2024-12-12'),
        testerUserId: DEMO_ADMIN_ID,
        testProcedure:
          'Review firewall rules, test network isolation, verify VLAN configuration',
        sampleSize: 25,
        populationSize: 50,
      },
    ];

    const controlTests: GrcControlTest[] = [];
    const testResults: GrcTestResult[] = [];

    for (const data of controlTestsData) {
      const existing = existingControlTests.find((ct) => ct.name === data.name);
      if (existing) {
        controlTests.push(existing);
        // Find existing test result
        const existingResult = await testResultRepo.findOne({
          where: { controlTestId: existing.id, tenantId: DEMO_TENANT_ID },
        });
        if (existingResult) {
          testResults.push(existingResult);
        }
      } else {
        const controlTest = controlTestRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await controlTestRepo.save(controlTest);
        controlTests.push(controlTest);
        console.log(`   Created control test: ${data.name}`);

        // Create test result for completed tests
        if (data.status === ControlTestStatus.COMPLETED) {
          // Determine result based on control index (first two pass, third fails)
          const isPass = controlTestsData.indexOf(data) < 2;
          const testResult = testResultRepo.create({
            controlTestId: controlTest.id,
            tenantId: DEMO_TENANT_ID,
            result: isPass ? TestResultOutcome.PASS : TestResultOutcome.FAIL,
            resultDetails: isPass
              ? 'Control operating effectively with no exceptions noted'
              : 'Control partially implemented - gaps identified in network segmentation',
            exceptionsNoted: isPass
              ? null
              : 'DMZ not properly isolated from internal network',
            exceptionsCount: isPass ? 0 : 2,
            sampleTested: data.sampleSize,
            samplePassed: isPass
              ? data.sampleSize
              : Math.floor(data.sampleSize * 0.8),
            effectivenessRating: isPass
              ? EffectivenessRating.EFFECTIVE
              : EffectivenessRating.PARTIALLY_EFFECTIVE,
            recommendations: isPass
              ? 'Continue current control implementation'
              : 'Implement additional firewall rules to isolate DMZ',
            reviewedAt: new Date('2024-12-15'),
            reviewedByUserId: DEMO_ADMIN_ID,
            isDeleted: false,
          });
          await testResultRepo.save(testResult);
          testResults.push(testResult);
          console.log(
            `   Created test result: ${isPass ? 'PASS' : 'FAIL'} for ${data.name}`,
          );
        }
      }
    }

    // 14. Seed Issues
    console.log('14. Seeding issues...');
    const issueRepo = dataSource.getRepository(GrcIssue);
    const existingIssues = await issueRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
    });

    const issuesData = [
      {
        title: 'Network Segmentation Gap - DMZ Isolation',
        description:
          'During Q4 2024 testing, it was identified that the DMZ is not properly isolated from the internal network. This creates a potential attack vector.',
        type: IssueType.INTERNAL_AUDIT,
        status: IssueStatus.OPEN,
        severity: IssueSeverity.HIGH,
        controlId: controls[2].id, // Network Segmentation
        testResultId: testResults.length > 2 ? testResults[2].id : null,
        discoveredDate: new Date('2024-12-12'),
        dueDate: new Date('2025-01-31'),
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        title: 'Outdated Access Review Process',
        description:
          'Access reviews are not being conducted on schedule. Last review was 6 months ago instead of quarterly.',
        type: IssueType.SELF_ASSESSMENT,
        status: IssueStatus.IN_PROGRESS,
        severity: IssueSeverity.MEDIUM,
        controlId: controls[0].id, // Access Control Policy
        discoveredDate: new Date('2024-11-15'),
        dueDate: new Date('2025-02-28'),
        ownerUserId: DEMO_ADMIN_ID,
      },
      {
        title: 'Missing Encryption Key Rotation',
        description:
          'Encryption keys have not been rotated in the past 12 months, exceeding the 6-month rotation policy.',
        type: IssueType.EXTERNAL_AUDIT,
        status: IssueStatus.OPEN,
        severity: IssueSeverity.MEDIUM,
        controlId: controls[1].id, // Data Encryption at Rest
        discoveredDate: new Date('2024-12-20'),
        dueDate: new Date('2025-01-15'),
      },
    ];

    const issues: GrcIssue[] = [];
    for (const data of issuesData) {
      const existing = existingIssues.find((i) => i.title === data.title);
      if (existing) {
        issues.push(existing);
      } else {
        const issue = issueRepo.create({
          ...data,
          tenantId: DEMO_TENANT_ID,
          isDeleted: false,
        });
        await issueRepo.save(issue);
        issues.push(issue);
        console.log(`   Created issue: ${data.title}`);
      }
    }

    // 15. Create linkages for Golden Flow
    console.log('15. Creating Golden Flow linkages...');
    const controlEvidenceRepo = dataSource.getRepository(GrcControlEvidence);
    const evidenceTestResultRepo = dataSource.getRepository(
      GrcEvidenceTestResult,
    );
    const issueEvidenceRepo = dataSource.getRepository(GrcIssueEvidence);

    // Link evidence to controls
    const controlEvidenceLinks = [
      { controlId: controls[0].id, evidenceId: evidenceRecords[0].id }, // Access Control Policy -> Policy Document
      { controlId: controls[2].id, evidenceId: evidenceRecords[1].id }, // Network Segmentation -> Firewall Screenshot
      { controlId: controls[3].id, evidenceId: evidenceRecords[2].id }, // Security Training -> Training Report
      { controlId: controls[5].id, evidenceId: evidenceRecords[3].id }, // Vulnerability Management -> Scan Results
    ];

    for (const link of controlEvidenceLinks) {
      const existing = await controlEvidenceRepo.findOne({
        where: {
          controlId: link.controlId,
          evidenceId: link.evidenceId,
          tenantId: DEMO_TENANT_ID,
        },
      });
      if (!existing) {
        const controlEvidence = controlEvidenceRepo.create({
          ...link,
          tenantId: DEMO_TENANT_ID,
        });
        await controlEvidenceRepo.save(controlEvidence);
        console.log('   Linked evidence to control');
      }
    }

    // Link evidence to test results
    if (testResults.length > 0 && evidenceRecords.length > 0) {
      const evidenceTestResultLinks = [
        { evidenceId: evidenceRecords[0].id, testResultId: testResults[0].id }, // Policy Document -> Access Control Test
        {
          evidenceId: evidenceRecords[1].id,
          testResultId:
            testResults.length > 2 ? testResults[2].id : testResults[0].id,
        }, // Firewall Screenshot -> Network Test
      ];

      for (const link of evidenceTestResultLinks) {
        const existing = await evidenceTestResultRepo.findOne({
          where: {
            evidenceId: link.evidenceId,
            testResultId: link.testResultId,
            tenantId: DEMO_TENANT_ID,
          },
        });
        if (!existing) {
          const evidenceTestResult = evidenceTestResultRepo.create({
            ...link,
            tenantId: DEMO_TENANT_ID,
          });
          await evidenceTestResultRepo.save(evidenceTestResult);
          console.log('   Linked evidence to test result');
        }
      }
    }

    // Link evidence to issues
    if (issues.length > 0 && evidenceRecords.length > 1) {
      const issueEvidenceLinks = [
        { issueId: issues[0].id, evidenceId: evidenceRecords[1].id }, // DMZ Issue -> Firewall Screenshot
      ];

      for (const link of issueEvidenceLinks) {
        const existing = await issueEvidenceRepo.findOne({
          where: {
            issueId: link.issueId,
            evidenceId: link.evidenceId,
            tenantId: DEMO_TENANT_ID,
          },
        });
        if (!existing) {
          const issueEvidence = issueEvidenceRepo.create({
            ...link,
            tenantId: DEMO_TENANT_ID,
          });
          await issueEvidenceRepo.save(issueEvidence);
          console.log('   Linked evidence to issue');
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
    console.log(
      `  - Controls: ${controls.length + 1} (includes process-only control)`,
    );
    console.log(`  - Risks: ${risks.length}`);
    console.log(`  - Policies: ${policies.length}`);
    console.log(`  - Requirements: ${requirements.length}`);
    console.log(
      `  - Processes: ${processes.length + 1} (includes Sales Order Management)`,
    );
    console.log(`  - Process Controls: ${processControls.length}`);
    console.log(`  - Control-Process Links: 1 (process-only control example)`);
    console.log('');
    console.log('Golden Flow Sprint 1B Data:');
    console.log(`  - Evidence: ${evidenceRecords.length}`);
    console.log(`  - Control Tests: ${controlTests.length}`);
    console.log(`  - Test Results: ${testResults.length}`);
    console.log(`  - Issues: ${issues.length}`);
    console.log('');
    console.log('Golden Flow Chain Example:');
    console.log('  Control -> Evidence -> TestResult -> Issue');
    console.log('  - Control: CTL-003 (Network Segmentation)');
    console.log('  - Evidence: Firewall Configuration Screenshot');
    console.log('  - Test Result: Network Segmentation Test Q4 2024 (FAIL)');
    console.log('  - Issue: Network Segmentation Gap - DMZ Isolation');
    console.log('');
    console.log('To test the Golden Flow API:');
    console.log('  1. Start NestJS: cd backend-nest && npm run start:dev');
    console.log('  2. Login to get JWT token');
    console.log(`  3. Use x-tenant-id: ${DEMO_TENANT_ID} header`);
    console.log('  4. Call GET /grc/evidence, /grc/test-results, /grc/issues');
    console.log(
      '  5. Call GET /grc/evidence/:id/controls to see linked controls',
    );
    console.log(
      '  6. Call GET /grc/issues/:id/evidence to see linked evidence',
    );
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
