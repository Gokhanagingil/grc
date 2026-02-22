import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeMouseHandler,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Paper,
  Drawer,
  IconButton,
  Divider,
  Stack,
  SelectChangeEvent,
} from '@mui/material';
import {
  Close as CloseIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  FitScreen as FitScreenIcon,
} from '@mui/icons-material';
import {
  TopologyNode,
  TopologyEdge,
  TopologyAnnotations,
  TopologyResponse,
  TopologyQueryParams,
} from '../../services/grcClient';

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ci: { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
  service: { bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20' },
  service_offering: { bg: '#fff3e0', border: '#f57c00', text: '#e65100' },
};

const RELATION_COLORS: Record<string, string> = {
  depends_on: '#1976d2',
  runs_on: '#388e3c',
  connects_to: '#7b1fa2',
  hosts: '#c62828',
  uses: '#00838f',
  has_offering: '#f57c00',
  manages: '#5d4037',
  monitors: '#6a1b9a',
  default: '#757575',
};

const NODE_ICONS: Record<string, React.ReactElement> = {
  ci: <StorageIcon fontSize="small" />,
  service: <CloudIcon fontSize="small" />,
  service_offering: <InventoryIcon fontSize="small" />,
};

// ============================================================================
// Types
// ============================================================================

interface TopologyGraphProps {
  /** Entity ID (CI or Service UUID) */
  entityId: string;
  /** Entity type for API call routing */
  entityType: 'ci' | 'service';
  /** Topology data from API */
  data: TopologyResponse | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Current query params */
  queryParams: TopologyQueryParams;
  /** Callback when query params change */
  onQueryChange: (params: TopologyQueryParams) => void;
  /** Callback for node click navigation */
  onNodeNavigate?: (nodeId: string, nodeType: string) => void;
  /** Annotations for Phase C overlay (optional) */
  annotations?: TopologyAnnotations;
}

interface NodeDetailData {
  node: TopologyNode;
  connectedEdges: TopologyEdge[];
}

// ============================================================================
// Helpers
// ============================================================================

function buildReactFlowNodes(
  nodes: TopologyNode[],
  rootNodeId: string,
  annotations?: TopologyAnnotations,
): Node[] {
  const highlighted = new Set(annotations?.highlightedNodeIds || []);
  const nodeCount = nodes.length;

  // Simple grid layout with root in center
  const cols = Math.max(Math.ceil(Math.sqrt(nodeCount)), 1);

  return nodes.map((n, idx) => {
    const isRoot = n.id === rootNodeId;
    const isHighlighted = highlighted.has(n.id);
    const colors = NODE_COLORS[n.type] || NODE_COLORS.ci;
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    return {
      id: n.id,
      position: { x: col * 250, y: row * 150 },
      data: {
        label: (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5 }}>
            {NODE_ICONS[n.type] || <StorageIcon fontSize="small" />}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isRoot ? 700 : 500,
                  color: colors.text,
                  display: 'block',
                  lineHeight: 1.2,
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.65rem',
                  display: 'block',
                  lineHeight: 1,
                }}
              >
                {n.type === 'ci' ? (n.className || 'CI') : n.type === 'service' ? 'Service' : 'Offering'}
              </Typography>
            </Box>
          </Box>
        ),
        topologyNode: n,
      },
      style: {
        background: colors.bg,
        border: `2px solid ${isHighlighted ? '#ff9800' : isRoot ? colors.border : colors.border + '88'}`,
        borderRadius: 8,
        padding: '6px 8px',
        minWidth: 140,
        boxShadow: isRoot ? `0 0 8px ${colors.border}44` : isHighlighted ? '0 0 8px #ff980066' : 'none',
      },
    };
  });
}

function buildReactFlowEdges(
  edges: TopologyEdge[],
  annotations?: TopologyAnnotations,
): Edge[] {
  const highlighted = new Set(annotations?.highlightedEdgeIds || []);

  return edges.map((e) => {
    const color = RELATION_COLORS[e.relationType] || RELATION_COLORS.default;
    const isHighlighted = highlighted.has(e.id);

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.relationType,
      type: 'smoothstep',
      animated: isHighlighted,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
      },
      style: {
        stroke: color,
        strokeWidth: isHighlighted ? 3 : 1.5,
        opacity: isHighlighted ? 1 : 0.7,
      },
      labelStyle: {
        fontSize: 10,
        fill: color,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.9,
      },
      labelBgPadding: [4, 2] as [number, number],
      data: { topologyEdge: e },
    };
  });
}

