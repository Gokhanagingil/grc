process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SysChoice } from '../itsm/choice/sys-choice.entity';
import { CustomerRiskCatalog } from '../grc/entities/customer-risk-catalog.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ChoiceSeed {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
}

const CUSTOMER_RISK_CHOICES: ChoiceSeed[] = [
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'OS_LIFECYCLE', label: 'OS Lifecycle', sortOrder: 10 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'PATCHING', label: 'Patching', sortOrder: 20 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'BACKUP', label: 'Backup', sortOrder: 30 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'AVAILABILITY', label: 'Availability', sortOrder: 40 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'SECURITY_HARDENING', label: 'Security Hardening', sortOrder: 50 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'OPERATIONS_HYGIENE', label: 'Operations Hygiene', sortOrder: 60 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'MONITORING', label: 'Monitoring', sortOrder: 70 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'CERTIFICATE_MANAGEMENT', label: 'Certificate Management', sortOrder: 80 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'DATABASE_LIFECYCLE', label: 'Database Lifecycle', sortOrder: 90 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'VULNERABILITY_MANAGEMENT', label: 'Vulnerability Management', sortOrder: 100 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'GOVERNANCE', label: 'Governance', sortOrder: 110 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'SERVICE_MAPPING', label: 'Service Mapping', sortOrder: 120 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'CHANGE_MANAGEMENT', label: 'Change Management', sortOrder: 130 },
  { tableName: 'customer_risk_catalog', fieldName: 'category', value: 'SLA_COMPLIANCE', label: 'SLA Compliance', sortOrder: 140 },

  { tableName: 'customer_risk_catalog', fieldName: 'signalType', value: 'STATIC_FLAG', label: 'Static Flag', sortOrder: 10 },
  { tableName: 'customer_risk_catalog', fieldName: 'signalType', value: 'CMDB_HEALTH_RULE', label: 'CMDB Health Rule', sortOrder: 20 },
  { tableName: 'customer_risk_catalog', fieldName: 'signalType', value: 'ATTRIBUTE_MATCH', label: 'Attribute Match', sortOrder: 30 },
  { tableName: 'customer_risk_catalog', fieldName: 'signalType', value: 'AGE_THRESHOLD', label: 'Age Threshold', sortOrder: 40 },
  { tableName: 'customer_risk_catalog', fieldName: 'signalType', value: 'EXTERNAL_FEED_FLAG', label: 'External Feed Flag', sortOrder: 50 },

  { tableName: 'customer_risk_catalog', fieldName: 'severity', value: 'LOW', label: 'Low', sortOrder: 10 },
  { tableName: 'customer_risk_catalog', fieldName: 'severity', value: 'MEDIUM', label: 'Medium', sortOrder: 20 },
  { tableName: 'customer_risk_catalog', fieldName: 'severity', value: 'HIGH', label: 'High', sortOrder: 30 },
  { tableName: 'customer_risk_catalog', fieldName: 'severity', value: 'CRITICAL', label: 'Critical', sortOrder: 40 },

  { tableName: 'customer_risk_catalog', fieldName: 'scoreContributionModel', value: 'FLAT_POINTS', label: 'Flat Points', sortOrder: 10 },
  { tableName: 'customer_risk_catalog', fieldName: 'scoreContributionModel', value: 'WEIGHTED_FACTOR', label: 'Weighted Factor', sortOrder: 20 },
  { tableName: 'customer_risk_catalog', fieldName: 'scoreContributionModel', value: 'MULTIPLIER', label: 'Multiplier', sortOrder: 30 },

  { tableName: 'customer_risk_catalog', fieldName: 'status', value: 'ACTIVE', label: 'Active', sortOrder: 10 },
  { tableName: 'customer_risk_catalog', fieldName: 'status', value: 'INACTIVE', label: 'Inactive', sortOrder: 20 },
  { tableName: 'customer_risk_catalog', fieldName: 'status', value: 'DRAFT', label: 'Draft', sortOrder: 30 },

  { tableName: 'customer_risk_catalog', fieldName: 'source', value: 'MANUAL', label: 'Manual', sortOrder: 10 },
  { tableName: 'customer_risk_catalog', fieldName: 'source', value: 'IMPORTED', label: 'Imported', sortOrder: 20 },
  { tableName: 'customer_risk_catalog', fieldName: 'source', value: 'SYSTEM', label: 'System', sortOrder: 30 },

  { tableName: 'customer_risk_binding', fieldName: 'targetType', value: 'CI', label: 'Configuration Item', sortOrder: 10 },
  { tableName: 'customer_risk_binding', fieldName: 'targetType', value: 'CI_CLASS', label: 'CI Class', sortOrder: 20 },
  { tableName: 'customer_risk_binding', fieldName: 'targetType', value: 'CMDB_SERVICE', label: 'CMDB Service', sortOrder: 30 },
  { tableName: 'customer_risk_binding', fieldName: 'targetType', value: 'CMDB_OFFERING', label: 'CMDB Offering', sortOrder: 40 },
  { tableName: 'customer_risk_binding', fieldName: 'targetType', value: 'ITSM_SERVICE', label: 'ITSM Service', sortOrder: 50 },

  { tableName: 'customer_risk_binding', fieldName: 'scopeMode', value: 'DIRECT', label: 'Direct', sortOrder: 10 },
  { tableName: 'customer_risk_binding', fieldName: 'scopeMode', value: 'INHERITED', label: 'Inherited', sortOrder: 20 },

  { tableName: 'customer_risk_observation', fieldName: 'status', value: 'OPEN', label: 'Open', sortOrder: 10 },
  { tableName: 'customer_risk_observation', fieldName: 'status', value: 'ACKNOWLEDGED', label: 'Acknowledged', sortOrder: 20 },
  { tableName: 'customer_risk_observation', fieldName: 'status', value: 'WAIVED', label: 'Waived', sortOrder: 30 },
  { tableName: 'customer_risk_observation', fieldName: 'status', value: 'RESOLVED', label: 'Resolved', sortOrder: 40 },
  { tableName: 'customer_risk_observation', fieldName: 'status', value: 'EXPIRED', label: 'Expired', sortOrder: 50 },

  { tableName: 'customer_risk_observation', fieldName: 'evidenceType', value: 'MANUAL', label: 'Manual', sortOrder: 10 },
  { tableName: 'customer_risk_observation', fieldName: 'evidenceType', value: 'IMPORT', label: 'Import', sortOrder: 20 },
  { tableName: 'customer_risk_observation', fieldName: 'evidenceType', value: 'HEALTH_RULE', label: 'Health Rule', sortOrder: 30 },
  { tableName: 'customer_risk_observation', fieldName: 'evidenceType', value: 'CONNECTOR', label: 'Connector', sortOrder: 40 },
  { tableName: 'customer_risk_observation', fieldName: 'evidenceType', value: 'SYSTEM', label: 'System', sortOrder: 50 },
];

