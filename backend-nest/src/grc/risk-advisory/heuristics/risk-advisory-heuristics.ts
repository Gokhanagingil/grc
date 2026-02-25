import { Injectable } from '@nestjs/common';
import {
  RiskTheme,
  SuggestedRecordType,
  MitigationTimeframe,
  MitigationAction,
  SuggestedRecord,
  ExplainabilityEntry,
  AdvisoryResult,
  AffectedServiceInfo,
  TopologyImpactSummary,
} from '../dto/advisory.dto';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Theme Classification
// ============================================================================

interface ThemePattern {
  theme: RiskTheme;
  keywords: string[];
  categoryPatterns: string[];
  weight: number;
}

const THEME_PATTERNS: ThemePattern[] = [
  {
    theme: RiskTheme.PATCHING,
    keywords: [
      'patch', 'update', 'upgrade', 'hotfix', 'security update',
      'firmware', 'version', 'outdated', 'unpatched', 'cve',
    ],
    categoryPatterns: ['technology', 'operational'],
    weight: 10,
  },
  {
    theme: RiskTheme.ACCESS,
    keywords: [
      'access', 'permission', 'privilege', 'authentication', 'authorization',
      'password', 'credential', 'mfa', 'multi-factor', 'rbac', 'iam',
      'login', 'session', 'token', 'sso', 'ldap', 'active directory',
    ],
    categoryPatterns: ['compliance', 'technology'],
    weight: 10,
  },
  {
    theme: RiskTheme.BACKUP,
    keywords: [
      'backup', 'restore', 'recovery', 'disaster', 'dr', 'rpo', 'rto',
      'data loss', 'replication', 'failover', 'continuity',
    ],
    categoryPatterns: ['operational', 'technology'],
    weight: 10,
  },
  {
    theme: RiskTheme.END_OF_SUPPORT,
    keywords: [
      'end of life', 'eol', 'end of support', 'eos', 'deprecated',
      'legacy', 'unsupported', 'obsolete', 'sunset',
    ],
    categoryPatterns: ['technology'],
    weight: 10,
  },
  {
    theme: RiskTheme.VULNERABILITY,
    keywords: [
      'vulnerability', 'vuln', 'exploit', 'threat', 'malware',
      'ransomware', 'injection', 'xss', 'csrf', 'sql injection',
      'penetration', 'pentest', 'scan', 'weakness',
    ],
    categoryPatterns: ['technology', 'compliance'],
    weight: 10,
  },
  {
    theme: RiskTheme.CERTIFICATE,
    keywords: [
      'certificate', 'cert', 'ssl', 'tls', 'https', 'x509',
      'expir', 'renewal', 'ca', 'pki',
    ],
    categoryPatterns: ['technology'],
    weight: 10,
  },
  {
    theme: RiskTheme.NETWORK_EXPOSURE,
    keywords: [
      'network', 'firewall', 'port', 'exposure', 'open port',
      'dmz', 'segmentation', 'lateral', 'perimeter', 'ingress',
      'egress', 'vpn', 'proxy',
    ],
    categoryPatterns: ['technology'],
    weight: 10,
  },
  {
    theme: RiskTheme.CONFIGURATION,
    keywords: [
      'configuration', 'config', 'misconfiguration', 'hardening',
      'baseline', 'drift', 'setting', 'parameter',
    ],
    categoryPatterns: ['technology', 'operational'],
    weight: 8,
  },
  {
    theme: RiskTheme.COMPLIANCE,
    keywords: [
      'compliance', 'regulation', 'audit', 'standard', 'iso',
      'gdpr', 'hipaa', 'sox', 'pci', 'nist', 'policy violation',
      'non-compliance', 'finding',
    ],
    categoryPatterns: ['compliance'],
    weight: 8,
  },
  {
    theme: RiskTheme.AVAILABILITY,
    keywords: [
      'availability', 'uptime', 'downtime', 'outage', 'sla',
      'redundancy', 'high availability', 'ha', 'cluster',
      'load balancer', 'capacity',
    ],
    categoryPatterns: ['operational'],
    weight: 8,
  },
  {
    theme: RiskTheme.DATA_PROTECTION,
    keywords: [
      'data protection', 'encryption', 'privacy', 'pii',
      'personal data', 'data leak', 'data breach', 'classification',
      'dlp', 'masking', 'anonymization',
    ],
    categoryPatterns: ['compliance', 'technology'],
    weight: 8,
  },
];

