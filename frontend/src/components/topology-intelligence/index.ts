/**
 * Topology Intelligence Components
 * Shared reusable components for topology-based decision support.
 */
export { TopologyImpactSummaryCard } from './TopologyImpactSummaryCard';
export type { TopologyImpactSummaryCardProps } from './TopologyImpactSummaryCard';

export { TopologyExplainabilityPanel } from './TopologyExplainabilityPanel';
export type { TopologyExplainabilityPanelProps } from './TopologyExplainabilityPanel';

export { TopologyRcaHypothesesTable } from './TopologyRcaHypothesesTable';
export type { TopologyRcaHypothesesTableProps } from './TopologyRcaHypothesesTable';

export { TopologyInsightBanner } from './TopologyInsightBanner';
export type { TopologyInsightBannerProps } from './TopologyInsightBanner';

export { TopologyRcaCompareDialog } from './TopologyRcaCompareDialog';
export type { TopologyRcaCompareDialogProps } from './TopologyRcaCompareDialog';

export { TopologyGovernanceDecisionPanel } from './TopologyGovernanceDecisionPanel';
export type { TopologyGovernanceDecisionPanelProps } from './TopologyGovernanceDecisionPanel';

export { SuggestedTaskPackCard } from './SuggestedTaskPackCard';
export type { SuggestedTaskPackCardProps } from './SuggestedTaskPackCard';

export { TraceabilityChainWidget } from './TraceabilityChainWidget';
export type { TraceabilityChainWidgetProps } from './TraceabilityChainWidget';
export {
  getTopologyRiskLevel,
  getRiskLevelColor,
  getConfidenceLabel,
  getConfidenceColor,
  getFragilitySignalLabel,
  getRcaHypothesisTypeLabel,
  getNodeTypeLabel,
  getNodeTypeShortLabel,
  classifyTopologyApiError,
  getImpactSummaryText,
  getRcaSummaryText,
  unwrapTopologyResponse,
  normalizeTopologyImpactResponse,
  FRAGILITY_SIGNAL_LABELS,
  RCA_HYPOTHESIS_TYPE_LABELS,
} from './topology-utils';
export type {
  TopologyRiskLevel,
  TopologyApiErrorType,
  ClassifiedTopologyError,
} from './topology-utils';
