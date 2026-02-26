/**
 * ClassWorkbenchDetailPanel
 *
 * Inline detail panel for the CMDB Class Hierarchy Workbench.
 * Shows Overview, Effective Schema, and Diagnostics tabs for a selected class.
 * Reuses existing EffectiveSchemaPanel and existing API endpoints.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Tabs,
  Tab,
  Divider,
  Breadcrumbs,
  Link,
  Skeleton,
  IconButton,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  NavigateNext as NavigateNextIcon,
  ErrorOutline as ErrorIcon,
  WarningAmber as WarningIcon,
  InfoOutlined as InfoIcon,
  CheckCircleOutline as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  cmdbApi,
  CmdbCiClassData,
  ClassAncestorEntry,
  ClassDiagnosticsResult,
  DiagnosticItem,
  unwrapResponse,
  unwrapArrayResponse,
} from '../../services/grcClient';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import { EffectiveSchemaPanel } from './EffectiveSchemaPanel';

interface ClassWorkbenchDetailPanelProps {
  classId: string;
  onClose: () => void;
}

/** Tab indices */
const TAB_OVERVIEW = 0;
const TAB_SCHEMA = 1;
const TAB_DIAGNOSTICS = 2;

export const ClassWorkbenchDetailPanel: React.FC<ClassWorkbenchDetailPanelProps> = ({
  classId,
  onClose,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ciClass, setCiClass] = useState<CmdbCiClassData | null>(null);
  const [ancestors, setAncestors] = useState<ClassAncestorEntry[]>([]);
  const [childCount, setChildCount] = useState<number | null>(null);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<ClassDiagnosticsResult | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  // Fetch class detail + ancestors + children count
  const fetchClassDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classRes, ancestorRes] = await Promise.all([
        cmdbApi.classes.get(classId),
        cmdbApi.classes.ancestors(classId),
      ]);

      const classData = unwrapResponse<CmdbCiClassData>(classRes);
      if (classData && typeof classData === 'object' && 'id' in classData) {
        setCiClass(classData);
      } else {
        setError('Class not found.');
        setCiClass(null);
      }

      const ancestorData = unwrapArrayResponse<ClassAncestorEntry>(ancestorRes);
      setAncestors(ancestorData);

      // Fetch descendants to get child count (cheap: just IDs)
      try {
        const descRes = await cmdbApi.classes.descendants(classId);
        const descData = unwrapArrayResponse<string>(descRes);
        setChildCount(descData.length);
      } catch {
        setChildCount(null);
      }
    } catch (err) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to load class details.');
      setCiClass(null);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  // Fetch diagnostics for selected class
  const fetchDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const res = await cmdbApi.classes.diagnostics(classId);
      const data = unwrapResponse<ClassDiagnosticsResult>(res);
      if (data && typeof data === 'object' && 'diagnostics' in data) {
        setDiagnostics(data);
      } else {
        setDiagnostics(null);
      }
    } catch (err) {
      const classified = classifyApiError(err);
      setDiagnosticsError(classified.message || 'Failed to load diagnostics.');
      setDiagnostics(null);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchClassDetail();
  }, [fetchClassDetail]);

  // Fetch diagnostics when tab switches to diagnostics or classId changes
  useEffect(() => {
    if (activeTab === TAB_DIAGNOSTICS) {
      fetchDiagnostics();
    }
  }, [activeTab, fetchDiagnostics]);

  // Reset tab when class changes
  useEffect(() => {
    setActiveTab(TAB_OVERVIEW);
  }, [classId]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }} data-testid="workbench-detail-loading">
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 1 }} />
      </Box>
    );
  }

  if (error || !ciClass) {
    return (
      <Box sx={{ p: 2 }} data-testid="workbench-detail-error">
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchClassDetail}>
              Retry
            </Button>
          }
        >
          {error || 'Class not found.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      data-testid="workbench-detail-panel"
    >
      {/* Header */}
      <Box sx={{ p: 2, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h6" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {ciClass.label || ciClass.name}
          </Typography>
          <IconButton
            size="small"
            onClick={() => navigate(`/cmdb/classes/${classId}`)}
            title="Open full detail page"
            data-testid="btn-open-full-detail"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={onClose}
            title="Close panel"
            data-testid="btn-close-detail-panel"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Technical name */}
        <Typography variant="body2" color="text.secondary" fontFamily="monospace" sx={{ mb: 1 }}>
          {ciClass.name}
        </Typography>

        {/* Badges */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          {ciClass.isSystem ? (
            <Chip label="System" size="small" color="primary" data-testid="detail-badge-system" />
          ) : (
            <Chip label="Custom" size="small" variant="outlined" color="secondary" data-testid="detail-badge-custom" />
          )}
          {ciClass.isAbstract && (
            <Chip label="Abstract" size="small" variant="outlined" color="warning" data-testid="detail-badge-abstract" />
          )}
          <Chip
            label={ciClass.isActive ? 'Active' : 'Inactive'}
            size="small"
            color={ciClass.isActive ? 'success' : 'default'}
            data-testid="detail-badge-status"
          />
        </Box>

        {/* Inheritance breadcrumb */}
        {ancestors.length > 0 && (
          <Breadcrumbs
            separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
            sx={{ mb: 1 }}
            data-testid="detail-inheritance-breadcrumb"
          >
            {[...ancestors].reverse().map((ancestor) => (
              <Link
                key={ancestor.id}
                component="button"
                variant="caption"
                underline="hover"
                color="text.secondary"
                onClick={() => navigate(`/cmdb/classes/${ancestor.id}`)}
                sx={{ cursor: 'pointer' }}
              >
                {ancestor.label || ancestor.name}
              </Link>
            ))}
            <Typography variant="caption" color="text.primary" fontWeight={600}>
              {ciClass.label || ciClass.name}
            </Typography>
          </Breadcrumbs>
        )}
      </Box>

      <Divider />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        variant="fullWidth"
        sx={{ flexShrink: 0, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}
        data-testid="workbench-detail-tabs"
      >
        <Tab label="Overview" data-testid="tab-overview" />
        <Tab label="Effective Schema" data-testid="tab-effective-schema" />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Diagnostics
              {diagnostics && diagnostics.errorCount > 0 && (
                <Chip label={diagnostics.errorCount} size="small" color="error" sx={{ height: 18, fontSize: '0.7rem' }} />
              )}
              {diagnostics && diagnostics.warningCount > 0 && diagnostics.errorCount === 0 && (
                <Chip label={diagnostics.warningCount} size="small" color="warning" sx={{ height: 18, fontSize: '0.7rem' }} />
              )}
            </Box>
          }
          data-testid="tab-diagnostics"
        />
      </Tabs>

      <Divider />

      {/* Tab content - scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === TAB_OVERVIEW && (
          <OverviewTab
            ciClass={ciClass}
            ancestors={ancestors}
            childCount={childCount}
          />
        )}

        {activeTab === TAB_SCHEMA && (
          <EffectiveSchemaPanel classId={classId} />
        )}

        {activeTab === TAB_DIAGNOSTICS && (
          <DiagnosticsTab
            diagnostics={diagnostics}
            loading={diagnosticsLoading}
            error={diagnosticsError}
            onRetry={fetchDiagnostics}
          />
        )}
      </Box>
    </Box>
  );
};

// =============================================================================
// Overview Tab
// =============================================================================

const OverviewTab: React.FC<{
  ciClass: CmdbCiClassData;
  ancestors: ClassAncestorEntry[];
  childCount: number | null;
}> = ({ ciClass, ancestors, childCount }) => {
  const localFieldCount = ciClass.fieldsSchema?.length ?? 0;

  return (
    <Box data-testid="overview-tab-content">
      {/* Description */}
      {ciClass.description && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Description
          </Typography>
          <Typography variant="body2">{ciClass.description}</Typography>
        </Box>
      )}

      {/* Metadata grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1.5,
          mb: 2,
        }}
      >
        <MetadataItem label="Technical Name" value={ciClass.name} mono />
        <MetadataItem label="Display Label" value={ciClass.label} />
        <MetadataItem
          label="Parent Class"
          value={
            ancestors.length > 0
              ? ancestors[0].label || ancestors[0].name
              : 'None (root class)'
          }
        />
        <MetadataItem
          label="Inheritance Depth"
          value={String(ancestors.length)}
        />
        <MetadataItem label="Local Fields" value={String(localFieldCount)} />
        <MetadataItem
          label="Child Classes"
          value={childCount !== null ? String(childCount) : '-'}
        />
        <MetadataItem label="Sort Order" value={String(ciClass.sortOrder)} />
        <MetadataItem
          label="Created"
          value={ciClass.createdAt ? new Date(ciClass.createdAt).toLocaleDateString() : '-'}
        />
      </Box>

      {/* No description notice */}
      {!ciClass.description && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          No description set for this class.
        </Alert>
      )}

      {/* Placeholder: future capabilities */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.disabled">
        Relationship Semantics, Usage / Impact Analysis &mdash; coming in v1.1
      </Typography>
    </Box>
  );
};

