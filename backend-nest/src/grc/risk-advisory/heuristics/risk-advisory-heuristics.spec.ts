import { RiskAdvisoryHeuristics, RiskContext, CmdbContext } from './risk-advisory-heuristics';
import { RiskTheme, MitigationTimeframe, SuggestedRecordType } from '../dto/advisory.dto';

describe('RiskAdvisoryHeuristics', () => {
  let heuristics: RiskAdvisoryHeuristics;

  const makeRiskContext = (overrides: Partial<RiskContext> = {}): RiskContext => ({
    id: 'risk-001',
    title: 'Test Risk',
    description: 'Test risk description',
    category: 'technology',
    severity: 'HIGH',
    likelihood: 'LIKELY',
    impact: 'HIGH',
    status: 'OPEN',
    inherentScore: 80,
    residualScore: 60,
    linkedControls: [],
    linkedPolicies: [],
    ...overrides,
  });

  const emptyCmdb: CmdbContext = {
    affectedServices: [],
    affectedCis: [],
    topologyImpact: null,
  };

  beforeEach(() => {
    heuristics = new RiskAdvisoryHeuristics();
  });

  describe('classifyTheme', () => {
    it('should classify patching risk correctly', () => {
      const result = heuristics.classifyTheme(
        'Unpatched Windows Servers',
        'Multiple servers are missing critical security patches and hotfixes',
        'technology',
      );
      expect(result.theme).toBe(RiskTheme.PATCHING);
      expect(result.explainability.length).toBeGreaterThan(0);
    });

    it('should classify access risk correctly', () => {
      const result = heuristics.classifyTheme(
        'Weak Authentication Controls',
        'MFA is not enforced for privileged accounts. Password policy is inadequate.',
        'compliance',
      );
      expect(result.theme).toBe(RiskTheme.ACCESS);
    });

    it('should classify backup risk correctly', () => {
      const result = heuristics.classifyTheme(
        'Backup Failure Risk',
        'Disaster recovery and backup restore procedures have not been tested in 12 months',
        'operational',
      );
      expect(result.theme).toBe(RiskTheme.BACKUP);
    });

    it('should classify end-of-support risk correctly', () => {
      const result = heuristics.classifyTheme(
        'Legacy System EOL',
        'Windows Server 2012 is end of life and no longer receives security updates',
        'technology',
      );
      expect(result.theme).toBe(RiskTheme.END_OF_SUPPORT);
    });

    it('should classify vulnerability risk correctly', () => {
      const result = heuristics.classifyTheme(
        'SQL Injection Vulnerability',
        'Penetration test found SQL injection exploit in the web application',
        'technology',
      );
      expect(result.theme).toBe(RiskTheme.VULNERABILITY);
    });

    it('should classify certificate risk correctly', () => {
      const result = heuristics.classifyTheme(
        'Expiring SSL Certificates',
        'Multiple TLS/SSL certificates are expiring within 30 days',
        'technology',
      );
      expect(result.theme).toBe(RiskTheme.CERTIFICATE);
    });

    it('should classify network exposure risk correctly', () => {
      const result = heuristics.classifyTheme(
        'Open Ports on DMZ',
        'Firewall rules allow ingress on unnecessary ports in the DMZ segment',
        'technology',
      );
      expect(result.theme).toBe(RiskTheme.NETWORK_EXPOSURE);
    });

    it('should classify compliance risk correctly', () => {
      const result = heuristics.classifyTheme(
        'GDPR Non-Compliance Finding',
        'ISO audit finding: data processing does not comply with GDPR regulation requirements',
        'compliance',
      );
      expect(result.theme).toBe(RiskTheme.COMPLIANCE);
    });

    it('should classify availability risk correctly', () => {
      const result = heuristics.classifyTheme(
        'SLA Breach Risk',
        'Single point of failure in load balancer causing availability and uptime concerns',
        'operational',
      );
      expect(result.theme).toBe(RiskTheme.AVAILABILITY);
    });

    it('should classify data protection risk correctly', () => {
      const result = heuristics.classifyTheme(
        'PII Data Leak Risk',
        'Personal data encryption is not applied, risk of data breach and privacy violation',
        'compliance',
      );
      expect(result.theme).toBe(RiskTheme.DATA_PROTECTION);
    });

    it('should return GENERAL for unclassifiable risks', () => {
      const result = heuristics.classifyTheme(
        'Random Unrelated Item',
        'Something about office furniture procurement budget',
        '',
      );
      expect(result.theme).toBe(RiskTheme.GENERAL);
    });

    it('should return explainability entries with correct shape', () => {
      const result = heuristics.classifyTheme(
        'Unpatched Servers',
        'Missing critical patches',
        'technology',
      );
      expect(result.explainability).toBeDefined();
      expect(Array.isArray(result.explainability)).toBe(true);
      result.explainability.forEach((entry) => {
        expect(entry.signal).toBeDefined();
        expect(entry.source).toBeDefined();
        expect(entry.contribution).toBeDefined();
      });
    });
  });

  describe('generateMitigationPlan', () => {
    const ctx = makeRiskContext();

    it('should generate mitigation plan for PATCHING theme', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.PATCHING, ctx, emptyCmdb);
      expect(plan.immediateActions.length).toBeGreaterThan(0);
      expect(plan.shortTermActions.length).toBeGreaterThan(0);
      expect(plan.verificationSteps.length).toBeGreaterThan(0);
    });

    it('should generate mitigation plan for ACCESS theme', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.ACCESS, ctx, emptyCmdb);
      expect(plan.immediateActions.length).toBeGreaterThan(0);
    });

    it('should generate mitigation plan for GENERAL theme', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.GENERAL, ctx, emptyCmdb);
      const total = plan.immediateActions.length + plan.shortTermActions.length +
        plan.permanentActions.length + plan.verificationSteps.length;
      expect(total).toBeGreaterThan(0);
    });

    it('should categorize actions by timeframe', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.PATCHING, ctx, emptyCmdb);
      plan.immediateActions.forEach((a) => expect(a.timeframe).toBe(MitigationTimeframe.IMMEDIATE));
      plan.shortTermActions.forEach((a) => expect(a.timeframe).toBe(MitigationTimeframe.SHORT_TERM));
      plan.permanentActions.forEach((a) => expect(a.timeframe).toBe(MitigationTimeframe.PERMANENT));
      plan.verificationSteps.forEach((a) => expect(a.timeframe).toBe(MitigationTimeframe.VERIFICATION));
    });

    it('should assign unique IDs to each action', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.PATCHING, ctx, emptyCmdb);
      const allIds = [
        ...plan.immediateActions.map((a) => a.id),
        ...plan.shortTermActions.map((a) => a.id),
        ...plan.permanentActions.map((a) => a.id),
        ...plan.verificationSteps.map((a) => a.id),
      ];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  describe('buildSuggestedRecords', () => {
    const ctx = makeRiskContext();

    it('should generate suggested records from mitigation plan', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.PATCHING, ctx, emptyCmdb);
      const records = heuristics.buildSuggestedRecords(plan);
      expect(records.length).toBeGreaterThan(0);
      records.forEach((r) => {
        expect(r.id).toBeDefined();
        expect(r.title).toBeDefined();
        expect(r.type).toBeDefined();
        expect([
          SuggestedRecordType.CHANGE,
          SuggestedRecordType.CAPA,
          SuggestedRecordType.CONTROL_TEST,
          SuggestedRecordType.TASK,
        ]).toContain(r.type);
        expect(r.priority).toBeDefined();
        expect(r.timeframe).toBeDefined();
      });
    });

    it('should produce records matching action IDs', () => {
      const plan = heuristics.generateMitigationPlan(RiskTheme.ACCESS, ctx, emptyCmdb);
      const records = heuristics.buildSuggestedRecords(plan);
      const allActionIds = [
        ...plan.immediateActions.map((a) => a.id),
        ...plan.shortTermActions.map((a) => a.id),
        ...plan.permanentActions.map((a) => a.id),
        ...plan.verificationSteps.map((a) => a.id),
      ];
      records.forEach((r) => {
        expect(allActionIds).toContain(r.id);
      });
    });
  });

  describe('buildAdvisoryResult', () => {
    it('should produce a valid advisory result', () => {
      const ctx = makeRiskContext({
        title: 'Unpatched Production Servers',
        description: 'Critical security patches are missing on production servers',
      });
      const result = heuristics.buildAdvisoryResult(ctx, emptyCmdb);
      expect(result.riskId).toBe('risk-001');
      expect(result.riskTheme).toBe(RiskTheme.PATCHING);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.analyzedAt).toBeDefined();
      expect(result.mitigationPlan).toBeDefined();
      expect(result.suggestedRecords).toBeDefined();
      expect(result.explainability).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.assumptions)).toBe(true);
    });

    it('should include affected services when CMDB context provided', () => {
      const ctx = makeRiskContext({
        title: 'Unpatched Servers',
        description: 'Missing patches',
      });
      const cmdb: CmdbContext = {
        affectedServices: [{ id: 'svc-1', name: 'Payment Service', type: 'service', criticality: 'CRITICAL' }],
        affectedCis: [{ id: 'ci-1', name: 'Server-01', type: 'ci' }],
        topologyImpact: null,
      };
      const result = heuristics.buildAdvisoryResult(ctx, cmdb);
      expect(result.affectedServices.length).toBe(1);
      expect(result.affectedServices[0].name).toBe('Payment Service');
      expect(result.affectedCis.length).toBe(1);
    });

    it('should generate warnings when no controls linked', () => {
      const ctx = makeRiskContext({
        title: 'Unpatched Servers',
        description: 'Missing patches',
        linkedControls: [],
      });
      const result = heuristics.buildAdvisoryResult(ctx, emptyCmdb);
      expect(result.warnings.some((w) => w.toLowerCase().includes('control'))).toBe(true);
    });

    it('should generate warnings when no CMDB CIs found', () => {
      const ctx = makeRiskContext({
        title: 'Unpatched Servers',
        description: 'Missing patches',
      });
      const result = heuristics.buildAdvisoryResult(ctx, emptyCmdb);
      expect(result.warnings.some((w) =>
        w.toLowerCase().includes('cmdb') || w.toLowerCase().includes('ci'),
      )).toBe(true);
    });

    it('should increase confidence when controls are linked', () => {
      const noControls = makeRiskContext({
        title: 'Unpatched Servers',
        description: 'Missing patches',
      });
      const withControls = makeRiskContext({
        title: 'Unpatched Servers',
        description: 'Missing patches',
        linkedControls: [
          { id: 'ctrl-1', name: 'Patch Management Control', code: 'CTRL-001', status: 'ACTIVE', effectivenessPercent: 70 },
        ],
      });
      const resultNoControls = heuristics.buildAdvisoryResult(noControls, emptyCmdb);
      const resultWithControls = heuristics.buildAdvisoryResult(withControls, emptyCmdb);
      expect(resultWithControls.confidence).toBeGreaterThanOrEqual(resultNoControls.confidence);
    });
  });
});
