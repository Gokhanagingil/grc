import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  Shield as ShieldIcon,
  Info as InfoIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import {
  itsmApi,
  CustomerRiskImpactData,
  ResolvedCustomerRiskData,
  RelevancePath,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { safeArray } from '../../utils/safeHelpers';
import { AxiosError } from 'axios';

/**
 * Normalizes a CustomerRiskImpactData payload at the boundary.
 * Ensures all array fields are always arrays, preventing `.length` / `.map` crashes
 * when the backend omits or returns null for optional array fields.
 */
function normalizeCustomerRiskImpact(raw: CustomerRiskImpactData): CustomerRiskImpactData {
  return {
    ...raw,
    resolvedRisks: safeArray(raw.resolvedRisks).map((risk) => ({
      ...risk,
      relevancePaths: safeArray(risk.relevancePaths) as RelevancePath[],
    })),
    topReasons: safeArray(raw.topReasons),
  };
}

// ---------- helpers ----------

const SEVERITY_COLOR: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'success',
};

const AGGREGATE_LABEL_COLOR: Record<string, string> = {
  CRITICAL: '#d32f2f',
  HIGH: '#ed6c02',
  MEDIUM: '#2196f3',
  LOW: '#2e7d32',
  NONE: '#9e9e9e',
};

const PATH_LABELS: Record<RelevancePath, string> = {
  service_binding: 'Service',
  offering_binding: 'Offering',
  affected_ci: 'Affected CI',
  blast_radius_ci: 'Blast Radius',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getScoreGradient(label: string): string {
  const color = AGGREGATE_LABEL_COLOR[label] || AGGREGATE_LABEL_COLOR.NONE;
  return `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`;
}

// ---------- sub-components ----------

interface SummaryCardProps {
  impact: CustomerRiskImpactData;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ impact }) => (
  <Box
    data-testid="customer-risk-summary"
    sx={{
      background: getScoreGradient(impact.aggregateLabel),
      borderRadius: 2,
      p: 2,
      color: 'white',
      mb: 2,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {/* Score badge */}
      <Box sx={{ textAlign: 'center', minWidth: 64 }}>
        <Typography variant="h3" fontWeight={700} lineHeight={1}>
          {impact.aggregateScore}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Customer Risk
        </Typography>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Chip
            label={impact.aggregateLabel}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
          />
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {impact.resolvedRisks.length} risk{impact.resolvedRisks.length !== 1 ? 's' : ''} resolved
          </Typography>
        </Box>

        {impact.topReasons.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            {impact.topReasons.slice(0, 3).map((reason, idx) => (
              <Typography key={idx} variant="caption" display="block" sx={{ opacity: 0.85 }}>
                {reason}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>

    <Typography variant="caption" display="block" sx={{ mt: 1, opacity: 0.7, textAlign: 'right' }}>
      Calculated: {formatTimestamp(impact.calculatedAt)}
    </Typography>
  </Box>
);

// ---------- Resolved Risks Table ----------

interface ResolvedRisksTableProps {
  risks: ResolvedCustomerRiskData[];
}

const ResolvedRisksTable: React.FC<ResolvedRisksTableProps> = ({ risks }) => {
  if (risks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        No customer risks resolved for this change.
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: 400 }} data-testid="customer-risk-table">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Risk</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Paths</TableCell>
            <TableCell sx={{ fontWeight: 600 }} align="right">Contribution</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {risks.map((risk) => (
            <TableRow key={risk.catalogRiskId} hover>
              <TableCell>
                <Box>
                  <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 180 }}>
                    {risk.title}
                  </Typography>
                  {risk.code && (
                    <Typography variant="caption" color="text.secondary">
                      {risk.code}
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={risk.severity}
                  size="small"
                  color={SEVERITY_COLOR[risk.severity] || 'default'}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {risk.relevancePaths.map((path) => (
                    <Chip
                      key={path}
                      label={PATH_LABELS[path] || path}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  ))}
                </Box>
              </TableCell>
              <TableCell align="right">
                <Tooltip title={risk.contributionReason} arrow placement="left">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {risk.contributionScore.toFixed(1)}
                    </Typography>
                    <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Chip
                  label={risk.status}
                  size="small"
                  color={
                    risk.status === 'ACTIVE' ? 'error'
                    : risk.status === 'MITIGATED' ? 'success'
                    : risk.status === 'ACCEPTED' ? 'info'
                    : 'default'
                  }
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ---------- Explainability Drilldown ----------

interface ExplainabilityProps {
  impact: CustomerRiskImpactData;
}

const ExplainabilityDrilldown: React.FC<ExplainabilityProps> = ({ impact }) => {
  const [open, setOpen] = useState(false);
  const riskFactor = impact.riskFactor;

  return (
    <Box sx={{ mt: 1.5 }} data-testid="customer-risk-explainability">
      <Box
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5 }}
        onClick={() => setOpen(!open)}
      >
        <InfoIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" color="primary" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
          Why is this change {impact.aggregateLabel}?
        </Typography>
        <IconButton size="small">
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
          {/* Risk factor details */}
          {riskFactor && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                CUSTOMER_RISK_EXPOSURE Factor
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={500}>
                  Score: {riskFactor.score} / 100
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  (Weight: {riskFactor.weight}%)
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  = {riskFactor.weightedScore.toFixed(1)} pts
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(riskFactor.score, 100)}
                color={
                  riskFactor.score >= 75 ? 'error'
                  : riskFactor.score >= 50 ? 'warning'
                  : riskFactor.score >= 25 ? 'info'
                  : 'success'
                }
                sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
              />
              <Typography variant="caption" color="text.secondary">
                {riskFactor.evidence}
              </Typography>
            </Box>
          )}

          {/* Top contributing risks */}
          {impact.resolvedRisks.length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Top Contributing Risks
              </Typography>
              <List dense disablePadding>
                {impact.resolvedRisks
                  .slice()
                  .sort((a, b) => b.contributionScore - a.contributionScore)
                  .slice(0, 5)
                  .map((risk) => (
                    <ListItem key={risk.catalogRiskId} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Chip
                                label={risk.severity}
                                size="small"
                                color={SEVERITY_COLOR[risk.severity] || 'default'}
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                              <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 160 }}>
                                {risk.title}
                              </Typography>
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              +{risk.contributionScore.toFixed(1)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary" noWrap>
                            via {risk.relevancePaths.map(p => PATH_LABELS[p] || p).join(', ')} — {risk.contributionReason}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

// ---------- Main Component ----------

interface CustomerRiskIntelligenceProps {
  changeId: string;
}

export const CustomerRiskIntelligence: React.FC<CustomerRiskIntelligenceProps> = ({ changeId }) => {
  const { showNotification } = useNotification();

  const [impact, setImpact] = useState<CustomerRiskImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const fetchImpact = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);
    try {
      const response = await itsmApi.changes.getCustomerRiskImpact(changeId);
      const responseData = response.data as { data?: CustomerRiskImpactData };
      if (responseData?.data) {
        setImpact(normalizeCustomerRiskImpact(responseData.data));
      } else {
        setImpact(null);
      }
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 403) {
        setPermissionDenied(true);
      } else if (axiosErr.response?.status === 404) {
        // Change has no customer risk data — not an error
        setImpact(null);
      } else {
        setError('Failed to load customer risk intelligence. This panel is optional and does not block change editing.');
      }
    } finally {
      setLoading(false);
    }
  }, [changeId]);

  useEffect(() => {
    fetchImpact();
  }, [fetchImpact]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const response = await itsmApi.changes.recalculateCustomerRisk(changeId);
      const responseData = response.data as { data?: { customerRiskImpact?: CustomerRiskImpactData } };
      if (responseData?.data?.customerRiskImpact) {
        setImpact(normalizeCustomerRiskImpact(responseData.data.customerRiskImpact));
      } else {
        // Refetch after recalculate
        await fetchImpact();
      }
      showNotification('Customer risk recalculated successfully', 'success');
    } catch {
      showNotification('Failed to recalculate customer risk', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  // ---------- render ----------

  return (
    <Card sx={{ mb: 2 }} data-testid="customer-risk-intelligence-panel">
      <CardContent>
        {/* Header */}
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldIcon color="primary" fontSize="small" />
            <Typography variant="h6">Customer Risk Intelligence</Typography>
            {impact && !loading && (
              <Chip
                label={`${impact.aggregateScore} - ${impact.aggregateLabel}`}
                size="small"
                color={SEVERITY_COLOR[impact.aggregateLabel] || 'default'}
              />
            )}
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          {/* Loading state */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }} data-testid="customer-risk-loading">
              <CircularProgress size={28} />
            </Box>
          )}

          {/* Permission denied state */}
          {!loading && permissionDenied && (
            <Alert
              severity="warning"
              sx={{ mt: 1.5 }}
              data-testid="customer-risk-permission-denied"
              icon={<ErrorOutlineIcon />}
            >
              You do not have permission to view customer risk intelligence for this change.
              Required permissions: ITSM Change Read, Customer Risk Read, Customer Risk Bind Read, Customer Risk Observation Read.
            </Alert>
          )}

          {/* Error state with retry */}
          {!loading && error && !permissionDenied && (
            <Alert
              severity="info"
              sx={{ mt: 1.5 }}
              data-testid="customer-risk-error"
              action={
                <Button color="inherit" size="small" onClick={fetchImpact}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* Empty state */}
          {!loading && !error && !permissionDenied && !impact && (
            <Box sx={{ py: 2, textAlign: 'center' }} data-testid="customer-risk-empty">
              <ShieldIcon sx={{ fontSize: 40, color: 'grey.400', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No customer risks linked through service, offering, CI, or blast radius.
              </Typography>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={handleRecalculate}
                disabled={recalculating}
                sx={{ mt: 1 }}
              >
                {recalculating ? 'Calculating...' : 'Calculate Now'}
              </Button>
            </Box>
          )}

          {/* Impact data */}
          {!loading && !error && !permissionDenied && impact && (
            <Box sx={{ mt: 1.5 }}>
              {/* Summary */}
              <SummaryCard impact={impact} />

              {/* Explainability */}
              <ExplainabilityDrilldown impact={impact} />

              {/* Toggle resolved risks table */}
              {impact.resolvedRisks.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5 }}
                    onClick={() => setShowTable(!showTable)}
                  >
                    <Typography variant="subtitle2">
                      Resolved Risks ({impact.resolvedRisks.length})
                    </Typography>
                    <IconButton size="small">
                      {showTable ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                  <Collapse in={showTable}>
                    <ResolvedRisksTable risks={impact.resolvedRisks} />
                  </Collapse>
                </Box>
              )}

              {/* Action buttons */}
              <Divider sx={{ mt: 2, mb: 1.5 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  data-testid="recalculate-customer-risk-btn"
                >
                  {recalculating ? 'Recalculating...' : 'Recalculate'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  href="/customer-risks"
                  target="_blank"
                  data-testid="open-customer-risk-details-btn"
                >
                  Risk Details
                </Button>
                <Tooltip title="Create a mitigation task for customer risks (coming soon)" arrow>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled
                      data-testid="create-mitigation-task-btn"
                    >
                      Create Mitigation
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Request waiver or risk acceptance (coming soon)" arrow>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled
                      data-testid="request-waiver-btn"
                    >
                      Request Waiver
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default CustomerRiskIntelligence;
