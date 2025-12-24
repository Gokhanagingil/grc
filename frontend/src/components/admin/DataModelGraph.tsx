/**
 * Data Model Graph Component
 * 
 * Visual representation of the platform's data model using ReactFlow.
 * This is the KEY DELIVERABLE for FAZ 2 Admin Studio.
 * 
 * Features:
 * - Tables rendered as nodes with field counts and metadata indicators
 * - Relationships rendered as edges with type labels
 * - Interactive: pan, zoom, click to select
 * - Relationship types visually distinct (1:1, 1:N, N:1, M:N)
 * - Clicking a node shows table details
 * - Clicking an edge shows relationship details
 * 
 * Data source: Dictionary metadata (NOT database introspection)
 */

import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  NodeProps,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Business as TenantIcon,
  Delete as SoftDeleteIcon,
  TableChart as TableIcon,
} from '@mui/icons-material';
import {
  DataModelGraph,
  DataModelGraphNode,
  DataModelGraphEdge,
  DictionaryTable,
} from '../../services/grcClient';
import { t, ADMIN_DATA_MODEL_KEYS } from '../../i18n';

interface DataModelGraphProps {
  graph: DataModelGraph;
  tables: DictionaryTable[];
  selectedTable: DictionaryTable | null;
  onTableSelect: (table: DictionaryTable) => void;
}

interface TableNodeData {
  label: string;
  tableName: string;
  fieldCount: number;
  isTenantScoped: boolean;
  hasSoftDelete: boolean;
  isSelected: boolean;
}

interface RelationshipEdgeData {
  label: string;
  type: string;
  sourceField: string;
}

const getRelationshipTypeLabel = (type: string): string => {
  const labelMap: Record<string, string> = {
    'one-to-one': '1:1',
    'one-to-many': '1:N',
    'many-to-one': 'N:1',
    'many-to-many': 'M:N',
  };
  return labelMap[type] || type;
};

const getRelationshipColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    'one-to-one': '#2196f3',
    'one-to-many': '#4caf50',
    'many-to-one': '#ff9800',
    'many-to-many': '#9c27b0',
  };
  return colorMap[type] || '#757575';
};

const TableNode: React.FC<NodeProps<TableNodeData>> = ({ data, selected }) => {
  const isHighlighted = data.isSelected || selected;
  
  return (
    <Paper
      elevation={isHighlighted ? 8 : 2}
      sx={{
        p: 1.5,
        minWidth: 180,
        maxWidth: 220,
        border: isHighlighted ? '2px solid #1976d2' : '1px solid #e0e0e0',
        borderRadius: 2,
        bgcolor: isHighlighted ? '#e3f2fd' : 'white',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          elevation: 4,
          borderColor: '#1976d2',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TableIcon fontSize="small" color={isHighlighted ? 'primary' : 'action'} />
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: isHighlighted ? 600 : 500,
            color: isHighlighted ? 'primary.main' : 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.label}
        </Typography>
      </Box>
      
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          mb: 1,
          fontFamily: 'monospace',
          fontSize: '0.7rem',
        }}
      >
        {data.tableName}
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip
          label={`${data.fieldCount} fields`}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem' }}
        />
        {data.isTenantScoped && (
          <Tooltip title={t(ADMIN_DATA_MODEL_KEYS.tableList.tenantScopedTooltip)}>
            <TenantIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          </Tooltip>
        )}
        {data.hasSoftDelete && (
          <Tooltip title={t(ADMIN_DATA_MODEL_KEYS.tableList.softDeleteTooltip)}>
            <SoftDeleteIcon sx={{ fontSize: 16, color: 'action.active' }} />
          </Tooltip>
        )}
      </Box>
    </Paper>
  );
};

const RelationshipEdge: React.FC<EdgeProps<RelationshipEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = data ? getRelationshipColor(data.type) : '#757575';
  const typeLabel = data ? getRelationshipTypeLabel(data.type) : '';

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            bgcolor: 'white',
            border: `1px solid ${edgeColor}`,
            borderRadius: 1,
            px: 0.5,
            py: 0.25,
            fontSize: '0.65rem',
            fontWeight: 500,
            color: edgeColor,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: edgeColor,
              color: 'white',
            },
          }}
          className="nodrag nopan"
        >
          {typeLabel}
        </Box>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = {
  tableNode: TableNode,
};

const edgeTypes = {
  relationshipEdge: RelationshipEdge,
};

