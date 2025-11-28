/**
 * Feature flags for module loading
 * Set ENABLE_<FEATURE>=true/false in .env to control module loading
 */
export const feature = (name: string, dflt = true): boolean => {
  const v = process.env[`ENABLE_${name}`];
  if (v === 'true') return true;
  if (v === 'false') return false;
  return dflt;
};

export const FEAT = {
  POLICY: feature('POLICY', true),
  RISK: feature('RISK', true),
  COMPLIANCE: feature('COMPLIANCE', true),
  AUDIT: feature('AUDIT', true),
  ISSUE: feature('ISSUE', true),
  QUEUE: feature('QUEUE', true),
  RULES: feature('RULES', true),
  DATA_FOUNDATION: feature('DATA_FOUNDATION', true),
  DASHBOARD: feature('DASHBOARD', true),
  GOVERNANCE: feature('GOVERNANCE', true),
  RISK_INSTANCE: feature('RISK_INSTANCE', true),
  RISK_SCORING: feature('RISK_SCORING', true),
  SEARCH: feature('SEARCH', true),
  ENTITY_REGISTRY: feature('ENTITY_REGISTRY', true),
  METRICS: feature('METRICS', true),
  BCM: feature('BCM', true),
  REALTIME: feature('REALTIME', false),
};