const MetadataItem: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
}> = ({ label, value, mono }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" fontWeight={600}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      fontFamily={mono ? 'monospace' : undefined}
      sx={{ wordBreak: 'break-word' }}
    >
      {value}
    </Typography>
  </Box>
);

// =============================================================================
// Diagnostics Tab
// =============================================================================

const severityIcon: Record<string, React.ReactNode> = {
  error: <ErrorIcon fontSize="small" color="error" />,
  warning: <WarningIcon fontSize="small" color="warning" />,
  info: <InfoIcon fontSize="small" color="info" />,
};

const DiagnosticsTab: React.FC<{
  diagnostics: ClassDiagnosticsResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}> = ({ diagnostics, loading, error, onRetry }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} data-testid="diagnostics-loading">
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
        data-testid="diagnostics-error"
      >
        {error}
      </Alert>
    );
  }

  if (!diagnostics) {
    return (
      <Alert severity="info" data-testid="diagnostics-empty">
        No diagnostics data available.
      </Alert>
    );
  }

  const items = diagnostics.diagnostics;

  // All clear state
  if (items.length === 1 && items[0].code === 'ALL_CLEAR') {
    return (
      <Alert severity="success" icon={<CheckCircleIcon />} data-testid="diagnostics-all-clear">
        <Typography variant="subtitle2">No issues detected</Typography>
        <Typography variant="body2" color="text.secondary">
          Class configuration is valid. No errors, warnings, or concerns found.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box data-testid="diagnostics-tab-content">
      {/* Summary chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {diagnostics.errorCount > 0 && (
          <Chip
            icon={<ErrorIcon />}
            label={`${diagnostics.errorCount} error${diagnostics.errorCount > 1 ? 's' : ''}`}
            size="small"
            color="error"
            variant="outlined"
          />
        )}
        {diagnostics.warningCount > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${diagnostics.warningCount} warning${diagnostics.warningCount > 1 ? 's' : ''}`}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
        {diagnostics.infoCount > 0 && (
          <Chip
            icon={<InfoIcon />}
            label={`${diagnostics.infoCount} info`}
            size="small"
            color="info"
            variant="outlined"
          />
        )}
      </Box>

      {/* Diagnostic items */}
      {items.map((item: DiagnosticItem, idx: number) => (
        <Box
          key={`${item.code}-${idx}`}
          sx={{
            display: 'flex',
            gap: 1,
            mb: 1.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor:
              item.severity === 'error'
                ? 'error.50'
                : item.severity === 'warning'
                  ? 'warning.50'
                  : 'grey.50',
            border: 1,
            borderColor:
              item.severity === 'error'
                ? 'error.200'
                : item.severity === 'warning'
                  ? 'warning.200'
                  : 'grey.200',
          }}
          data-testid={`diagnostic-item-${item.code}`}
        >
          <Box sx={{ pt: 0.25 }}>
            {severityIcon[item.severity] || severityIcon.info}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {item.message}
            </Typography>
            {item.suggestedAction && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Suggestion: {item.suggestedAction}
              </Typography>
            )}
            <Typography variant="caption" color="text.disabled" fontFamily="monospace">
              {item.code}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default ClassWorkbenchDetailPanel;