interface CatalogSeed {
  code: string;
  title: string;
  description: string;
  category: string;
  signalType: string;
  severity: string;
  likelihoodWeight: number;
  impactWeight: number;
  scoreContributionModel: string;
  scoreValue: number;
  rationale: string;
  remediationGuidance: string;
  tags: string[];
}

const STARTER_CATALOG: CatalogSeed[] = [
  {
    code: 'CRK-000001',
    title: 'OS End-of-Support',
    description: 'Operating system has reached end-of-support and no longer receives security patches from the vendor.',
    category: 'OS_LIFECYCLE',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'CRITICAL',
    likelihoodWeight: 90,
    impactWeight: 85,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 25,
    rationale: 'End-of-support operating systems are a critical risk because they no longer receive security updates, leaving known vulnerabilities unpatched and systems exposed to exploitation.',
    remediationGuidance: 'Plan and execute OS upgrade to a supported version. If immediate upgrade is not possible, implement compensating controls (network segmentation, enhanced monitoring, application whitelisting).',
    tags: ['os', 'lifecycle', 'eol', 'compliance'],
  },
  {
    code: 'CRK-000002',
    title: 'Critical Patch Overdue (>30 days)',
    description: 'One or more critical security patches have been available for more than 30 days without being applied.',
    category: 'PATCHING',
    signalType: 'AGE_THRESHOLD',
    severity: 'HIGH',
    likelihoodWeight: 80,
    impactWeight: 75,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 20,
    rationale: 'Unpatched critical vulnerabilities provide a known attack vector. The longer a patch is delayed, the higher the probability of exploitation as exploit code becomes widely available.',
    remediationGuidance: 'Prioritize patch deployment within the next maintenance window. Escalate to change management for emergency patching if exploits are actively used in the wild.',
    tags: ['patching', 'vulnerability', 'overdue'],
  },
  {
    code: 'CRK-000003',
    title: 'Endpoint Protection Agent Missing',
    description: 'The required endpoint protection / EDR agent is not installed or not reporting on this CI.',
    category: 'SECURITY_HARDENING',
    signalType: 'STATIC_FLAG',
    severity: 'HIGH',
    likelihoodWeight: 75,
    impactWeight: 70,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 18,
    rationale: 'Without endpoint protection, the system lacks a critical defense layer against malware, ransomware, and lateral movement by attackers.',
    remediationGuidance: 'Deploy the approved EDR/antivirus agent immediately. Verify agent health and reporting status in the security console after installation.',
    tags: ['endpoint', 'edr', 'agent', 'security'],
  },
  {
    code: 'CRK-000004',
    title: 'Backup Job Failed Recently',
    description: 'The most recent backup job for this CI/service has failed or has not completed successfully within the expected window.',
    category: 'BACKUP',
    signalType: 'CMDB_HEALTH_RULE',
    severity: 'HIGH',
    likelihoodWeight: 60,
    impactWeight: 85,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 18,
    rationale: 'Failed backups mean data loss risk in the event of system failure, ransomware, or corruption. Recovery capabilities are directly compromised.',
    remediationGuidance: 'Investigate and resolve backup failure. Verify backup integrity with a test restore. Ensure backup monitoring alerts are configured and reaching the responsible team.',
    tags: ['backup', 'data-protection', 'recovery'],
  },
  {
    code: 'CRK-000005',
    title: 'No Recent Restart Beyond Threshold',
    description: 'System has not been restarted beyond the configured threshold (e.g., 90+ days), indicating potential missed kernel/firmware patches.',
    category: 'OPERATIONS_HYGIENE',
    signalType: 'AGE_THRESHOLD',
    severity: 'MEDIUM',
    likelihoodWeight: 50,
    impactWeight: 45,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 10,
    rationale: 'Extended uptime often means kernel-level and firmware patches have not been applied, as many require a reboot. This creates a growing security debt.',
    remediationGuidance: 'Schedule a controlled restart during the next maintenance window. Verify all pending patches are applied during the restart cycle.',
    tags: ['uptime', 'reboot', 'ops-hygiene'],
  },
  {
    code: 'CRK-000006',
    title: 'Monitoring Disabled or Heartbeat Stale',
    description: 'Monitoring agent is disabled, or the last heartbeat is older than the configured staleness threshold.',
    category: 'MONITORING',
    signalType: 'CMDB_HEALTH_RULE',
    severity: 'HIGH',
    likelihoodWeight: 65,
    impactWeight: 60,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 15,
    rationale: 'Without active monitoring, incidents may go undetected for extended periods, increasing blast radius and mean time to detection/recovery.',
    remediationGuidance: 'Re-enable monitoring agent and verify heartbeat connectivity. Check firewall rules and agent configuration. Set up alerting for future heartbeat staleness.',
    tags: ['monitoring', 'heartbeat', 'observability'],
  },
  {
    code: 'CRK-000007',
    title: 'Single Point of Dependency (No Redundancy)',
    description: 'This CI represents a single point of failure with no configured redundancy, failover, or high-availability mechanism.',
    category: 'AVAILABILITY',
    signalType: 'STATIC_FLAG',
    severity: 'HIGH',
    likelihoodWeight: 55,
    impactWeight: 90,
    scoreContributionModel: 'WEIGHTED_FACTOR',
    scoreValue: 1.5,
    rationale: 'A single point of dependency means any failure directly impacts service availability with no automatic recovery path, creating unacceptable downtime risk for critical services.',
    remediationGuidance: 'Implement redundancy appropriate to the service tier (active-active, active-passive, or cold standby). Document failover procedures and test them regularly.',
    tags: ['spof', 'redundancy', 'availability', 'resilience'],
  },
  {
    code: 'CRK-000008',
    title: 'Certificate Nearing Expiry (<30 days)',
    description: 'A TLS/SSL certificate associated with this CI or service will expire within 30 days.',
    category: 'CERTIFICATE_MANAGEMENT',
    signalType: 'AGE_THRESHOLD',
    severity: 'HIGH',
    likelihoodWeight: 85,
    impactWeight: 70,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 18,
    rationale: 'Expired certificates cause immediate service outages for HTTPS endpoints, API integrations, and encrypted communications. They also trigger security warnings that erode user trust.',
    remediationGuidance: 'Renew the certificate immediately. If using automated certificate management (e.g., Let\'s Encrypt, ACME), verify the renewal pipeline. Update certificate stores and restart dependent services.',
    tags: ['certificate', 'tls', 'ssl', 'expiry'],
  },
  {
    code: 'CRK-000009',
    title: 'Unsupported Database Version',
    description: 'Database engine version is no longer supported by the vendor and does not receive security updates.',
    category: 'DATABASE_LIFECYCLE',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'CRITICAL',
    likelihoodWeight: 80,
    impactWeight: 85,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 22,
    rationale: 'Unsupported database versions carry known unpatched vulnerabilities and may lack compatibility with modern security tooling, creating significant data breach risk.',
    remediationGuidance: 'Plan database version upgrade. Test application compatibility with the target version. Execute upgrade during a planned maintenance window with verified rollback procedures.',
    tags: ['database', 'lifecycle', 'eol', 'upgrade'],
  },
  {
    code: 'CRK-000010',
    title: 'Vulnerability Scan Critical Findings Open',
    description: 'Vulnerability scanner has identified one or more critical severity findings that remain open/unresolved.',
    category: 'VULNERABILITY_MANAGEMENT',
    signalType: 'EXTERNAL_FEED_FLAG',
    severity: 'CRITICAL',
    likelihoodWeight: 85,
    impactWeight: 80,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 24,
    rationale: 'Open critical vulnerabilities are known exploitable weaknesses. Attackers actively scan for and exploit these findings, especially when public exploits exist.',
    remediationGuidance: 'Remediate critical findings per vulnerability management SLA. Apply patches, configuration changes, or compensating controls. Rescan to verify remediation effectiveness.',
    tags: ['vulnerability', 'scan', 'critical', 'findings'],
  },
  {
    code: 'CRK-000011',
    title: 'CMDB Owner Missing',
    description: 'This CI has no assigned owner or the owner assignment is stale (departed employee, disbanded team).',
    category: 'GOVERNANCE',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'MEDIUM',
    likelihoodWeight: 40,
    impactWeight: 55,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 10,
    rationale: 'CIs without clear ownership lack accountability for maintenance, patching, incident response, and change approval, leading to operational drift and increased risk.',
    remediationGuidance: 'Assign a responsible owner and owner group in the CMDB. Ensure the owner has appropriate access and is included in relevant notification channels.',
    tags: ['governance', 'ownership', 'cmdb', 'accountability'],
  },
  {
    code: 'CRK-000012',
    title: 'No Service Mapping / Orphan CI',
    description: 'This CI is not mapped to any business service or service offering in the CMDB.',
    category: 'SERVICE_MAPPING',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'MEDIUM',
    likelihoodWeight: 35,
    impactWeight: 50,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 8,
    rationale: 'Orphan CIs cannot be included in impact analysis, blast radius calculation, or service-aware change risk scoring, creating blind spots in operational governance.',
    remediationGuidance: 'Map the CI to its supporting business service(s) in the CMDB. If the CI is truly orphaned (no business purpose), evaluate for decommissioning.',
    tags: ['service-mapping', 'cmdb', 'orphan', 'governance'],
  },
  {
    code: 'CRK-000013',
    title: 'High Change Collision Zone',
    description: 'This CI or service has experienced a high volume of overlapping or closely-scheduled changes, increasing failure risk.',
    category: 'CHANGE_MANAGEMENT',
    signalType: 'CMDB_HEALTH_RULE',
    severity: 'MEDIUM',
    likelihoodWeight: 60,
    impactWeight: 55,
    scoreContributionModel: 'WEIGHTED_FACTOR',
    scoreValue: 1.3,
    rationale: 'High change density increases the probability of conflicts, regression, and difficulty in root cause analysis when incidents occur.',
    remediationGuidance: 'Review and coordinate change schedules. Implement change blackout windows for stabilization. Consider batching related changes into a single coordinated deployment.',
    tags: ['change', 'collision', 'scheduling', 'coordination'],
  },
  {
    code: 'CRK-000014',
    title: 'SLA Breach Trend Risk',
    description: 'Service availability or response metrics are trending toward SLA breach thresholds based on recent performance data.',
    category: 'SLA_COMPLIANCE',
    signalType: 'CMDB_HEALTH_RULE',
    severity: 'HIGH',
    likelihoodWeight: 70,
    impactWeight: 75,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 16,
    rationale: 'SLA breaches carry contractual, financial, and reputational consequences. Trending toward breach indicates systemic issues that require proactive intervention.',
    remediationGuidance: 'Analyze recent incidents and performance data to identify root causes. Implement targeted improvements (capacity, optimization, redundancy). Consider proactive customer communication.',
    tags: ['sla', 'performance', 'trend', 'compliance'],
  },
  {
    code: 'CRK-000015',
    title: 'Firewall Rules Overly Permissive',
    description: 'Network firewall rules for this CI allow overly broad access (e.g., 0.0.0.0/0 on sensitive ports).',
    category: 'SECURITY_HARDENING',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'HIGH',
    likelihoodWeight: 70,
    impactWeight: 75,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 17,
    rationale: 'Overly permissive firewall rules expand the attack surface unnecessarily, allowing potential unauthorized access from untrusted networks.',
    remediationGuidance: 'Review and tighten firewall rules to follow least-privilege principle. Restrict access to known IP ranges and required ports only. Document justification for any broad rules.',
    tags: ['firewall', 'network', 'security', 'hardening'],
  },
  {
    code: 'CRK-000016',
    title: 'Encryption at Rest Not Enabled',
    description: 'Data storage (disk, database, object store) does not have encryption at rest enabled.',
    category: 'SECURITY_HARDENING',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'HIGH',
    likelihoodWeight: 45,
    impactWeight: 80,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 16,
    rationale: 'Without encryption at rest, data is vulnerable to exposure through physical theft, unauthorized disk access, or improper decommissioning of storage media.',
    remediationGuidance: 'Enable encryption at rest using platform-native encryption (e.g., LUKS, BitLocker, AWS EBS encryption, Azure Disk Encryption). Verify key management procedures.',
    tags: ['encryption', 'data-protection', 'storage', 'compliance'],
  },
  {
    code: 'CRK-000017',
    title: 'Admin/Root Access Without MFA',
    description: 'Administrative or root-level access is configured without multi-factor authentication enforcement.',
    category: 'SECURITY_HARDENING',
    signalType: 'STATIC_FLAG',
    severity: 'CRITICAL',
    likelihoodWeight: 75,
    impactWeight: 90,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 23,
    rationale: 'Administrative accounts without MFA are prime targets for credential theft, brute force, and phishing attacks with maximum blast radius if compromised.',
    remediationGuidance: 'Enforce MFA for all administrative and privileged access. Implement conditional access policies. Audit and remove any bypass exceptions.',
    tags: ['mfa', 'admin', 'authentication', 'privileged-access'],
  },
  {
    code: 'CRK-000018',
    title: 'Disaster Recovery Plan Not Tested',
    description: 'The disaster recovery plan for this service/CI has not been tested within the required timeframe (e.g., 12 months).',
    category: 'AVAILABILITY',
    signalType: 'AGE_THRESHOLD',
    severity: 'MEDIUM',
    likelihoodWeight: 40,
    impactWeight: 85,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 14,
    rationale: 'Untested disaster recovery plans may not work when needed, leading to extended outages and data loss during actual disaster scenarios.',
    remediationGuidance: 'Schedule and execute a DR test. Document test results, recovery time, and any gaps identified. Update the DR plan based on findings.',
    tags: ['dr', 'disaster-recovery', 'testing', 'resilience'],
  },
  {
    code: 'CRK-000019',
    title: 'Configuration Drift Detected',
    description: 'The actual system configuration has drifted from the approved baseline configuration.',
    category: 'OPERATIONS_HYGIENE',
    signalType: 'CMDB_HEALTH_RULE',
    severity: 'MEDIUM',
    likelihoodWeight: 55,
    impactWeight: 50,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 11,
    rationale: 'Configuration drift can introduce security vulnerabilities, compliance violations, and unpredictable behavior that complicates troubleshooting and change management.',
    remediationGuidance: 'Run a configuration compliance scan. Remediate drift by reapplying the approved baseline. Investigate the source of drift (manual changes, failed automation).',
    tags: ['configuration', 'drift', 'baseline', 'compliance'],
  },
  {
    code: 'CRK-000020',
    title: 'High Privilege Service Account',
    description: 'A service account with elevated privileges is running on this CI without proper controls (rotation, monitoring).',
    category: 'SECURITY_HARDENING',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'HIGH',
    likelihoodWeight: 60,
    impactWeight: 80,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 17,
    rationale: 'Unmanaged high-privilege service accounts are a common attack vector for lateral movement and privilege escalation in enterprise environments.',
    remediationGuidance: 'Implement least-privilege for service accounts. Enable credential rotation. Monitor service account activity. Use managed identities where possible.',
    tags: ['service-account', 'privilege', 'credential', 'security'],
  },
  {
    code: 'CRK-000021',
    title: 'Log Forwarding Disabled',
    description: 'Security and application logs are not being forwarded to the centralized SIEM/log management platform.',
    category: 'MONITORING',
    signalType: 'STATIC_FLAG',
    severity: 'MEDIUM',
    likelihoodWeight: 50,
    impactWeight: 60,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 12,
    rationale: 'Without centralized log forwarding, security incidents cannot be correlated, detected, or investigated effectively, and compliance audit requirements may not be met.',
    remediationGuidance: 'Configure log forwarding to the approved SIEM platform. Verify log ingestion and parsing. Ensure retention policies meet compliance requirements.',
    tags: ['logging', 'siem', 'monitoring', 'compliance'],
  },
  {
    code: 'CRK-000022',
    title: 'Capacity Threshold Exceeded (>85%)',
    description: 'Resource utilization (CPU, memory, disk, or network) consistently exceeds 85% capacity.',
    category: 'AVAILABILITY',
    signalType: 'CMDB_HEALTH_RULE',
    severity: 'MEDIUM',
    likelihoodWeight: 65,
    impactWeight: 60,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 12,
    rationale: 'Systems operating near capacity have reduced ability to handle traffic spikes and are more susceptible to performance degradation and outages.',
    remediationGuidance: 'Analyze resource consumption trends. Scale resources vertically or horizontally. Optimize application performance. Set up proactive capacity alerts.',
    tags: ['capacity', 'performance', 'scaling', 'availability'],
  },
  {
    code: 'CRK-000023',
    title: 'Third-Party Component End-of-Life',
    description: 'A critical third-party component (middleware, runtime, framework) has reached end-of-life status.',
    category: 'OS_LIFECYCLE',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'HIGH',
    likelihoodWeight: 70,
    impactWeight: 70,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 16,
    rationale: 'End-of-life components stop receiving security patches and compatibility updates, creating growing technical debt and security exposure.',
    remediationGuidance: 'Plan migration to a supported version. Assess breaking changes and test application compatibility. Implement compensating controls during the migration period.',
    tags: ['eol', 'third-party', 'middleware', 'lifecycle'],
  },
  {
    code: 'CRK-000024',
    title: 'Non-Compliant Password Policy',
    description: 'Password policy on this CI does not meet organizational or regulatory requirements.',
    category: 'SECURITY_HARDENING',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'MEDIUM',
    likelihoodWeight: 55,
    impactWeight: 60,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 12,
    rationale: 'Weak password policies increase the risk of successful brute force and credential stuffing attacks.',
    remediationGuidance: 'Update password policy to meet organizational standards (length, complexity, rotation). Enforce policy through Group Policy, PAM, or identity provider configuration.',
    tags: ['password', 'policy', 'compliance', 'authentication'],
  },
  {
    code: 'CRK-000025',
    title: 'Unnecessary Network Services Running',
    description: 'Non-essential network services or ports are active on this CI, expanding the attack surface.',
    category: 'SECURITY_HARDENING',
    signalType: 'ATTRIBUTE_MATCH',
    severity: 'LOW',
    likelihoodWeight: 40,
    impactWeight: 45,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 7,
    rationale: 'Each unnecessary running service is a potential attack vector. Minimizing the attack surface is a fundamental security hardening principle.',
    remediationGuidance: 'Disable or remove unnecessary services. Close unused network ports. Document the business justification for each enabled service.',
    tags: ['services', 'ports', 'attack-surface', 'hardening'],
  },
  {
    code: 'CRK-000026',
    title: 'Antivirus Definitions Outdated (>7 days)',
    description: 'Antivirus/antimalware signature definitions are more than 7 days out of date.',
    category: 'SECURITY_HARDENING',
    signalType: 'AGE_THRESHOLD',
    severity: 'MEDIUM',
    likelihoodWeight: 55,
    impactWeight: 55,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 11,
    rationale: 'Outdated antivirus signatures reduce detection capability for recent malware variants, leaving the system vulnerable to known threats.',
    remediationGuidance: 'Force an immediate signature update. Investigate why automatic updates are failing. Verify connectivity to the update server and agent health.',
    tags: ['antivirus', 'signatures', 'malware', 'updates'],
  },
  {
    code: 'CRK-000027',
    title: 'No Incident Response Runbook',
    description: 'This service lacks a documented incident response runbook or operational playbook.',
    category: 'OPERATIONS_HYGIENE',
    signalType: 'STATIC_FLAG',
    severity: 'LOW',
    likelihoodWeight: 30,
    impactWeight: 55,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 7,
    rationale: 'Without documented incident response procedures, MTTR increases as responders must improvise, leading to longer outages and inconsistent handling.',
    remediationGuidance: 'Create an incident response runbook covering common failure scenarios, escalation paths, recovery procedures, and communication templates.',
    tags: ['runbook', 'incident-response', 'documentation', 'ops'],
  },
  {
    code: 'CRK-000028',
    title: 'Stale CMDB Data (>90 days since last update)',
    description: 'CMDB record for this CI has not been updated in over 90 days, raising data accuracy concerns.',
    category: 'GOVERNANCE',
    signalType: 'AGE_THRESHOLD',
    severity: 'LOW',
    likelihoodWeight: 35,
    impactWeight: 40,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 6,
    rationale: 'Stale CMDB data leads to inaccurate impact analysis, incorrect change risk scoring, and unreliable service mapping.',
    remediationGuidance: 'Run discovery scan or manual verification. Update CI attributes to reflect current state. Establish a periodic CMDB review cadence.',
    tags: ['cmdb', 'data-quality', 'staleness', 'governance'],
  },
  {
    code: 'CRK-000029',
    title: 'Missing Compliance Attestation',
    description: 'Required compliance attestation (SOC2, ISO 27001, PCI-DSS) is missing or expired for this service component.',
    category: 'GOVERNANCE',
    signalType: 'STATIC_FLAG',
    severity: 'HIGH',
    likelihoodWeight: 45,
    impactWeight: 75,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 15,
    rationale: 'Missing compliance attestation may result in audit findings, regulatory penalties, and loss of customer trust. It may also block procurement and partnerships.',
    remediationGuidance: 'Initiate compliance assessment. Gather required evidence and documentation. Engage internal audit or external assessor to complete attestation.',
    tags: ['compliance', 'attestation', 'audit', 'regulatory'],
  },
  {
    code: 'CRK-000030',
    title: 'Shared Credential Usage Detected',
    description: 'Multiple users or systems are sharing the same credential to access this CI.',
    category: 'SECURITY_HARDENING',
    signalType: 'STATIC_FLAG',
    severity: 'HIGH',
    likelihoodWeight: 60,
    impactWeight: 70,
    scoreContributionModel: 'FLAT_POINTS',
    scoreValue: 16,
    rationale: 'Shared credentials eliminate accountability, make it impossible to attribute actions to individuals, and increase the blast radius of credential compromise.',
    remediationGuidance: 'Create individual credentials for each user/system. Implement a secrets management solution. Rotate the shared credential immediately and decommission it after migration.',
    tags: ['credentials', 'shared-access', 'accountability', 'security'],
  },
];

