import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  IconButton,
  Collapse,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  AccountTree as TreeIcon,
} from '@mui/icons-material';
import { cmdbApi, ClassTreeNode } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

/** Recursive tree node renderer */
const TreeNodeItem: React.FC<{
  node: ClassTreeNode;
  depth: number;
  onNavigate: (id: string) => void;
}> = ({ node, depth, onNavigate }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <Box>
      <Box
        data-testid={`tree-node-${node.id}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.75,
          px: 1,
          pl: depth * 3 + 1,
          cursor: 'pointer',
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
          transition: 'background-color 0.15s',
        }}
        onClick={() => onNavigate(node.id)}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            data-testid={`tree-toggle-${node.id}`}
            sx={{ mr: 0.5 }}
          >
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 34, mr: 0.5 }} />
        )}
        <Typography
          variant="body2"
          fontWeight={500}
          sx={{ mr: 1, flexShrink: 0 }}
        >
          {node.label || node.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          fontFamily="monospace"
          sx={{ mr: 1 }}
        >
          {node.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', alignItems: 'center' }}>
          {node.isSystem && (
            <Chip
              label="System"
              size="small"
              color="primary"
              data-testid={`tree-system-${node.id}`}
            />
          )}
          {node.isAbstract && (
            <Chip
              label="Abstract"
              size="small"
              variant="outlined"
              color="warning"
              data-testid={`tree-abstract-${node.id}`}
            />
          )}
          {!node.isActive && (
            <Chip label="Inactive" size="small" color="default" />
          )}
          {node.localFieldCount > 0 && (
            <Chip
              label={`${node.localFieldCount} field${node.localFieldCount > 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              color="info"
            />
          )}
          {hasChildren && (
            <Typography variant="caption" color="text.secondary">
              {node.children.length} child{node.children.length > 1 ? 'ren' : ''}
            </Typography>
          )}
        </Box>
      </Box>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

export const CmdbCiClassTree: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<ClassTreeNode[]>([]);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cmdbApi.classes.tree();
      const data = response.data;
      let nodes: ClassTreeNode[] = [];
      if (data && 'data' in data && Array.isArray(data.data)) {
        nodes = data.data;
      } else if (Array.isArray(data)) {
        nodes = data;
      } else if (data && 'data' in data && data.data && typeof data.data === 'object') {
        // Handle envelope with items array
        const inner = data.data as Record<string, unknown>;
        if ('items' in inner && Array.isArray(inner.items)) {
          nodes = inner.items;
        }
      }
      setTreeData(nodes);
    } catch (err) {
      console.error('Error fetching class tree:', err);
      setError('Failed to load class hierarchy tree.');
      showNotification('Failed to load class hierarchy tree.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleNavigate = useCallback(
    (classId: string) => {
      navigate(`/cmdb/classes/${classId}`);
    },
    [navigate]
  );

  const totalNodes = countNodes(treeData);
  const rootCount = treeData.length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/cmdb/classes')} data-testid="btn-back-to-classes">
          <ArrowBackIcon />
        </IconButton>
        <TreeIcon color="primary" />
        <Typography variant="h4" fontWeight={600}>
          CI Class Hierarchy
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchTree}
          disabled={loading}
          data-testid="btn-refresh-tree"
        >
          Refresh
        </Button>
      </Box>

      {!loading && !error && treeData.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }} data-testid="tree-summary-chips">
          <Chip label={`${totalNodes} total classes`} size="small" variant="outlined" />
          <Chip label={`${rootCount} root class${rootCount !== 1 ? 'es' : ''}`} size="small" variant="outlined" />
          <Chip label={`${countSystemNodes(treeData)} system`} size="small" color="primary" variant="outlined" />
          <Chip label={`${totalNodes - countSystemNodes(treeData)} custom`} size="small" color="secondary" variant="outlined" />
        </Box>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} data-testid="tree-loading">
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Alert
          severity="error"
          data-testid="tree-error"
          action={
            <Button color="inherit" size="small" onClick={fetchTree}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!loading && !error && treeData.length === 0 && (
        <Alert severity="info" data-testid="tree-empty">
          <Typography variant="subtitle2" gutterBottom>No CI classes found</Typography>
          <Typography variant="body2">
            The class hierarchy is empty. This usually means one of:
          </Typography>
          <Box component="ul" sx={{ mt: 0.5, mb: 0.5, pl: 2 }}>
            <li><Typography variant="body2">The CMDB content pack has not been applied yet. Ask an admin to run the content-pack seed.</Typography></li>
            <li><Typography variant="body2">No classes have been created manually. Go to <strong>CI Classes</strong> to create your first class.</Typography></li>
            <li><Typography variant="body2">Your current role may not have CMDB read permissions.</Typography></li>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate('/cmdb/classes')}
            sx={{ mt: 1 }}
          >
            Go to CI Classes
          </Button>
        </Alert>
      )}

      {!loading && !error && treeData.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1 }} data-testid="tree-container">
          {treeData.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              depth={0}
              onNavigate={handleNavigate}
            />
          ))}
        </Paper>
      )}
    </Box>
  );
};

/** Count total nodes in tree recursively */
function countNodes(nodes: ClassTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (Array.isArray(node.children)) {
      count += countNodes(node.children);
    }
  }
  return count;
}

/** Count system nodes in tree recursively */
function countSystemNodes(nodes: ClassTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isSystem) count += 1;
    if (Array.isArray(node.children)) {
      count += countSystemNodes(node.children);
    }
  }
  return count;
}

export default CmdbCiClassTree;
