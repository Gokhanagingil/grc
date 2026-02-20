import { CmdbCi } from '../../ci/ci.entity';
import { CmdbReconcileRule } from '../cmdb-reconcile-rule.entity';
import { ReconcileAction } from '../cmdb-reconcile-result.entity';
import {
  matchCiByRule,
  computeDiff,
  reconcileRow,
} from './reconciliation-engine';

const makeCi = (overrides: Partial<CmdbCi> = {}): CmdbCi =>
  ({
    id: 'ci-1',
    tenantId: 'tenant-1',
    name: 'PROD-WEB-01',
    description: 'Web server',
    classId: 'class-1',
    lifecycle: 'active',
    environment: 'production',
    category: null,
    assetTag: null,
    serialNumber: 'SN-12345',
    ipAddress: '10.0.1.10',
    dnsName: 'prod-web-01.internal',
    managedBy: null,
    ownedBy: null,
    attributes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    ...overrides,
  }) as CmdbCi;

const makeRule = (
  overrides: Partial<CmdbReconcileRule> = {},
): CmdbReconcileRule =>
  ({
    id: 'rule-1',
    tenantId: 'tenant-1',
    name: 'Hostname Exact',
    targetClassId: null,
    matchStrategy: {
      type: 'exact' as const,
      fields: [
        { field: 'hostname', ciField: 'name', weight: 1, uniqueRequired: true },
      ],
    },
    precedence: 0,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: false,
    ...overrides,
  }) as CmdbReconcileRule;