function extractRelationTypes(edges: TopologyEdge[]): string[] {
  const types = new Set<string>();
  edges.forEach((e) => types.add(e.relationType));
  return Array.from(types).sort();
}

// ============================================================================
// Sub-components
// ============================================================================

const TopologyControls: React.FC<{
  depth: number;
  direction: string;
  relationTypes: string[];
  activeRelTypes: string[];
  onDepthChange: (depth: number) => void;
  onDirectionChange: (direction: string) => void;
  onRelTypeToggle: (type: string) => void;
}> = ({
  depth,
  direction,
  relationTypes,
  activeRelTypes,
  onDepthChange,
  onDirectionChange,
  onRelTypeToggle,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 1.5,
      alignItems: 'center',
      p: 1.5,
      bgcolor: 'background.paper',
      borderBottom: 1,
      borderColor: 'divider',
    }}
    data-testid="topology-controls"
  >
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <InputLabel>Depth</InputLabel>
      <Select
        value={String(depth)}
        label="Depth"
        onChange={(e: SelectChangeEvent) => onDepthChange(Number(e.target.value))}
        data-testid="topology-depth-select"
      >
        <MenuItem value="1">1</MenuItem>
        <MenuItem value="2">2</MenuItem>
        <MenuItem value="3">3</MenuItem>
      </Select>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 130 }}>
      <InputLabel>Direction</InputLabel>
      <Select
        value={direction}
        label="Direction"
        onChange={(e: SelectChangeEvent) => onDirectionChange(e.target.value)}
        data-testid="topology-direction-select"
      >
        <MenuItem value="both">Both</MenuItem>
        <MenuItem value="upstream">Upstream</MenuItem>
        <MenuItem value="downstream">Downstream</MenuItem>
      </Select>
    </FormControl>

    {relationTypes.length > 0 && (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Relations:
        </Typography>
        {relationTypes.map((type) => (
          <Chip
            key={type}
            label={type}
            size="small"
            variant={activeRelTypes.includes(type) ? 'filled' : 'outlined'}
            color={activeRelTypes.includes(type) ? 'primary' : 'default'}
            onClick={() => onRelTypeToggle(type)}
            sx={{
              fontSize: '0.7rem',
              height: 24,
              borderColor: RELATION_COLORS[type] || RELATION_COLORS.default,
              ...(activeRelTypes.includes(type) && {
                bgcolor: RELATION_COLORS[type] || RELATION_COLORS.default,
                color: '#fff',
                '&:hover': {
                  bgcolor: RELATION_COLORS[type] || RELATION_COLORS.default,
                  opacity: 0.9,
                },
              }),
            }}
            data-testid={`topology-rel-chip-${type}`}
          />
        ))}
      </Box>
    )}
  </Box>
);

const TopologyLegend: React.FC = () => (
  <Paper
    elevation={1}
    sx={{
      position: 'absolute',
      bottom: 12,
      left: 12,
      p: 1.5,
      zIndex: 5,
      bgcolor: 'rgba(255,255,255,0.95)',
      maxWidth: 220,
    }}
    data-testid="topology-legend"
  >
    <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
      Legend
    </Typography>
    <Stack spacing={0.5}>
      {Object.entries(NODE_COLORS).map(([type, colors]) => (
        <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '3px',
              bgcolor: colors.bg,
              border: `1.5px solid ${colors.border}`,
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
            {type === 'ci' ? 'Configuration Item' : type === 'service' ? 'Service' : 'Service Offering'}
          </Typography>
        </Box>
      ))}
      <Divider sx={{ my: 0.5 }} />
      {Object.entries(RELATION_COLORS)
        .filter(([k]) => k !== 'default')
        .slice(0, 5)
        .map(([type, color]) => (
          <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 16,
                height: 2,
                bgcolor: color,
                borderRadius: 1,
              }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
              {type}
            </Typography>
          </Box>
        ))}
    </Stack>
  </Paper>
);