async function seedCustomerRiskCatalog() {
  console.log('Starting Customer Risk Catalog seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    const choiceRepo = dataSource.getRepository(SysChoice);
    const catalogRepo = dataSource.getRepository(CustomerRiskCatalog);

    let choicesCreated = 0;
    let choicesSkipped = 0;

    for (const choice of CUSTOMER_RISK_CHOICES) {
      const existing = await choiceRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          tableName: choice.tableName,
          fieldName: choice.fieldName,
          value: choice.value,
        },
      });

      if (existing) {
        choicesSkipped++;
        continue;
      }

      const entity = choiceRepo.create({
        tenantId: DEMO_TENANT_ID,
        tableName: choice.tableName,
        fieldName: choice.fieldName,
        value: choice.value,
        label: choice.label,
        sortOrder: choice.sortOrder,
        isActive: true,
        parentValue: null,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await choiceRepo.save(entity);
      choicesCreated++;
    }

    console.log(`Choices: ${choicesCreated} created, ${choicesSkipped} skipped`);

    let catalogCreated = 0;
    let catalogSkipped = 0;

    for (const item of STARTER_CATALOG) {
      const existing = await catalogRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          code: item.code,
        },
      });

      if (existing) {
        catalogSkipped++;
        continue;
      }

      const entity = catalogRepo.create({
        tenantId: DEMO_TENANT_ID,
        code: item.code,
        title: item.title,
        description: item.description,
        category: item.category,
        signalType: item.signalType,
        severity: item.severity,
        likelihoodWeight: item.likelihoodWeight,
        impactWeight: item.impactWeight,
        scoreContributionModel: item.scoreContributionModel,
        scoreValue: item.scoreValue,
        status: 'ACTIVE',
        source: 'SYSTEM',
        rationale: item.rationale,
        remediationGuidance: item.remediationGuidance,
        tags: item.tags,
        isDeleted: false,
        createdBy: DEMO_ADMIN_ID,
      });
      await catalogRepo.save(entity);
      catalogCreated++;
    }

    console.log(`Catalog: ${catalogCreated} created, ${catalogSkipped} skipped`);
    console.log(`\nSeed complete. Total choices: ${CUSTOMER_RISK_CHOICES.length}, Total catalog: ${STARTER_CATALOG.length}`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedCustomerRiskCatalog();
