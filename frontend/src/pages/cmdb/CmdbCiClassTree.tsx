import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  AccountTree as TreeIcon,
  Search as SearchIcon,
  BugReport as DiagnosticsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  ClassTreeNode,
  ContentPackStatusResponse,
  unwrapResponse,
  unwrapArrayResponse,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { classifyApiError, ApiErrorKind } from '../../utils/apiErrorClassifier';

/** Quick filter type for tree view */
type TreeFilter = 'all' | 'system' | 'custom' | 'abstract';

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
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);
  const [treeData, setTreeData] = useState<ClassTreeNode[]>([]);
  const [contentPackStatus, setContentPackStatus] = useState<ContentPackStatusResponse | null>(null);
  const [treeFilter, setTreeFilter] = useState<TreeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    totalFromEndpoint: number;
    fetchTimestamp: string;
    contentPackVersion: string | null;
    tenantScoped: boolean;
  } | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      const response = await cmdbApi.classes.tree();
      const nodes = unwrapArrayResponse<ClassTreeNode>(response);
      setTreeData(nodes);
      setDiagnosticInfo(prev => ({
        ...prev,
        totalFromEndpoint: countNodes(nodes),
        fetchTimestamp: new Date().toISOString(),
        contentPackVersion: prev?.contentPackVersion ?? null,
        tenantScoped: true,
      }));
    } catch (err) {
      const classified = classifyApiError(err);
      console.error('Error fetching class tree:', err);
      setErrorKind(classified.kind);
      if (classified.kind === 'forbidden') {
        setError('You do not have permission to view the class hierarchy. Contact your administrator to request CMDB_CLASS_READ permission.');
      } else if (classified.kind === 'network') {
        setError('Network error. Please check your connection and try again.');
      } else if (classified.kind === 'auth') {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(classified.message || 'Failed to load class hierarchy tree.');
      }
      showNotification(classified.message || 'Failed to load class hierarchy tree.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const fetchContentPackStatus = useCallback(async () => {
    try {
      const response = await cmdbApi.classes.contentPackStatus();
      const data = unwrapResponse<ContentPackStatusResponse>(response);
      if (data && typeof data === 'object' && 'applied' in data) {
        setContentPackStatus(data);
        setDiagnosticInfo(prev => ({
          totalFromEndpoint: prev?.totalFromEndpoint ?? 0,
          fetchTimestamp: prev?.fetchTimestamp ?? new Date().toISOString(),
          contentPackVersion: data.version,
          tenantScoped: true,
        }));
      }
    } catch {
      // Content pack status is non-critical
    }
  }, []);

  useEffect(() => {
    fetchTree();
    fetchContentPackStatus();
  }, [fetchTree, fetchContentPackStatus]);

  const handleNavigate = useCallback(
    (classId: string) => {
      navigate(`/cmdb/classes/${classId}`);
    },
    [navigate]
  );

  /** Apply quick filters and search to the tree */
  const filteredTree = useMemo(() => {
    const filterNode = (node: ClassTreeNode): ClassTreeNode | null => {
      // Apply type filter
      let matchesFilter = true;
      if (treeFilter === 'system') matchesFilter = node.isSystem;
      else if (treeFilter === 'custom') matchesFilter = !node.isSystem;
      else if (treeFilter === 'abstract') matchesFilter = node.isAbstract;

      // Apply search
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query ||
        node.name.toLowerCase().includes(query) ||
        node.label.toLowerCase().includes(query);

      // Recursively filter children
      const filteredChildren = (node.children || []).map(filterNode).filter(Boolean) as ClassTreeNode[];

      // Include node if it matches or has matching descendants
      if ((matchesFilter && matchesSearch) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    if (treeFilter === 'all' && !searchQuery.trim()) return treeData;
    return treeData.map(filterNode).filter(Boolean) as ClassTreeNode[];
  }, [treeData, treeFilter, searchQuery]);

  const totalNodes = countNodes(treeData);
  const rootCount = treeData.length;
  const filteredCount = countNodes(filteredTree);

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
          variant="text"
          size="small"
          startIcon={<DiagnosticsIcon />}
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          data-testid="btn-toggle-diagnostics"
        >
          Diagnostics
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => { fetchTree(); fetchContentPackStatus(); }}
          disabled={loading}
          data-testid="btn-refresh-tree"
        >
          Refresh
        </Button>
      </Box>

      {/* Content Pack Status Card */}
      {contentPackStatus && (
        <Card variant="outlined" sx={{ mb: 2 }} data-testid="content-pack-status-card">
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {contentPackStatus.applied ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <WarningIcon color="warning" fontSize="small" />
            )}
            <Typography variant="subtitle2">
              Baseline Content Pack: {contentPackStatus.applied ? 'Applied' : 'Not Applied'}
            </Typography>
            {contentPackStatus.version && (
              <Chip label={contentPackStatus.version} size="small" variant="outlined" />
            )}
            <Chip
              label={`${contentPackStatus.systemClasses} system`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`${contentPackStatus.customClasses} custom`}
              size="small"
              color="secondary"
              variant="outlined"
            />
            {!contentPackStatus.applied && (
              <Typography variant="body2" color="text.secondary">
                Run the content-pack seed to populate system CI classes.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary chips + Quick Filters */}
      {!loading && !error && treeData.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }} data-testid="tree-summary-chips">
          <Chip label={`${totalNodes} total classes`} size="small" variant="outlined" />
          <Chip label={`${rootCount} root class${rootCount !== 1 ? 'es' : ''}`} size="small" variant="outlined" />
          <Chip label={`${countSystemNodes(treeData)} system`} size="small" color="primary" variant="outlined" />
          <Chip label={`${totalNodes - countSystemNodes(treeData)} custom`} size="small" color="secondary" variant="outlined" />
          <Chip label={`${countAbstractNodes(treeData)} abstract`} size="small" color="warning" variant="outlined" />
        </Box>
      )}

      {/* Quick Filters Bar */}
      {!loading && !error && treeData.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }} data-testid="tree-filters-bar">
          <TextField
            size="small"
            placeholder="Search by name or label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="tree-search-input"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 240 }}
          />
          <ToggleButtonGroup
            value={treeFilter}
            exclusive
            onChange={(_, val) => val && setTreeFilter(val as TreeFilter)}
            size="small"
            data-testid="tree-filter-toggle"
          >
            <ToggleButton value="all" data-testid="filter-all">All</ToggleButton>
            <ToggleButton value="system" data-testid="filter-system">System</ToggleButton>
            <ToggleButton value="custom" data-testid="filter-custom">Custom</ToggleButton>
            <ToggleButton value="abstract" data-testid="filter-abstract">Abstract</ToggleButton>
          </ToggleButtonGroup>
          {(treeFilter !== 'all' || searchQuery.trim()) && (
            <Typography variant="caption" color="text.secondary" data-testid="tree-filter-count">
              Showing {filteredCount} of {totalNodes} classes
            </Typography>
          )}
        </Box>
      )}

      {/* Collapsible Diagnostics Panel */}
      <Collapse in={showDiagnostics}>
        <Card variant="outlined" sx={{ mb: 2, bgcolor: 'grey.50' }} data-testid="diagnostics-panel">
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" gutterBottom>Diagnostics</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Tree endpoint response: {diagnosticInfo?.totalFromEndpoint ?? 'N/A'} classes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Content pack version: {diagnosticInfo?.contentPackVersion ?? 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tenant-scoped: {diagnosticInfo?.tenantScoped ? 'Yes' : 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last fetched: {diagnosticInfo?.fetchTimestamp ? new Date(diagnosticInfo.fetchTimestamp).toLocaleString() : 'N/A'}
              </Typography>
              {errorKind && (
                <Typography variant="body2" color="error.main">
                  Last error type: {errorKind}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Collapse>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} data-testid="tree-loading">
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Alert
          severity={errorKind === 'forbidden' ? 'warning' : 'error'}
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
          {contentPackStatus && !contentPackStatus.applied && (
            <Alert severity="warning" variant="outlined" sx={{ mt: 1, mb: 1 }}>
              <Typography variant="body2">
                <strong>Confirmed:</strong> The baseline content pack has not been applied for this tenant.
                Contact an administrator to run the content-pack seed.
              </Typography>
            </Alert>
          )}
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

      {/* Filtered empty state */}
      {!loading && !error && treeData.length > 0 && filteredTree.length === 0 && (
        <Alert severity="info" data-testid="tree-filter-empty">
          No classes match the current filter. Try adjusting your search or filter criteria.
        </Alert>
      )}

      {!loading && !error && filteredTree.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1 }} data-testid="tree-container">
          {filteredTree.map((node) => (
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

/** Count abstract nodes in tree recursively */
function countAbstractNodes(nodes: ClassTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isAbstract) count += 1;
    if (Array.isArray(node.children)) {
      count += countAbstractNodes(node.children);
    }
  }
  return count;
}

export default CmdbCiClassTree;
