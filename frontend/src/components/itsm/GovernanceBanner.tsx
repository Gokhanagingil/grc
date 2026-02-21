import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Collapse,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GavelIcon from '@mui/icons-material/Gavel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  itsmApi,
  PolicyEvaluationSummary,
  DecisionRecommendation,
} from '../../services/grcClient';

// ---------- helpers ----------

const DECISION_CONFIG: Record<
  DecisionRecommendation,
  { label: string; color: 'success' | 'info' | 'warning' | 'error'; icon: React.ReactNode; description: string }
> = {
  ALLOW: {
    label: 'ALLOW',
    color: 'success',
    icon: <CheckCircleOutlineIcon />,
    description: 'No governance restrictions — change may proceed.',
  },
  REVIEW: {
    label: 'REVIEW',
    color: 'info',
    icon: <InfoOutlinedIcon />,
    description: 'Policy conditions matched — review recommended before approval.',
  },
  CAB_REQUIRED: {
    label: 'CAB REQUIRED',
    color: 'warning',
    icon: <WarningAmberIcon />,
    description: 'CAB approval is required before this change can proceed.',
  },
  BLOCK: {
    label: 'BLOCKED',
    color: 'error',
    icon: <BlockIcon />,
    description: 'Change is blocked by policy (e.g. freeze window conflict).',
  },
};

// ---------- sub-components ----------

interface GovernanceBannerProps {
  changeId: string;
}

export const GovernanceBanner: React.FC<GovernanceBannerProps> = ({ changeId }) => {
  const [policyEval, setPolicyEval] = useState<PolicyEvaluationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchPolicyEval = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const resp = await itsmApi.changes.getRiskAssessment(changeId);
      const d = resp.data as {
        data?: {
          assessment: unknown;
          policyEvaluation?: PolicyEvaluationSummary | null;
        };
      };
      if (d?.data?.policyEvaluation) {
        setPolicyEval(d.data.policyEvaluation);
      } else {
        setPolicyEval(null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [changeId]);

  useEffect(() => {
    fetchPolicyEval();
  }, [fetchPolicyEval]);

  // Loading state
  if (loading) {
    return (
      <Card sx={{ mb: 2 }} data-testid="governance-banner-loading">
        <CardContent>
          <Skeleton variant="text" width="40%" height={28} />
          <Skeleton variant="rectangular" height={48} sx={{ mt: 1, borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // Error state — silent, don't block the page
  if (error || !policyEval) {
    return null;
  }

  // If ALLOW with no matched policies, show a minimal "all clear" indicator
  if (
    policyEval.decisionRecommendation === 'ALLOW' &&
    policyEval.matchedPolicies.length === 0
  ) {
    return (
      <Card sx={{ mb: 2 }} data-testid="governance-banner-clear">
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GavelIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Governance: No policy restrictions for this change.
            </Typography>
            <Chip
              label="ALLOW"
              size="small"
              color="success"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  const config = DECISION_CONFIG[policyEval.decisionRecommendation] || DECISION_CONFIG.ALLOW;

  return (
    <Card sx={{ mb: 2 }} data-testid="governance-banner">
      <CardContent sx={{ pb: expanded ? 2 : 1.5, '&:last-child': { pb: expanded ? 2 : 1.5 } }}>
        {/* Header */}
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
          data-testid="governance-banner-header"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GavelIcon fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>
              Change Governance
            </Typography>
            <Chip
              label={config.label}
              size="small"
              color={config.color}
              icon={config.icon as React.ReactElement}
            />
            {policyEval.matchedPolicies.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                ({policyEval.matchedPolicies.length} polic{policyEval.matchedPolicies.length === 1 ? 'y' : 'ies'} triggered)
              </Typography>
            )}
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* Summary alert */}
        <Alert
          severity={config.color}
          icon={false}
          sx={{ mt: 1, py: 0.5 }}
        >
          {config.description}
        </Alert>

        {/* Required Actions (always visible if any) */}
        {policyEval.requiredActions.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Required Actions
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {policyEval.requiredActions.map((action, idx) => (
                <Chip
                  key={idx}
                  icon={<AssignmentIcon />}
                  label={action}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Expanded drilldown */}
        <Collapse in={expanded}>
          {/* Reasons */}
          {policyEval.reasons.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Why?
              </Typography>
              <List dense disablePadding>
                {policyEval.reasons.map((reason, idx) => (
                  <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <InfoOutlinedIcon fontSize="small" color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary={reason}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Rules triggered detail */}
          {policyEval.rulesTriggered.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Triggered Policies
              </Typography>
              {policyEval.rulesTriggered.map((rule, idx) => (
                <Box key={idx} sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {rule.policyName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Conditions: {rule.conditionsSummary}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Actions: {rule.actionsSummary}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Summary flags */}
          <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {policyEval.requireCABApproval && (
              <Chip label="CAB Approval" size="small" color="warning" />
            )}
            {policyEval.blockDuringFreeze && (
              <Chip label="Freeze Block" size="small" color="error" />
            )}
            {policyEval.minLeadTimeHours !== null && (
              <Chip
                label={`Min Lead: ${policyEval.minLeadTimeHours}h`}
                size="small"
                color="info"
                variant="outlined"
              />
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default GovernanceBanner;