export const DataModelGraphComponent: React.FC<DataModelGraphProps> = ({
  graph,
  tables,
  selectedTable,
  onTableSelect,
}) => {
  const [selectedEdge, setSelectedEdge] = useState<DataModelGraphEdge | null>(null);
  const [edgeDialogOpen, setEdgeDialogOpen] = useState(false);

  const { initialNodes, initialEdges } = useMemo(() => {
    const relevantNodes = selectedTable
      ? graph.nodes.filter(
          (n) =>
            n.id === selectedTable.name ||
            graph.edges.some(
              (e) =>
                (e.source === selectedTable.name && e.target === n.id) ||
                (e.target === selectedTable.name && e.source === n.id)
            )
        )
      : graph.nodes.slice(0, 30);

    const relevantEdges = selectedTable
      ? graph.edges.filter(
          (e) => e.source === selectedTable.name || e.target === selectedTable.name
        )
      : graph.edges.filter(
          (e) =>
            relevantNodes.some((n) => n.id === e.source) &&
            relevantNodes.some((n) => n.id === e.target)
        );

    const nodePositions = calculateNodePositions(relevantNodes, relevantEdges, selectedTable?.name);

    const nodes: Node<TableNodeData>[] = relevantNodes.map((node, index) => ({
      id: node.id,
      type: 'tableNode',
      position: nodePositions[node.id] || { x: (index % 5) * 250, y: Math.floor(index / 5) * 150 },
      data: {
        label: node.label,
        tableName: node.tableName,
        fieldCount: node.fieldCount,
        isTenantScoped: node.isTenantScoped,
        hasSoftDelete: node.hasSoftDelete,
        isSelected: selectedTable?.name === node.id,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    const edges: Edge<RelationshipEdgeData>[] = relevantEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'relationshipEdge',
      data: {
        label: edge.label,
        type: edge.type,
        sourceField: edge.sourceField,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: getRelationshipColor(edge.type),
      },
      style: {
        stroke: getRelationshipColor(edge.type),
      },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [graph, selectedTable]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<TableNodeData>) => {
      const table = tables.find((t) => t.name === node.id);
      if (table) {
        onTableSelect(table);
      }
    },
    [tables, onTableSelect]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge<RelationshipEdgeData>) => {
      const graphEdge = graph.edges.find((e) => e.id === edge.id);
      if (graphEdge) {
        setSelectedEdge(graphEdge);
        setEdgeDialogOpen(true);
      }
    },
    [graph.edges]
  );

  const handleCloseEdgeDialog = () => {
    setEdgeDialogOpen(false);
    setSelectedEdge(null);
  };

  return (
    <Box sx={{ height: 500, width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'relationshipEdge',
        }}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as TableNodeData;
            return data.isSelected ? '#1976d2' : '#e0e0e0';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Background color="#f5f5f5" gap={16} />
      </ReactFlow>

      <Dialog open={edgeDialogOpen} onClose={handleCloseEdgeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t(ADMIN_DATA_MODEL_KEYS.relationships.title)}
        </DialogTitle>
        <DialogContent>
          {selectedEdge && (
            <List>
              <ListItem>
                <ListItemText
                  primary={t(ADMIN_DATA_MODEL_KEYS.relationships.name)}
                  secondary={selectedEdge.label}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary={t(ADMIN_DATA_MODEL_KEYS.relationships.type)}
                  secondary={
                    <Chip
                      label={getRelationshipTypeLabel(selectedEdge.type)}
                      size="small"
                      sx={{
                        bgcolor: getRelationshipColor(selectedEdge.type),
                        color: 'white',
                      }}
                    />
                  }
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Source Table"
                  secondary={selectedEdge.source}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Source Field"
                  secondary={selectedEdge.sourceField}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary={t(ADMIN_DATA_MODEL_KEYS.relationships.targetTable)}
                  secondary={selectedEdge.target}
                />
              </ListItem>
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdgeDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function calculateNodePositions(
  nodes: DataModelGraphNode[],
  edges: DataModelGraphEdge[],
  selectedNodeId?: string
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  
  if (nodes.length === 0) return positions;

  const centerX = 400;
  const centerY = 200;
  const radiusX = 350;
  const radiusY = 180;

  if (selectedNodeId) {
    positions[selectedNodeId] = { x: centerX, y: centerY };
    
    const connectedNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const angleStep = (2 * Math.PI) / Math.max(connectedNodes.length, 1);
    
    connectedNodes.forEach((node, index) => {
      const angle = index * angleStep - Math.PI / 2;
      positions[node.id] = {
        x: centerX + radiusX * Math.cos(angle),
        y: centerY + radiusY * Math.sin(angle),
      };
    });
  } else {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = { x: 280, y: 160 };
    
    nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions[node.id] = {
        x: col * spacing.x + 50,
        y: row * spacing.y + 50,
      };
    });
  }

  return positions;
}

export default DataModelGraphComponent;
