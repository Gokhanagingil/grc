import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  AccountTree as TopologyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  unwrapResponse,
  TopologyResponse,
  TopologyQueryParams,
} from '../../services/grcClient';
import { TopologyGraph } from './TopologyGraph';

// ============================================================================
// Types
// ============================================================================

interface TopologyPanelProps {
  /** Entity UUID */
  entityId: string;
  /** Entity type for API routing */
  entityType: 'ci' | 'service';
  /** Callback for node navigation (e.g. navigate to CI/Service detail) */
  onNodeNavigate?: (nodeId: string, nodeType: string) => void;
  /** Whether the panel starts expanded (default: true) */
  defaultExpanded?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const TopologyPanel: React.FC<TopologyPanelProps> = ({
  entityId,
  entityType,
  onNodeNavigate,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [data, setData] = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryParams, setQueryParams] = useState<TopologyQueryParams>({
    depth: 1,
    direction: 'both',
    includeSemantics: true,
  });
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchTopology = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const response =
        entityType === 'ci'
          ? await cmdbApi.topology.forCi(entityId, queryParams)
          : await cmdbApi.topology.forService(entityId, queryParams);

      const result = unwrapResponse<TopologyResponse>(response);
      setData(result);
      setHasLoaded(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (axiosErr?.response?.status === 404) {
        // Entity not found or no topology - show empty state
        setData(null);
        setHasLoaded(true);
      } else if (axiosErr?.response?.status === 403) {
        setError('You do not have permission to view topology data.');
      } else if (axiosErr?.response?.status === 401) {
        // Let global interceptor handle auth errors - don't set error
        // to avoid confusing the user
        console.warn('Topology: 401 received, global interceptor should handle');
      } else {
        const msg = axiosErr?.response?.data?.message || axiosErr?.message || 'Failed to load topology';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, queryParams]);

  // Fetch on mount and when queryParams change (but only if expanded)
  useEffect(() => {
    if (expanded && entityId) {
      fetchTopology();
    }
  }, [expanded, entityId, fetchTopology]);

  // When expanding for first time, trigger load
  useEffect(() => {
    if (expanded && !hasLoaded && entityId) {
      fetchTopology();
    }
  }, [expanded, hasLoaded, entityId, fetchTopology]);

  const handleQueryChange = useCallback((newParams: TopologyQueryParams) => {
    setQueryParams(newParams);
  }, []);

  return (
    <Card sx={{ mt: 3 }} data-testid="topology-panel">
      <CardContent sx={{ pb: expanded ? undefined : '16px !important' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
          data-testid="topology-panel-header"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TopologyIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Topology
            </Typography>
            {data && !expanded && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({data.meta.nodeCount} nodes, {data.meta.edgeCount} edges)
              </Typography>
            )}
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, minHeight: 400 }}>
            <TopologyGraph
              entityId={entityId}
              entityType={entityType}
              data={data}
              loading={loading}
              error={error}
              queryParams={queryParams}
              onQueryChange={handleQueryChange}
              onNodeNavigate={onNodeNavigate}
            />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default TopologyPanel;