const NodeDetailDrawer: React.FC<{
  detail: NodeDetailData | null;
  open: boolean;
  onClose: () => void;
  onNavigate?: (nodeId: string, nodeType: string) => void;
}> = ({ detail, open, onClose, onNavigate }) => {
  if (!detail) return null;
  const { node, connectedEdges } = detail;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 340, p: 2 } }}
      data-testid="topology-node-drawer"
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          {node.label}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="caption" color="text.secondary">Type</Typography>
          <Typography variant="body2">
            {node.type === 'ci' ? 'Configuration Item' : node.type === 'service' ? 'Service' : 'Service Offering'}
          </Typography>
        </Box>

        {node.className && (
          <Box>
            <Typography variant="caption" color="text.secondary">Class</Typography>
            <Typography variant="body2">{node.className}</Typography>
          </Box>
        )}

        {node.status && (
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Chip label={node.status} size="small" sx={{ ml: 1 }} />
          </Box>
        )}

        {node.criticality && (
          <Box>
            <Typography variant="caption" color="text.secondary">Criticality</Typography>
            <Typography variant="body2">{node.criticality}</Typography>
          </Box>
        )}

        {node.environment && (
          <Box>
            <Typography variant="caption" color="text.secondary">Environment</Typography>
            <Typography variant="body2">{node.environment}</Typography>
          </Box>
        )}

        {node.ipAddress && (
          <Box>
            <Typography variant="caption" color="text.secondary">IP Address</Typography>
            <Typography variant="body2" fontFamily="monospace">{node.ipAddress}</Typography>
          </Box>
        )}

        {node.tier && (
          <Box>
            <Typography variant="caption" color="text.secondary">Tier</Typography>
            <Typography variant="body2">{node.tier}</Typography>
          </Box>
        )}

        {node.owner && (
          <Box>
            <Typography variant="caption" color="text.secondary">Owner</Typography>
            <Typography variant="body2">{node.owner}</Typography>
          </Box>
        )}

        {connectedEdges.length > 0 && (
          <>
            <Divider />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Connections ({connectedEdges.length})
            </Typography>
            {connectedEdges.map((edge) => (
              <Box key={edge.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 2,
                    bgcolor: RELATION_COLORS[edge.relationType] || RELATION_COLORS.default,
                  }}
                />
                <Typography variant="caption">
                  {edge.relationType}
                  {edge.direction ? ` (${edge.direction})` : ''}
                </Typography>
              </Box>
            ))}
          </>
        )}

        {onNavigate && node.type === 'ci' && (
          <>
            <Divider />
            <Chip
              label="Open CI Detail"
              color="primary"
              size="small"
              onClick={() => {
                onNavigate(node.id, node.type);
                onClose();
              }}
              sx={{ cursor: 'pointer' }}
            />
          </>
        )}

        {onNavigate && node.type === 'service' && (
          <>
            <Divider />
            <Chip
              label="Open Service Detail"
              color="success"
              size="small"
              onClick={() => {
                onNavigate(node.id, node.type);
                onClose();
              }}
              sx={{ cursor: 'pointer' }}
            />
          </>
        )}
      </Stack>
    </Drawer>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const TopologyGraph: React.FC<TopologyGraphProps> = ({
  data,
  loading,
  error,
  queryParams,
  onQueryChange,
  onNodeNavigate,
  annotations,
}) => {
  const [selectedDetail, setSelectedDetail] = useState<NodeDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Build React Flow nodes/edges from topology data
  const rfNodes = useMemo(() => {
    if (!data?.nodes?.length) return [];
    return buildReactFlowNodes(data.nodes, data.meta.rootNodeId, annotations || data.annotations);
  }, [data, annotations]);

  const rfEdges = useMemo(() => {
    if (!data?.edges?.length) return [];
    return buildReactFlowEdges(data.edges, annotations || data.annotations);
  }, [data, annotations]);

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);

  // Re-sync when rfNodes/rfEdges change (new data from API)
  React.useEffect(() => {
    onNodesChange(
      rfNodes.map((n) => ({ type: 'reset' as const, item: n })),
    );
  }, [rfNodes, onNodesChange]);

  React.useEffect(() => {
    onEdgesChange(
      rfEdges.map((e) => ({ type: 'reset' as const, item: e })),
    );
  }, [rfEdges, onEdgesChange]);

  // Extract available relation types for filter chips
  const allRelTypes = useMemo(() => {
    if (!data?.edges) return [];
    return extractRelationTypes(data.edges);
  }, [data]);

  // Parse active relation type filters
  const activeRelTypes = useMemo(() => {
    if (!queryParams.relationTypes) return allRelTypes;
    return queryParams.relationTypes.split(',').filter(Boolean);
  }, [queryParams.relationTypes, allRelTypes]);

  // Handlers
  const handleDepthChange = useCallback(
    (depth: number) => {
      onQueryChange({ ...queryParams, depth });
    },
    [queryParams, onQueryChange],
  );

  const handleDirectionChange = useCallback(
    (direction: string) => {
      onQueryChange({
        ...queryParams,
        direction: direction as TopologyQueryParams['direction'],
      });
    },
    [queryParams, onQueryChange],
  );

  const handleRelTypeToggle = useCallback(
    (type: string) => {
      const current = activeRelTypes.includes(type)
        ? activeRelTypes.filter((t) => t !== type)
        : [...activeRelTypes, type];

      // If all selected or none selected, clear the filter
      if (current.length === 0 || current.length === allRelTypes.length) {
        onQueryChange({ ...queryParams, relationTypes: undefined });
      } else {
        onQueryChange({ ...queryParams, relationTypes: current.join(',') });
      }
    },
    [activeRelTypes, allRelTypes, queryParams, onQueryChange],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const topoNode = node.data?.topologyNode as TopologyNode | undefined;
      if (!topoNode || !data) return;

      const connectedEdges = data.edges.filter(
        (e) => e.source === topoNode.id || e.target === topoNode.id,
      );

      setSelectedDetail({ node: topoNode, connectedEdges });
      setDrawerOpen(true);
    },
    [data],
  );

  // Render states
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 2,
        }}
        data-testid="topology-loading"
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Loading topology graph...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }} data-testid="topology-error">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          gap: 1,
        }}
        data-testid="topology-empty"
      >
        <FitScreenIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="body1" color="text.secondary">
          No topology data available
        </Typography>
        <Typography variant="caption" color="text.disabled">
          This item has no relationships to visualize
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}
      data-testid="topology-graph-container"
    >
      {/* Truncation warning */}
      {data.meta.truncated && (
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{ borderRadius: 0 }}
          data-testid="topology-truncation-warning"
        >
          Graph truncated: showing {data.meta.nodeCount} of potentially more nodes.
          {data.meta.warnings.map((w, i) => (
            <Typography key={i} variant="caption" display="block">
              {w}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Controls bar */}
      <TopologyControls
        depth={queryParams.depth || 1}
        direction={queryParams.direction || 'both'}
        relationTypes={allRelTypes}
        activeRelTypes={activeRelTypes}
        onDepthChange={handleDepthChange}
        onDirectionChange={handleDirectionChange}
        onRelTypeToggle={handleRelTypeToggle}
      />

      {/* Graph summary */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          px: 1.5,
          py: 0.5,
          bgcolor: 'grey.50',
          borderBottom: 1,
          borderColor: 'divider',
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {data.meta.nodeCount} nodes
        </Typography>
        <Typography variant="caption" color="text.disabled">|</Typography>
        <Typography variant="caption" color="text.secondary">
          {data.meta.edgeCount} edges
        </Typography>
        <Typography variant="caption" color="text.disabled">|</Typography>
        <Typography variant="caption" color="text.secondary">
          depth: {data.meta.depth}
        </Typography>
      </Box>

      {/* React Flow graph */}
      <Box sx={{ flex: 1, minHeight: 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          attributionPosition="bottom-right"
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const tNode = n.data?.topologyNode as TopologyNode | undefined;
              if (!tNode) return '#e0e0e0';
              return NODE_COLORS[tNode.type]?.border || '#757575';
            }}
            style={{ height: 80, width: 120 }}
          />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e0e0e0" />
          <TopologyLegend />
        </ReactFlow>
      </Box>

      {/* Node detail drawer */}
      <NodeDetailDrawer
        detail={selectedDetail}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={onNodeNavigate}
      />
    </Box>
  );
};

export default TopologyGraph;
