import { CmdbCi } from '../../ci/ci.entity';
import {
  CmdbReconcileRule,
  MatchStrategy,
  MatchStrategyField,
} from '../cmdb-reconcile-rule.entity';
import {
  ReconcileAction,
  ReconcileDiffField,
  ReconcileExplain,
} from '../cmdb-reconcile-result.entity';

export interface ReconcileInput {
  rowId: string;
  parsed: Record<string, unknown>;
}

export interface ReconcileOutput {
  rowId: string;
  action: ReconcileAction;
  ciId: string | null;
  matchedBy: string | null;
  diff: ReconcileDiffField[] | null;
  explain: ReconcileExplain | null;
}

const CI_FIELD_MAP: Record<string, string> = {
  hostname: 'name',
  name: 'name',
  serial_number: 'serialNumber',
  serialNumber: 'serialNumber',
  ip: 'ipAddress',
  ip_address: 'ipAddress',
  ipAddress: 'ipAddress',
  fqdn: 'dnsName',
  dns_name: 'dnsName',
  dnsName: 'dnsName',
  environment: 'environment',
  lifecycle: 'lifecycle',
  category: 'category',
  asset_tag: 'assetTag',
  assetTag: 'assetTag',
  description: 'description',
};

function normalizeCiFieldName(field: string): string {
  return CI_FIELD_MAP[field] || field;
}

function getCiFieldValue(ci: CmdbCi, field: string): unknown {
  const mapped = normalizeCiFieldName(field);
  return (ci as unknown as Record<string, unknown>)[mapped] ?? null;
}

function getRowFieldValue(
  parsed: Record<string, unknown>,
  field: string,
): unknown {
  return parsed[field] ?? null;
}

function normalizeValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase();
}

export function matchCiByRule(
  parsed: Record<string, unknown>,
  ci: CmdbCi,
  rule: CmdbReconcileRule,
): { matched: boolean; confidence: number; fieldsUsed: string[] } {
  const strategy: MatchStrategy = rule.matchStrategy;
  if (!strategy || !strategy.fields || strategy.fields.length === 0) {
    return { matched: false, confidence: 0, fieldsUsed: [] };
  }

  const fieldsUsed: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const sf of strategy.fields) {
    const rowVal = normalizeValue(getRowFieldValue(parsed, sf.field));
    const ciVal = normalizeValue(getCiFieldValue(ci, sf.ciField || sf.field));
    const weight = sf.weight || 1;
    totalWeight += weight;

    if (!rowVal && sf.uniqueRequired) {
      return { matched: false, confidence: 0, fieldsUsed: [] };
    }

    if (rowVal && ciVal && rowVal === ciVal) {
      matchedWeight += weight;
      fieldsUsed.push(sf.field);
    } else if (sf.uniqueRequired) {
      return { matched: false, confidence: 0, fieldsUsed: [] };
    }
  }

  if (totalWeight === 0) {
    return { matched: false, confidence: 0, fieldsUsed: [] };
  }

  const confidence = matchedWeight / totalWeight;

  if (strategy.type === 'exact') {
    return {
      matched: matchedWeight === totalWeight,
      confidence: matchedWeight === totalWeight ? 1.0 : confidence,
      fieldsUsed,
    };
  }

  const matched = confidence >= 0.8;
  return { matched, confidence, fieldsUsed };
}

export function computeDiff(
  parsed: Record<string, unknown>,
  ci: CmdbCi,
): ReconcileDiffField[] {
  const diffs: ReconcileDiffField[] = [];
  const keyFields = new Set(['name', 'serialNumber', 'ipAddress', 'dnsName']);

  for (const [field, newValue] of Object.entries(parsed)) {
    const ciField = normalizeCiFieldName(field);
    const oldValue = getCiFieldValue(ci, field);

    if (normalizeValue(oldValue) !== normalizeValue(newValue)) {
      diffs.push({
        field: ciField,
        oldValue,
        newValue,
        classification: keyFields.has(ciField) ? 'conflict' : 'safe_update',
      });
    }
  }

  return diffs;
}

export function reconcileRow(
  input: ReconcileInput,
  cis: CmdbCi[],
  rules: CmdbReconcileRule[],
): ReconcileOutput {
  const sortedRules = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.precedence - b.precedence);

  const matches: Array<{
    ci: CmdbCi;
    rule: CmdbReconcileRule;
    confidence: number;
    fieldsUsed: string[];
  }> = [];

  for (const rule of sortedRules) {
    for (const ci of cis) {
      const result = matchCiByRule(input.parsed, ci, rule);
      if (result.matched) {
        matches.push({
          ci,
          rule,
          confidence: result.confidence,
          fieldsUsed: result.fieldsUsed,
        });
      }
    }

    if (matches.length > 0) break;
  }

  if (matches.length === 0) {
    return {
      rowId: input.rowId,
      action: ReconcileAction.CREATE,
      ciId: null,
      matchedBy: null,
      diff: null,
      explain: null,
    };
  }

  if (matches.length > 1) {
    const bestMatch = matches[0];
    return {
      rowId: input.rowId,
      action: ReconcileAction.CONFLICT,
      ciId: null,
      matchedBy: bestMatch.rule.name,
      diff: null,
      explain: {
        ruleId: bestMatch.rule.id,
        ruleName: bestMatch.rule.name,
        fieldsUsed: bestMatch.fieldsUsed,
        confidence: bestMatch.confidence,
      },
    };
  }

  const match = matches[0];
  const diff = computeDiff(input.parsed, match.ci);
  const hasConflicts = diff.some((d) => d.classification === 'conflict');

  if (hasConflicts) {
    return {
      rowId: input.rowId,
      action: ReconcileAction.CONFLICT,
      ciId: match.ci.id,
      matchedBy: match.rule.name,
      diff,
      explain: {
        ruleId: match.rule.id,
        ruleName: match.rule.name,
        fieldsUsed: match.fieldsUsed,
        confidence: match.confidence,
        matchedCiId: match.ci.id,
        matchedCiName: match.ci.name,
      },
    };
  }

  if (diff.length === 0) {
    return {
      rowId: input.rowId,
      action: ReconcileAction.SKIP,
      ciId: match.ci.id,
      matchedBy: match.rule.name,
      diff: [],
      explain: {
        ruleId: match.rule.id,
        ruleName: match.rule.name,
        fieldsUsed: match.fieldsUsed,
        confidence: match.confidence,
        matchedCiId: match.ci.id,
        matchedCiName: match.ci.name,
      },
    };
  }

  return {
    rowId: input.rowId,
    action: ReconcileAction.UPDATE,
    ciId: match.ci.id,
    matchedBy: match.rule.name,
    diff,
    explain: {
      ruleId: match.rule.id,
      ruleName: match.rule.name,
      fieldsUsed: match.fieldsUsed,
      confidence: match.confidence,
      matchedCiId: match.ci.id,
      matchedCiName: match.ci.name,
    },
  };
}