// ============================================================================
// Mitigation Templates per Theme
// ============================================================================

interface MitigationTemplate {
  title: string;
  description: string;
  timeframe: MitigationTimeframe;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedRecordType: SuggestedRecordType;
  templateData: Record<string, unknown>;
}

const MITIGATION_TEMPLATES: Record<RiskTheme, MitigationTemplate[]> = {
  [RiskTheme.PATCHING]: [
    {
      title: 'Emergency Patch Assessment',
      description: 'Assess the scope and impact of required patches. Identify affected systems and create a patch schedule.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Security patch deployment' },
    },
    {
      title: 'Patch Rollout Change Request',
      description: 'Create a change request for deploying patches to affected systems with proper testing and rollback plan.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Patch rollout' },
    },
    {
      title: 'Backup Verification Before Patching',
      description: 'Verify that current backups are complete and restorable before applying patches.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Rollback Plan Task',
      description: 'Document and validate the rollback procedure in case patch deployment fails.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Post-Patch Verification Test',
      description: 'Verify that systems function correctly after patch deployment. Test critical functionality.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.ACCESS]: [
    {
      title: 'Access Review Task',
      description: 'Conduct a comprehensive review of user access rights and permissions for affected systems.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Access Control Verification Test',
      description: 'Test that access controls are properly enforced. Verify least-privilege principle is applied.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
    {
      title: 'Access Configuration Change',
      description: 'Implement required access control changes (e.g., MFA enforcement, role updates, permission tightening).',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Access control remediation' },
    },
    {
      title: 'Access Control Policy CAPA',
      description: 'Create corrective action to update access control policies and procedures.',
      timeframe: MitigationTimeframe.PERMANENT,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'CORRECTIVE' },
    },
  ],
  [RiskTheme.BACKUP]: [
    {
      title: 'Backup Restore Test',
      description: 'Perform a restore test to verify backup integrity and recovery procedures.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
    {
      title: 'Evidence Request: Backup Verification',
      description: 'Request evidence of successful backup completion and retention compliance.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Backup Process CAPA',
      description: 'Corrective action to improve backup procedures, frequency, or coverage.',
      timeframe: MitigationTimeframe.PERMANENT,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'CORRECTIVE' },
    },
  ],
  [RiskTheme.END_OF_SUPPORT]: [
    {
      title: 'EOL System Inventory Task',
      description: 'Document all systems and components affected by end-of-support status.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Migration/Upgrade Change Request',
      description: 'Plan and execute migration from end-of-support systems to supported versions.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'EOL system migration' },
    },
    {
      title: 'Compensating Controls Verification',
      description: 'Verify compensating controls are in place until migration is complete.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.VULNERABILITY]: [
    {
      title: 'Vulnerability Assessment Task',
      description: 'Conduct vulnerability scan and assessment of affected systems.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Vulnerability Remediation Change',
      description: 'Implement fixes for identified vulnerabilities.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Vulnerability remediation' },
    },
    {
      title: 'Vulnerability Management CAPA',
      description: 'Corrective action to improve vulnerability management processes.',
      timeframe: MitigationTimeframe.PERMANENT,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'CORRECTIVE' },
    },
    {
      title: 'Post-Remediation Verification',
      description: 'Verify vulnerabilities are remediated and no new issues introduced.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.CERTIFICATE]: [
    {
      title: 'Certificate Inventory Task',
      description: 'Inventory all certificates, their expiration dates, and renewal requirements.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Certificate Renewal Change',
      description: 'Renew or replace certificates that are expired or expiring soon.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'STANDARD', justification: 'Certificate renewal' },
    },
    {
      title: 'Certificate Monitoring CAPA',
      description: 'Implement automated certificate expiration monitoring.',
      timeframe: MitigationTimeframe.PERMANENT,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'PREVENTIVE' },
    },
  ],
  [RiskTheme.NETWORK_EXPOSURE]: [
    {
      title: 'Network Exposure Assessment',
      description: 'Assess network exposure, open ports, and firewall rules.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Firewall/Network Change',
      description: 'Implement network segmentation or firewall rule changes to reduce exposure.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Network security hardening' },
    },
    {
      title: 'Network Security Verification',
      description: 'Verify network controls are effective after changes.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.CONFIGURATION]: [
    {
      title: 'Configuration Baseline Review',
      description: 'Review current configuration against security baselines and best practices.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Configuration Hardening Change',
      description: 'Apply configuration hardening based on review findings.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Configuration hardening' },
    },
    {
      title: 'Configuration Compliance Test',
      description: 'Test configuration compliance after changes.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.COMPLIANCE]: [
    {
      title: 'Compliance Gap Analysis',
      description: 'Analyze compliance gaps and identify required remediation actions.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Compliance Remediation CAPA',
      description: 'Corrective action to address compliance findings.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'CORRECTIVE' },
    },
    {
      title: 'Compliance Control Verification',
      description: 'Verify compliance controls are operating effectively.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.AVAILABILITY]: [
    {
      title: 'Availability Assessment Task',
      description: 'Assess current availability controls and identify single points of failure.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Redundancy/HA Change',
      description: 'Implement redundancy or high availability improvements.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Availability improvement' },
    },
    {
      title: 'Availability CAPA',
      description: 'Preventive action to improve availability processes and monitoring.',
      timeframe: MitigationTimeframe.PERMANENT,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'PREVENTIVE' },
    },
  ],
  [RiskTheme.DATA_PROTECTION]: [
    {
      title: 'Data Classification Review',
      description: 'Review data classification and protection requirements for affected data.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Data Protection Change',
      description: 'Implement data protection controls (encryption, DLP, access restrictions).',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Data protection enhancement' },
    },
    {
      title: 'Data Protection Verification',
      description: 'Verify data protection controls are effective.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'HIGH',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
  [RiskTheme.GENERAL]: [
    {
      title: 'Risk Assessment Task',
      description: 'Conduct a detailed assessment of the identified risk and its potential impact.',
      timeframe: MitigationTimeframe.IMMEDIATE,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.TASK,
      templateData: {},
    },
    {
      title: 'Risk Mitigation Change',
      description: 'Implement mitigation measures identified during risk assessment.',
      timeframe: MitigationTimeframe.SHORT_TERM,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CHANGE,
      templateData: { type: 'NORMAL', justification: 'Risk mitigation' },
    },
    {
      title: 'Risk Treatment CAPA',
      description: 'Corrective/preventive action to address the root cause of the risk.',
      timeframe: MitigationTimeframe.PERMANENT,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CAPA,
      templateData: { type: 'CORRECTIVE' },
    },
    {
      title: 'Control Effectiveness Verification',
      description: 'Verify that mitigation controls are effective.',
      timeframe: MitigationTimeframe.VERIFICATION,
      priority: 'MEDIUM',
      suggestedRecordType: SuggestedRecordType.CONTROL_TEST,
      templateData: { testType: 'PERIODIC' },
    },
  ],
};

// ============================================================================
// Heuristics Service
// ============================================================================

export interface RiskContext {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  likelihood: string;
  impact: string;
  status: string;
  inherentScore: number | null;
  residualScore: number | null;
  linkedControls: Array<{
    id: string;
    name: string;
    code: string | null;
    status: string;
    effectivenessPercent?: number;
  }>;
  linkedPolicies: Array<{
    id: string;
    name: string;
    code: string | null;
    status: string;
  }>;
}

export interface CmdbContext {
  affectedCis: AffectedServiceInfo[];
  affectedServices: AffectedServiceInfo[];
  topologyImpact: TopologyImpactSummary | null;
}

@Injectable()
export class RiskAdvisoryHeuristics {
  /**
   * Classify the risk theme from title, description, and category.
   * Returns the best-matching theme with explainability entries.
   */
  classifyTheme(
    title: string,
    description: string | null,
    category: string | null,
  ): { theme: RiskTheme; explainability: ExplainabilityEntry[] } {
    const text = `${title} ${description || ''}`.toLowerCase();
    const categoryLower = (category || '').toLowerCase();
    const explainability: ExplainabilityEntry[] = [];

    const scores: Map<RiskTheme, number> = new Map();

    for (const pattern of THEME_PATTERNS) {
      let score = 0;

      // Keyword matching
      const matchedKeywords: string[] = [];
      for (const keyword of pattern.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += pattern.weight;
          matchedKeywords.push(keyword);
        }
      }

      // Category matching
      if (
        categoryLower &&
        pattern.categoryPatterns.some((cp) =>
          categoryLower.includes(cp.toLowerCase()),
        )
      ) {
        score += 3;
      }

      if (score > 0) {
        scores.set(pattern.theme, score);
        if (matchedKeywords.length > 0) {
          explainability.push({
            signal: `Keyword match: ${matchedKeywords.join(', ')}`,
            source: 'risk_text_analysis',
            contribution: `Theme ${pattern.theme} scored ${score} points`,
            detail: `Matched ${matchedKeywords.length} keyword(s) in risk title/description`,
          });
        }
      }
    }

    // Find the highest scoring theme
    let bestTheme = RiskTheme.GENERAL;
    let bestScore = 0;

    scores.forEach((score, theme) => {
      if (score > bestScore) {
        bestScore = score;
        bestTheme = theme;
      }
    });

    if (bestScore === 0) {
      explainability.push({
        signal: 'No strong keyword match found',
        source: 'risk_text_analysis',
        contribution: 'Defaulting to GENERAL theme',
        detail: 'Risk text did not match any specific theme patterns',
      });
    }

    return { theme: bestTheme, explainability };
  }

  /**
   * Generate mitigation suggestions based on theme and context.
   */
  generateMitigationPlan(
    theme: RiskTheme,
    riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
  ): {
    immediateActions: MitigationAction[];
    shortTermActions: MitigationAction[];
    permanentActions: MitigationAction[];
    verificationSteps: MitigationAction[];
  } {
    const templates = MITIGATION_TEMPLATES[theme] || MITIGATION_TEMPLATES[RiskTheme.GENERAL];

    const immediateActions: MitigationAction[] = [];
    const shortTermActions: MitigationAction[] = [];
    const permanentActions: MitigationAction[] = [];
    const verificationSteps: MitigationAction[] = [];

    for (const template of templates) {
      const action: MitigationAction = {
        id: uuidv4(),
        title: this.contextualizeTitle(template.title, riskContext),
        description: this.contextualizeDescription(
          template.description,
          riskContext,
          cmdbContext,
        ),
        timeframe: template.timeframe,
        priority: this.adjustPriority(template.priority, riskContext),
        suggestedRecordType: template.suggestedRecordType,
        templateData: { ...template.templateData },
      };

      switch (template.timeframe) {
        case MitigationTimeframe.IMMEDIATE:
          immediateActions.push(action);
          break;
        case MitigationTimeframe.SHORT_TERM:
          shortTermActions.push(action);
          break;
        case MitigationTimeframe.PERMANENT:
          permanentActions.push(action);
          break;
        case MitigationTimeframe.VERIFICATION:
          verificationSteps.push(action);
          break;
      }
    }

    return { immediateActions, shortTermActions, permanentActions, verificationSteps };
  }

  /**
   * Build suggested records from mitigation plan.
   */
  buildSuggestedRecords(mitigationPlan: {
    immediateActions: MitigationAction[];
    shortTermActions: MitigationAction[];
    permanentActions: MitigationAction[];
    verificationSteps: MitigationAction[];
  }): SuggestedRecord[] {
    const allActions = [
      ...mitigationPlan.immediateActions,
      ...mitigationPlan.shortTermActions,
      ...mitigationPlan.permanentActions,
      ...mitigationPlan.verificationSteps,
    ];

    return allActions.map((action) => ({
      id: action.id,
      type: action.suggestedRecordType,
      title: action.title,
      description: action.description,
      priority: action.priority,
      timeframe: action.timeframe,
      templateData: action.templateData,
    }));
  }

  /**
   * Calculate confidence score based on available context.
   */
  calculateConfidence(
    riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
    themeScore: number,
  ): { confidence: number; explainability: ExplainabilityEntry[] } {
    let confidence = 30; // Base confidence for deterministic heuristics
    const explainability: ExplainabilityEntry[] = [];

    // Theme classification quality
    if (themeScore > 20) {
      confidence += 15;
      explainability.push({
        signal: 'Strong theme classification',
        source: 'theme_analysis',
        contribution: '+15% confidence',
        detail: `Theme score: ${themeScore}`,
      });
    } else if (themeScore > 10) {
      confidence += 10;
      explainability.push({
        signal: 'Moderate theme classification',
        source: 'theme_analysis',
        contribution: '+10% confidence',
      });
    }

    // Linked controls boost
    if (riskContext.linkedControls.length > 0) {
      confidence += 10;
      explainability.push({
        signal: `${riskContext.linkedControls.length} linked control(s)`,
        source: 'risk_context',
        contribution: '+10% confidence',
      });
    }

    // CMDB context boost
    if (cmdbContext) {
      if (cmdbContext.affectedCis.length > 0) {
        confidence += 10;
        explainability.push({
          signal: `${cmdbContext.affectedCis.length} affected CI(s) identified`,
          source: 'cmdb_context',
          contribution: '+10% confidence',
        });
      }
      if (cmdbContext.affectedServices.length > 0) {
        confidence += 5;
        explainability.push({
          signal: `${cmdbContext.affectedServices.length} affected service(s) identified`,
          source: 'cmdb_context',
          contribution: '+5% confidence',
        });
      }
      if (cmdbContext.topologyImpact) {
        confidence += 5;
        explainability.push({
          signal: 'Topology impact analysis available',
          source: 'cmdb_topology',
          contribution: '+5% confidence',
        });
      }
    }

    // Risk scoring data
    if (riskContext.inherentScore !== null) {
      confidence += 5;
      explainability.push({
        signal: 'Inherent risk score available',
        source: 'risk_scoring',
        contribution: '+5% confidence',
      });
    }

    // Description quality
    if (riskContext.description && riskContext.description.length > 50) {
      confidence += 5;
      explainability.push({
        signal: 'Detailed risk description',
        source: 'risk_context',
        contribution: '+5% confidence',
      });
    }

    // Cap at 85 for deterministic heuristics (LLM integration can go higher)
    confidence = Math.min(confidence, 85);

    return { confidence, explainability };
  }

  /**
   * Generate summary text for the advisory.
   */
  generateSummary(
    theme: RiskTheme,
    riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
  ): string {
    const themeLabel = theme.replace(/_/g, ' ').toLowerCase();
    const severityLabel = riskContext.severity.toLowerCase();

    let summary = `This ${severityLabel}-severity risk has been classified as a ${themeLabel} risk.`;

    if (riskContext.linkedControls.length > 0) {
      summary += ` ${riskContext.linkedControls.length} control(s) are currently linked.`;
    } else {
      summary += ' No controls are currently linked to this risk.';
    }

    if (cmdbContext) {
      if (cmdbContext.affectedCis.length > 0) {
        summary += ` ${cmdbContext.affectedCis.length} configuration item(s) may be affected.`;
      }
      if (cmdbContext.affectedServices.length > 0) {
        summary += ` ${cmdbContext.affectedServices.length} service(s) may be impacted.`;
      }
      if (cmdbContext.topologyImpact) {
        summary += ` Topology analysis shows ${cmdbContext.topologyImpact.totalDependencies} dependencies.`;
      }
    }

    return summary;
  }

  /**
   * Generate warnings based on context gaps.
   */
  generateWarnings(
    riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
  ): string[] {
    const warnings: string[] = [];

    if (!riskContext.description || riskContext.description.length < 20) {
      warnings.push(
        'Risk description is brief or missing. Advisory quality may be improved with a more detailed description.',
      );
    }

    if (riskContext.linkedControls.length === 0) {
      warnings.push(
        'No controls are linked to this risk. Consider linking relevant controls for better advisory accuracy.',
      );
    }

    if (!cmdbContext || (cmdbContext.affectedCis.length === 0 && cmdbContext.affectedServices.length === 0)) {
      warnings.push(
        'No CMDB configuration items or services are associated. Advisory does not include infrastructure impact analysis.',
      );
    }

    if (riskContext.inherentScore === null) {
      warnings.push(
        'Inherent risk score has not been calculated. Risk scoring data would improve advisory confidence.',
      );
    }

    if (riskContext.status === 'closed' || riskContext.status === 'accepted') {
      warnings.push(
        `Risk is currently in "${riskContext.status}" status. Advisory recommendations may not be applicable.`,
      );
    }

    return warnings;
  }

  /**
   * Generate assumptions for the advisory.
   */
  generateAssumptions(
    theme: RiskTheme,
    _riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
  ): string[] {
    const assumptions: string[] = [
      'Advisory is generated using deterministic heuristics (no AI/LLM involved).',
      'Suggested records are proposals only — no records are created until explicitly approved.',
    ];

    if (theme !== RiskTheme.GENERAL) {
      assumptions.push(
        `Risk theme "${theme}" was inferred from risk text analysis. Verify the classification is accurate.`,
      );
    }

    if (!cmdbContext || cmdbContext.affectedCis.length === 0) {
      assumptions.push(
        'CMDB impact analysis is based on available data. Additional affected systems may exist.',
      );
    }

    return assumptions;
  }

  /**
   * Build the complete advisory result.
   */
  buildAdvisoryResult(
    riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
  ): AdvisoryResult {
    // 1. Classify theme
    const { theme, explainability: themeExplainability } = this.classifyTheme(
      riskContext.title,
      riskContext.description,
      riskContext.category,
    );

    // Calculate theme score for confidence
    const themeScore = themeExplainability.reduce((score, entry) => {
      const match = entry.contribution.match(/scored (\d+)/);
      return match ? score + parseInt(match[1], 10) : score;
    }, 0);

    // 2. Generate mitigation plan
    const mitigationPlan = this.generateMitigationPlan(
      theme,
      riskContext,
      cmdbContext,
    );

    // 3. Build suggested records
    const suggestedRecords = this.buildSuggestedRecords(mitigationPlan);

    // 4. Calculate confidence
    const { confidence, explainability: confidenceExplainability } =
      this.calculateConfidence(riskContext, cmdbContext, themeScore);

    // 5. Generate summary
    const summary = this.generateSummary(theme, riskContext, cmdbContext);

    // 6. Generate warnings & assumptions
    const warnings = this.generateWarnings(riskContext, cmdbContext);
    const assumptions = this.generateAssumptions(theme, riskContext, cmdbContext);

    // 7. Combine explainability
    const explainability = [
      ...themeExplainability,
      ...confidenceExplainability,
      {
        signal: 'Deterministic heuristics engine',
        source: 'advisory_engine',
        contribution: 'Primary advisory source',
        detail: 'Phase 1 uses rule-based analysis. LLM integration available in Phase 2.',
      },
    ];

    return {
      id: uuidv4(),
      riskId: riskContext.id,
      analyzedAt: new Date().toISOString(),
      summary,
      riskTheme: theme,
      confidence,
      affectedServices: cmdbContext?.affectedServices || [],
      affectedCis: cmdbContext?.affectedCis || [],
      topologyImpactSummary: cmdbContext?.topologyImpact || null,
      mitigationPlan,
      suggestedRecords,
      explainability,
      warnings,
      assumptions,
    };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private contextualizeTitle(
    template: string,
    riskContext: RiskContext,
  ): string {
    // Prepend risk code/title context
    const prefix = riskContext.title.length > 40
      ? riskContext.title.substring(0, 37) + '...'
      : riskContext.title;
    return `[${prefix}] ${template}`;
  }

  private contextualizeDescription(
    template: string,
    riskContext: RiskContext,
    cmdbContext: CmdbContext | null,
  ): string {
    let desc = template;

    if (cmdbContext && cmdbContext.affectedCis.length > 0) {
      const ciNames = cmdbContext.affectedCis
        .slice(0, 3)
        .map((ci) => ci.name)
        .join(', ');
      desc += ` Affected CIs: ${ciNames}${cmdbContext.affectedCis.length > 3 ? ` (+${cmdbContext.affectedCis.length - 3} more)` : ''}.`;
    }

    if (riskContext.linkedControls.length > 0) {
      const controlNames = riskContext.linkedControls
        .slice(0, 2)
        .map((c) => c.name)
        .join(', ');
      desc += ` Related controls: ${controlNames}.`;
    }

    return desc;
  }

  private adjustPriority(
    basePriority: 'HIGH' | 'MEDIUM' | 'LOW',
    riskContext: RiskContext,
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    const severity = riskContext.severity?.toLowerCase();
    if (severity === 'critical') {
      return 'HIGH';
    }
    if (severity === 'high' && basePriority === 'LOW') {
      return 'MEDIUM';
    }
    return basePriority;
  }
}
