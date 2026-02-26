import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Divider,
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
  PlayArrow as ApplyIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  ClassTreeNode,
  ContentPackStatusResponse,
  ContentPackApplyResult,
  PageDiagnosticsSummary,
  unwrapResponse,
  unwrapArrayResponse,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';
import { classifyApiError, ApiErrorKind } from '../../utils/apiErrorClassifier';
import { ClassWorkbenchDetailPanel } from './ClassWorkbenchDetailPanel';

/** Quick filter type for tree view */
type TreeFilter = 'all' | 'system' | 'custom' | 'abstract';

/** Recursive tree node renderer with selection support */
const TreeNodeItem: React.FC<{
  node: ClassTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ node, depth, selectedId, onSelect }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isSelected = node.id === selectedId;

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
          bgcolor: isSelected ? 'primary.50' : 'transparent',
          borderLeft: isSelected ? 3 : 0,
          borderColor: isSelected ? 'primary.main' : 'transparent',
          '&:hover': { bgcolor: isSelected ? 'primary.100' : 'action.hover' },
          transition: 'background-color 0.15s',
        }}
        onClick={() => onSelect(node.id)}
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
          fontWeight={isSelected ? 600 : 500}
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
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

export const CmdbCiClassTree: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Workbench: selected class for inline detail panel
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    searchParams.get('selected') || null
  );

  // Content pack apply state
  const [applying, setApplying] = useState(false);

  // Page-level diagnostics summary
  const [pageDiagnostics, setPageDiagnostics] = useState<PageDiagnosticsSummary | null>(null);

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

  const fetchPageDiagnostics = useCallback(async () => {
    try {
      const response = await cmdbApi.classes.diagnosticsSummary();
      const data = unwrapResponse<PageDiagnosticsSummary>(response);
      if (data && typeof data === 'object' && 'totalClasses' in data) {
        setPageDiagnostics(data);
      }
    } catch {
      // Page diagnostics is non-critical
    }
  }, []);

  useEffect(() => {
    fetchTree();
    fetchContentPackStatus();
  }, [fetchTree, fetchContentPackStatus]);

  // Fetch page-level diagnostics when diagnostics panel is opened
  useEffect(() => {
    if (showDiagnostics) {
      fetchPageDiagnostics();
    }
  }, [showDiagnostics, fetchPageDiagnostics]);

  /** Select a class in the workbench (inline, no navigation away) */
  const handleSelectClass = useCallback(
    (classId: string) => {
      setSelectedClassId(classId);
      setSearchParams({ selected: classId }, { replace: true });
    },
    [setSearchParams]
  );

  /** Close the detail panel */
  const handleCloseDetail = useCallback(() => {
    setSelectedClassId(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  /** Apply content pack */
  const handleApplyContentPack = useCallback(async () => {
    setApplying(true);
    try {
      const response = await cmdbApi.classes.applyContentPack();
      const result = unwrapResponse<ContentPackApplyResult>(response);
      if (result && typeof result === 'object' && 'totalProcessed' in result) {
        showNotification(
          `Content pack applied: ${result.created} created, ${result.updated} updated, ${result.reused} reused, ${result.skipped} skipped`,
          'success'
        );
      } else {
        showNotification('Content pack applied successfully.', 'success');
      }
      // Refresh tree + status after apply
      fetchTree();
      fetchContentPackStatus();
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified.kind === 'forbidden') {
        showNotification('You do not have permission to apply the content pack. Admin access required.', 'error');
      } else {
        showNotification(classified.message || 'Failed to apply content pack.', 'error');
      }
    } finally {
      setApplying(false);
    }
  }, [showNotification, fetchTree, fetchContentPackStatus]);

  /** Refresh all data */
  const handleRefresh = useCallback(() => {
    fetchTree();
    fetchContentPackStatus();
    if (showDiagnostics) {
      fetchPageDiagnostics();
    }
  }, [fetchTree, fetchContentPackStatus, showDiagnostics, fetchPageDiagnostics]);

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* Header Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexShrink: 0, px: 1 }}>
        <IconButton onClick={() => navigate('/cmdb/classes')} data-testid="btn-back-to-classes">
          <ArrowBackIcon />
        </IconButton>
        <TreeIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>
          CMDB Class Hierarchy Workbench
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="text"
          size="small"
          startIcon={<DiagnosticsIcon />}
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          data-testid="btn-toggle-diagnostics"
          color={pageDiagnostics && pageDiagnostics.totalErrors > 0 ? 'error' : 'inherit'}
        >
          Diagnostics
          {pageDiagnostics && pageDiagnostics.totalErrors > 0 && (
            <Chip
              label={pageDiagnostics.totalErrors}
              size="small"
              color="error"
              sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }}
            />
          )}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
          data-testid="btn-refresh-tree"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {/* Content Pack Status Banner */}
      {contentPackStatus && (
        <Card variant="outlined" sx={{ mb: 1, mx: 1, flexShrink: 0 }} data-testid="content-pack-status-card">
          <CardContent sx={{ py: 1, '&:last-child': { pb: 1 }, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
            {contentPackStatus.abstractClasses > 0 && (
              <Chip
                label={`${contentPackStatus.abstractClasses} abstract`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {!contentPackStatus.applied && (
              <Button
                variant="contained"
                size="small"
                startIcon={<ApplyIcon />}
                onClick={handleApplyContentPack}
                disabled={applying}
                data-testid="btn-apply-content-pack"
              >
                {applying ? 'Applying...' : 'Apply Baseline Content Pack'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary chips (system/custom/abstract counts from tree data) */}
      {!loading && !error && treeData.length > 0 && (
        <Box sx={{ mx: 1, mb: 1, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }} data-testid="tree-summary-chips">
          <Chip label={`${totalNodes} total classes`} size="small" variant="outlined" />
          <Chip label={`${rootCount} root class${rootCount !== 1 ? 'es' : ''}`} size="small" variant="outlined" />
          <Chip label={`${countSystemNodes(treeData)} system`} size="small" color="primary" variant="outlined" />
          <Chip label={`${totalNodes - countSystemNodes(treeData)} custom`} size="small" color="secondary" variant="outlined" />
          <Chip label={`${countAbstractNodes(treeData)} abstract`} size="small" color="warning" variant="outlined" />
        </Box>
      )}

      {/* Page-level Diagnostics Summary (collapsible) */}
      <Collapse in={showDiagnostics}>
        <Card variant="outlined" sx={{ mb: 1, mx: 1, bgcolor: 'grey.50' }} data-testid="diagnostics-panel">
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" gutterBottom>Page Diagnostics Summary</Typography>
            {pageDiagnostics ? (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={`${pageDiagnostics.totalClasses} classes`} size="small" variant="outlined" />
                {pageDiagnostics.totalErrors > 0 && (
                  <Chip label={`${pageDiagnostics.totalErrors} errors in ${pageDiagnostics.classesWithErrors} classes`} size="small" color="error" variant="outlined" />
                )}
                {pageDiagnostics.totalWarnings > 0 && (
                  <Chip label={`${pageDiagnostics.totalWarnings} warnings in ${pageDiagnostics.classesWithWarnings} classes`} size="small" color="warning" variant="outlined" />
                )}
                {pageDiagnostics.totalErrors === 0 && pageDiagnostics.totalWarnings === 0 && (
                  <Chip label="All classes healthy" size="small" color="success" variant="outlined" />
                )}
              </Box>
            ) : (
              <CircularProgress size={16} />
            )}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Tree endpoint: {diagnosticInfo?.totalFromEndpoint ?? 'N/A'} classes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Content pack: {diagnosticInfo?.contentPackVersion ?? 'N/A'}
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

      {/* Filters Bar */}
      {!loading && !error && treeData.length > 0 && (
        <Box sx={{ mx: 1, mb: 1, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }} data-testid="tree-filters-bar">
          <TextField
            size="small"
            placeholder="Search classes..."
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
            sx={{ minWidth: 200 }}
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
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label={`${totalNodes} total`} size="small" variant="outlined" />
            <Chip label={`${rootCount} roots`} size="small" variant="outlined" />
          </Box>
          {(treeFilter !== 'all' || searchQuery.trim()) && (
            <Typography variant="caption" color="text.secondary" data-testid="tree-filter-count">
              Showing {filteredCount} of {totalNodes}
            </Typography>
          )}
        </Box>
      )}

      {/* Main Workbench Area: Split Layout */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          gap: 0,
          overflow: 'hidden',
          mx: 1,
          mb: 1,
          minHeight: 0,
        }}
        data-testid="workbench-main-area"
      >
        {/* Left: Tree Panel */}
        <Paper
          variant="outlined"
          sx={{
            flex: selectedClassId ? '0 0 45%' : '1 1 100%',
            overflow: 'auto',
            p: 1,
            transition: 'flex 0.2s ease',
            minWidth: 0,
          }}
          data-testid="tree-container"
        >
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
                <li><Typography variant="body2">The CMDB content pack has not been applied yet.</Typography></li>
                <li><Typography variant="body2">No classes have been created manually.</Typography></li>
                <li><Typography variant="body2">Your current role may not have CMDB read permissions.</Typography></li>
              </Box>
              {contentPackStatus && !contentPackStatus.applied && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<ApplyIcon />}
                  onClick={handleApplyContentPack}
                  disabled={applying}
                  sx={{ mt: 1 }}
                  data-testid="btn-apply-content-pack-empty"
                >
                  {applying ? 'Applying...' : 'Apply Baseline Content Pack'}
                </Button>
              )}
            </Alert>
          )}

          {/* Filtered empty state */}
          {!loading && !error && treeData.length > 0 && filteredTree.length === 0 && (
            <Alert severity="info" data-testid="tree-filter-empty">
              No classes match the current filter. Try adjusting your search or filter criteria.
            </Alert>
          )}

          {!loading && !error && filteredTree.length > 0 && (
            <>
              {filteredTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedClassId}
                  onSelect={handleSelectClass}
                />
              ))}
            </>
          )}
        </Paper>

        {/* Right: Detail Panel (shown when a class is selected) */}
        {selectedClassId && (
          <>
            <Divider orientation="vertical" flexItem />
            <Paper
              variant="outlined"
              sx={{
                flex: '0 0 55%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
              data-testid="workbench-detail-container"
            >
              <ClassWorkbenchDetailPanel
                classId={selectedClassId}
                onClose={handleCloseDetail}
              />
            </Paper>
          </>
        )}
      </Box>

      {/* No selection guidance (only visible when tree is loaded with data but nothing selected) */}
      {!selectedClassId && !loading && !error && treeData.length > 0 && (
        <Box sx={{ textAlign: 'center', py: 0.5, flexShrink: 0 }}>
          <Typography variant="caption" color="text.disabled" data-testid="workbench-no-selection">
            Select a class from the tree to view details, effective schema, and diagnostics
          </Typography>
        </Box>
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