describe('Reconciliation Engine', () => {
  describe('matchCiByRule', () => {
    it('should match when hostname matches exactly', () => {
      const ci = makeCi({ name: 'PROD-WEB-01' });
      const rule = makeRule();
      const result = matchCiByRule({ hostname: 'PROD-WEB-01' }, ci, rule);
      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.fieldsUsed).toEqual(['hostname']);
    });

    it('should match case-insensitively', () => {
      const ci = makeCi({ name: 'PROD-WEB-01' });
      const rule = makeRule();
      const result = matchCiByRule({ hostname: 'prod-web-01' }, ci, rule);
      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should not match when hostname differs', () => {
      const ci = makeCi({ name: 'PROD-WEB-01' });
      const rule = makeRule();
      const result = matchCiByRule({ hostname: 'PROD-WEB-99' }, ci, rule);
      expect(result.matched).toBe(false);
    });

    it('should fail when uniqueRequired field is empty in parsed row', () => {
      const ci = makeCi({ name: 'PROD-WEB-01' });
      const rule = makeRule();
      const result = matchCiByRule({ hostname: '' }, ci, rule);
      expect(result.matched).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle composite strategy with weighted fields', () => {
      const ci = makeCi({ name: 'PROD-WEB-01', environment: 'production' });
      const rule = makeRule({
        matchStrategy: {
          type: 'composite',
          fields: [
            {
              field: 'hostname',
              ciField: 'name',
              weight: 2,
              uniqueRequired: false,
            },
            {
              field: 'environment',
              ciField: 'environment',
              weight: 1,
              uniqueRequired: false,
            },
          ],
        },
      });
      const result = matchCiByRule(
        { hostname: 'PROD-WEB-01', environment: 'production' },
        ci,
        rule,
      );
      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.fieldsUsed).toContain('hostname');
      expect(result.fieldsUsed).toContain('environment');
    });

    it('should return partial confidence for composite when only some fields match', () => {
      const ci = makeCi({ name: 'PROD-WEB-01', environment: 'production' });
      const rule = makeRule({
        matchStrategy: {
          type: 'composite',
          fields: [
            {
              field: 'hostname',
              ciField: 'name',
              weight: 2,
              uniqueRequired: false,
            },
            {
              field: 'environment',
              ciField: 'environment',
              weight: 1,
              uniqueRequired: false,
            },
          ],
        },
      });
      const result = matchCiByRule(
        { hostname: 'PROD-WEB-01', environment: 'staging' },
        ci,
        rule,
      );
      expect(result.confidence).toBeCloseTo(2 / 3, 2);
      expect(result.matched).toBe(false);
    });

    it('should match by serial number', () => {
      const ci = makeCi({ serialNumber: 'SN-12345' });
      const rule = makeRule({
        matchStrategy: {
          type: 'exact',
          fields: [
            {
              field: 'serial_number',
              ciField: 'serialNumber',
              weight: 1,
              uniqueRequired: true,
            },
          ],
        },
      });
      const result = matchCiByRule({ serial_number: 'SN-12345' }, ci, rule);
      expect(result.matched).toBe(true);
    });

    it('should match by IP address', () => {
      const ci = makeCi({ ipAddress: '10.0.1.10' });
      const rule = makeRule({
        matchStrategy: {
          type: 'exact',
          fields: [
            {
              field: 'ip',
              ciField: 'ipAddress',
              weight: 1,
              uniqueRequired: true,
            },
          ],
        },
      });
      const result = matchCiByRule({ ip: '10.0.1.10' }, ci, rule);
      expect(result.matched).toBe(true);
    });

    it('should return empty when strategy has no fields', () => {
      const ci = makeCi();
      const rule = makeRule({ matchStrategy: { type: 'exact', fields: [] } });
      const result = matchCiByRule({ hostname: 'anything' }, ci, rule);
      expect(result.matched).toBe(false);
      expect(result.fieldsUsed).toEqual([]);
    });

    it('should handle null/undefined parsed values gracefully', () => {
      const ci = makeCi({ name: 'PROD-WEB-01' });
      const rule = makeRule();
      const result = matchCiByRule(
        { hostname: null } as unknown as Record<string, unknown>,
        ci,
        rule,
      );
      expect(result.matched).toBe(false);
    });
  });

  describe('computeDiff', () => {
    it('should return empty diff when all fields match', () => {
      const ci = makeCi({ name: 'PROD-WEB-01', environment: 'production' });
      const diff = computeDiff(
        { hostname: 'PROD-WEB-01', environment: 'production' },
        ci,
      );
      expect(diff).toEqual([]);
    });

    it('should detect safe update for non-key fields', () => {
      const ci = makeCi({ description: 'Old desc', environment: 'production' });
      const diff = computeDiff({ description: 'New desc' }, ci);
      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('description');
      expect(diff[0].oldValue).toBe('Old desc');
      expect(diff[0].newValue).toBe('New desc');
      expect(diff[0].classification).toBe('safe_update');
    });

    it('should detect conflict for key field changes', () => {
      const ci = makeCi({ name: 'PROD-WEB-01' });
      const diff = computeDiff({ hostname: 'PROD-WEB-02' }, ci);
      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('name');
      expect(diff[0].classification).toBe('conflict');
    });

    it('should classify serial number change as conflict', () => {
      const ci = makeCi({ serialNumber: 'SN-OLD' });
      const diff = computeDiff({ serial_number: 'SN-NEW' }, ci);
      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('serialNumber');
      expect(diff[0].classification).toBe('conflict');
    });

    it('should classify IP address change as conflict', () => {
      const ci = makeCi({ ipAddress: '10.0.1.10' });
      const diff = computeDiff({ ip_address: '10.0.1.99' }, ci);
      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('ipAddress');
      expect(diff[0].classification).toBe('conflict');
    });

    it('should detect multiple diffs with mixed classifications', () => {
      const ci = makeCi({
        name: 'PROD-WEB-01',
        description: 'Old desc',
        environment: 'production',
      });
      const diff = computeDiff(
        {
          hostname: 'PROD-WEB-02',
          description: 'New desc',
          environment: 'staging',
        },
        ci,
      );
      expect(diff.length).toBeGreaterThanOrEqual(2);
      const nameField = diff.find((d) => d.field === 'name');
      const descField = diff.find((d) => d.field === 'description');
      expect(nameField?.classification).toBe('conflict');
      expect(descField?.classification).toBe('safe_update');
    });
  });

  describe('reconcileRow', () => {
    const cis = [
      makeCi({
        id: 'ci-1',
        name: 'PROD-WEB-01',
        serialNumber: 'SN-111',
        ipAddress: '10.0.1.10',
      }),
      makeCi({
        id: 'ci-2',
        name: 'PROD-WEB-02',
        serialNumber: 'SN-222',
        ipAddress: '10.0.1.11',
      }),
    ];

    const rules = [
      makeRule({ id: 'rule-1', name: 'Hostname Exact', precedence: 0 }),
      makeRule({
        id: 'rule-2',
        name: 'Serial Match',
        precedence: 1,
        matchStrategy: {
          type: 'exact',
          fields: [
            {
              field: 'serial_number',
              ciField: 'serialNumber',
              weight: 1,
              uniqueRequired: true,
            },
          ],
        },
      }),
    ];

    it('should return CREATE when no CI matches', () => {
      const result = reconcileRow(
        { rowId: 'row-1', parsed: { hostname: 'NEW-SERVER-01' } },
        cis,
        rules,
      );
      expect(result.action).toBe(ReconcileAction.CREATE);
      expect(result.ciId).toBeNull();
      expect(result.matchedBy).toBeNull();
    });

    it('should return UPDATE for single match with safe diffs', () => {
      const result = reconcileRow(
        {
          rowId: 'row-1',
          parsed: { hostname: 'PROD-WEB-01', description: 'Updated desc' },
        },
        cis,
        rules,
      );
      expect(result.action).toBe(ReconcileAction.UPDATE);
      expect(result.ciId).toBe('ci-1');
      expect(result.matchedBy).toBe('Hostname Exact');
      expect(result.diff).toBeDefined();
      expect(result.diff!.length).toBeGreaterThan(0);
      expect(result.explain).toBeDefined();
      expect(result.explain!.ruleName).toBe('Hostname Exact');
    });

    it('should return SKIP for single match with no diffs', () => {
      const result = reconcileRow(
        { rowId: 'row-1', parsed: { hostname: 'PROD-WEB-01' } },
        cis,
        rules,
      );
      expect(result.action).toBe(ReconcileAction.SKIP);
      expect(result.ciId).toBe('ci-1');
    });

    it('should return CONFLICT when multiple CIs match the same rule', () => {
      const ambiguousRule = makeRule({
        id: 'rule-amb',
        name: 'Env Match',
        precedence: 0,
        matchStrategy: {
          type: 'exact',
          fields: [
            {
              field: 'environment',
              ciField: 'environment',
              weight: 1,
              uniqueRequired: true,
            },
          ],
        },
      });
      const result = reconcileRow(
        { rowId: 'row-1', parsed: { environment: 'production' } },
        cis,
        [ambiguousRule],
      );
      expect(result.action).toBe(ReconcileAction.CONFLICT);
      expect(result.ciId).toBeNull();
    });

    it('should return CONFLICT when single match has key field diff', () => {
      const result = reconcileRow(
        {
          rowId: 'row-1',
          parsed: { hostname: 'PROD-WEB-01', ip_address: '192.168.1.99' },
        },
        cis,
        rules,
      );
      expect(result.action).toBe(ReconcileAction.CONFLICT);
      expect(result.ciId).toBe('ci-1');
      expect(result.diff).toBeDefined();
    });

    it('should respect rule precedence order', () => {
      const result = reconcileRow(
        {
          rowId: 'row-1',
          parsed: { hostname: 'PROD-WEB-02', serial_number: 'SN-222' },
        },
        cis,
        rules,
      );
      expect(result.matchedBy).toBe('Hostname Exact');
      expect(result.ciId).toBe('ci-2');
    });

    it('should skip disabled rules', () => {
      const disabledRules = [
        makeRule({
          id: 'rule-d',
          name: 'Disabled Rule',
          precedence: 0,
          enabled: false,
        }),
        makeRule({
          id: 'rule-2',
          name: 'Serial Match',
          precedence: 1,
          matchStrategy: {
            type: 'exact',
            fields: [
              {
                field: 'serial_number',
                ciField: 'serialNumber',
                weight: 1,
                uniqueRequired: true,
              },
            ],
          },
        }),
      ];
      const result = reconcileRow(
        {
          rowId: 'row-1',
          parsed: { hostname: 'PROD-WEB-01', serial_number: 'SN-111' },
        },
        cis,
        disabledRules,
      );
      expect(result.matchedBy).toBe('Serial Match');
    });

    it('should fallback to lower precedence rule if higher does not match', () => {
      const result = reconcileRow(
        { rowId: 'row-1', parsed: { serial_number: 'SN-222' } },
        cis,
        rules,
      );
      expect(result.matchedBy).toBe('Serial Match');
      expect(result.ciId).toBe('ci-2');
    });

    it('should include explain object with confidence and fields', () => {
      const result = reconcileRow(
        {
          rowId: 'row-1',
          parsed: { hostname: 'PROD-WEB-01', description: 'Updated' },
        },
        cis,
        rules,
      );
      expect(result.explain).toBeDefined();
      expect(result.explain!.ruleId).toBe('rule-1');
      expect(result.explain!.confidence).toBe(1.0);
      expect(result.explain!.fieldsUsed).toContain('hostname');
      expect(result.explain!.matchedCiId).toBe('ci-1');
      expect(result.explain!.matchedCiName).toBe('PROD-WEB-01');
    });

    it('should handle empty CIs list (all rows are CREATE)', () => {
      const result = reconcileRow(
        { rowId: 'row-1', parsed: { hostname: 'ANY-SERVER' } },
        [],
        rules,
      );
      expect(result.action).toBe(ReconcileAction.CREATE);
    });

    it('should handle empty rules list (all rows are CREATE)', () => {
      const result = reconcileRow(
        { rowId: 'row-1', parsed: { hostname: 'PROD-WEB-01' } },
        cis,
        [],
      );
      expect(result.action).toBe(ReconcileAction.CREATE);
    });
  });
});
