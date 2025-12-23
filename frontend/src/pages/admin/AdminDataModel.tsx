import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Collapse,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  TableChart as TableIcon,
  Link as LinkIcon,
  AccountTree as TreeIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Key as KeyIcon,
  Schedule as AuditIcon,
  Business as TenantIcon,
  Delete as SoftDeleteIcon,
  ArrowForward as ArrowIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  dataModelApi,
  DictionaryTable,
  DotWalkPath,
  DataModelSummary,
  DataModelGraph,
} from '../../services/grcClient';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`data-model-tabpanel-${index}`}
      aria-labelledby={`data-model-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const getFieldTypeColor = (type: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
  const colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
    string: 'primary',
    text: 'primary',
    integer: 'success',
    decimal: 'success',
    boolean: 'warning',
    date: 'info',
    datetime: 'info',
    uuid: 'secondary',
    enum: 'error',
    json: 'default',
    reference: 'secondary',
    unknown: 'default',
  };
  return colorMap[type] || 'default';
};

const getRelationshipTypeLabel = (type: string): string => {
  const labelMap: Record<string, string> = {
    'one-to-one': '1:1',
    'one-to-many': '1:N',
    'many-to-one': 'N:1',
    'many-to-many': 'M:N',
  };
  return labelMap[type] || type;
};

const getRelationshipTypeColor = (type: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
  const colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
    'one-to-one': 'info',
    'one-to-many': 'primary',
    'many-to-one': 'secondary',
    'many-to-many': 'warning',
  };
  return colorMap[type] || 'default';
};

export default function AdminDataModel() {
  const [activeTab, setActiveTab] = useState(0);
  const [tables, setTables] = useState<DictionaryTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<DictionaryTable | null>(null);
  const [summary, setSummary] = useState<DataModelSummary | null>(null);
  const [graph, setGraph] = useState<DataModelGraph | null>(null);
  const [dotWalkPaths, setDotWalkPaths] = useState<DotWalkPath[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTenantScopedOnly, setShowTenantScopedOnly] = useState(false);
  const [showWithRelationshipsOnly, setShowWithRelationshipsOnly] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, summaryRes, graphRes] = await Promise.all([
        dataModelApi.listTables({
          tenantScopedOnly: showTenantScopedOnly,
          withRelationships: showWithRelationshipsOnly,
          search: searchQuery || undefined,
        }),
        dataModelApi.getSummary(),
        dataModelApi.getGraph(),
      ]);

      const tablesData = tablesRes.data?.data || [];
      const summaryData = summaryRes.data?.data || null;
      const graphData = graphRes.data?.data || null;

      setTables(tablesData);
      setSummary(summaryData);
      setGraph(graphData);

      if (tablesData.length > 0 && !selectedTable) {
        setSelectedTable(tablesData[0]);
      }
    } catch (err) {
      console.error('Failed to load data model:', err);
      setError('Failed to load data model. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [showTenantScopedOnly, showWithRelationshipsOnly, searchQuery, selectedTable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDotWalkPaths = useCallback(async (tableName: string) => {
    try {
      const response = await dataModelApi.getDotWalkingPaths(tableName, 3);
      const paths = response.data?.data || [];
      setDotWalkPaths(paths);
    } catch (err) {
      console.error('Failed to load dot-walking paths:', err);
      setDotWalkPaths([]);
    }
  }, []);

  useEffect(() => {
    if (selectedTable && activeTab === 2) {
      loadDotWalkPaths(selectedTable.name);
    }
  }, [selectedTable, activeTab, loadDotWalkPaths]);

  const handleTableSelect = (table: DictionaryTable) => {
    setSelectedTable(table);
    setExpandedFields(new Set());
  };

  const handleRefresh = async () => {
    try {
      await dataModelApi.refreshCache();
      await loadData();
    } catch (err) {
      console.error('Failed to refresh cache:', err);
    }
  };

  const toggleFieldExpand = (fieldName: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  };

  const filteredTables = useMemo(() => {
    if (!searchQuery) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.label.toLowerCase().includes(query) ||
        t.tableName.toLowerCase().includes(query)
    );
  }, [tables, searchQuery]);

  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Tables
              </Typography>
              <Typography variant="h4">{summary.totalTables}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Relationships
              </Typography>
              <Typography variant="h4">{summary.totalRelationships}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Tenant-Scoped Tables
              </Typography>
              <Typography variant="h4">{summary.tenantScopedTables}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Soft Delete Tables
              </Typography>
              <Typography variant="h4">{summary.tablesWithSoftDelete}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderTableList = () => (
    <Paper sx={{ height: '100%', overflow: 'auto' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search tables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showTenantScopedOnly}
                onChange={(e) => setShowTenantScopedOnly(e.target.checked)}
              />
            }
            label={<Typography variant="caption">Tenant-scoped only</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showWithRelationshipsOnly}
                onChange={(e) => setShowWithRelationshipsOnly(e.target.checked)}
              />
            }
            label={<Typography variant="caption">With relationships</Typography>}
          />
        </Box>
      </Box>
      <Divider />
      <List dense>
        {filteredTables.map((table) => (
          <ListItem key={table.name} disablePadding>
            <ListItemButton
              selected={selectedTable?.name === table.name}
              onClick={() => handleTableSelect(table)}
            >
              <ListItemIcon>
                <TableIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={table.label}
                secondary={table.tableName}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {table.isTenantScoped && (
                  <Tooltip title="Tenant-scoped">
                    <TenantIcon fontSize="small" color="primary" />
                  </Tooltip>
                )}
                {table.hasSoftDelete && (
                  <Tooltip title="Soft delete">
                    <SoftDeleteIcon fontSize="small" color="action" />
                  </Tooltip>
                )}
                {table.relationships.length > 0 && (
                  <Badge badgeContent={table.relationships.length} color="secondary">
                    <LinkIcon fontSize="small" />
                  </Badge>
                )}
              </Box>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );

  const renderFieldsTable = () => {
    if (!selectedTable) return null;

    const fields = selectedTable.fields;
    const regularFields = fields.filter((f) => !f.isAuditField);
    const auditFields = fields.filter((f) => f.isAuditField);

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Fields ({regularFields.length})
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Column</TableCell>
                <TableCell align="center">Required</TableCell>
                <TableCell align="center">Primary</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regularFields.map((field) => (
                <React.Fragment key={field.name}>
                  <TableRow
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => toggleFieldExpand(field.name)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {field.isPrimaryKey && (
                          <Tooltip title="Primary Key">
                            <KeyIcon fontSize="small" color="warning" />
                          </Tooltip>
                        )}
                        <Typography variant="body2">{field.label}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={field.type}
                        size="small"
                        color={getFieldTypeColor(field.type)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {field.columnName}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {field.isRequired ? (
                        <Chip label="Yes" size="small" color="error" />
                      ) : (
                        <Chip label="No" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {field.isPrimaryKey && <KeyIcon fontSize="small" color="warning" />}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        {expandedFields.has(field.name) ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0 }}>
                      <Collapse in={expandedFields.has(field.name)}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="textSecondary">
                                Nullable: {field.isNullable ? 'Yes' : 'No'}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="textSecondary">
                                Generated: {field.isGenerated ? 'Yes' : 'No'}
                              </Typography>
                            </Grid>
                            {field.maxLength && (
                              <Grid item xs={6}>
                                <Typography variant="caption" color="textSecondary">
                                  Max Length: {field.maxLength}
                                </Typography>
                              </Grid>
                            )}
                            {field.enumValues && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="textSecondary">
                                  Enum Values: {field.enumValues.join(', ')}
                                </Typography>
                              </Grid>
                            )}
                            {field.defaultValue !== null && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="textSecondary">
                                  Default: {String(field.defaultValue)}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {auditFields.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              <AuditIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              Audit Fields ({auditFields.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Column</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditFields.map((field) => (
                    <TableRow key={field.name}>
                      <TableCell>{field.label}</TableCell>
                      <TableCell>
                        <Chip
                          label={field.type}
                          size="small"
                          color={getFieldTypeColor(field.type)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="textSecondary">
                          {field.columnName}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>
    );
  };

  const renderRelationships = () => {
    if (!selectedTable) return null;

    const relationships = selectedTable.relationships;

    if (relationships.length === 0) {
      return (
        <Alert severity="info">
          This table has no relationships defined.
        </Alert>
      );
    }

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Outgoing Relationships ({relationships.length})
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Target Table</TableCell>
                <TableCell>Target Field</TableCell>
                <TableCell align="center">Nullable</TableCell>
                <TableCell align="center">Cascade</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relationships.map((rel, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography variant="body2">{rel.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getRelationshipTypeLabel(rel.type)}
                      size="small"
                      color={getRelationshipTypeColor(rel.type)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rel.targetTable}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const target = tables.find((t) => t.name === rel.targetTable);
                        if (target) handleTableSelect(target);
                      }}
                      sx={{ cursor: 'pointer' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="textSecondary">
                      {rel.targetField}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {rel.isNullable ? (
                      <Chip label="Yes" size="small" variant="outlined" />
                    ) : (
                      <Chip label="No" size="small" color="error" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {rel.isCascade && <Chip label="Yes" size="small" color="warning" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderVisualGraph = () => {
    if (!graph) return null;

    const tableNodes = graph.nodes.filter((n) =>
      selectedTable ? n.id === selectedTable.name || 
        graph.edges.some(
          (e) =>
            (e.source === selectedTable.name && e.target === n.id) ||
            (e.target === selectedTable.name && e.source === n.id)
        )
      : true
    );

    const relevantEdges = selectedTable
      ? graph.edges.filter(
          (e) => e.source === selectedTable.name || e.target === selectedTable.name
        )
      : graph.edges.slice(0, 20);

    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Visual representation of the data model. 
            {selectedTable
              ? ` Showing relationships for "${selectedTable.label}".`
              : ' Select a table to focus on its relationships.'}
          </Typography>
        </Alert>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Related Tables ({tableNodes.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {tableNodes.map((node) => (
              <Chip
                key={node.id}
                label={node.label}
                color={node.id === selectedTable?.name ? 'primary' : 'default'}
                variant={node.id === selectedTable?.name ? 'filled' : 'outlined'}
                onClick={() => {
                  const target = tables.find((t) => t.name === node.id);
                  if (target) handleTableSelect(target);
                }}
                icon={node.isTenantScoped ? <TenantIcon /> : undefined}
              />
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Relationships ({relevantEdges.length})
          </Typography>
          <List dense>
            {relevantEdges.map((edge) => (
              <ListItem key={edge.id}>
                <ListItemIcon>
                  <LinkIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={edge.source}
                        size="small"
                        variant="outlined"
                        color={edge.source === selectedTable?.name ? 'primary' : 'default'}
                      />
                      <ArrowIcon fontSize="small" />
                      <Chip
                        label={getRelationshipTypeLabel(edge.type)}
                        size="small"
                        color={getRelationshipTypeColor(edge.type)}
                      />
                      <ArrowIcon fontSize="small" />
                      <Chip
                        label={edge.target}
                        size="small"
                        variant="outlined"
                        color={edge.target === selectedTable?.name ? 'primary' : 'default'}
                      />
                    </Box>
                  }
                  secondary={`via ${edge.sourceField}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>
    );
  };

  const renderDotWalking = () => {
    if (!selectedTable) {
      return (
        <Alert severity="info">
          Select a table to see dot-walking paths.
        </Alert>
      );
    }

    if (dotWalkPaths.length === 0) {
      return (
        <Alert severity="info">
          No dot-walking paths available from "{selectedTable.label}".
          This table may not have reference relationships.
        </Alert>
      );
    }

    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Dot-walking paths from "{selectedTable.label}". These paths can be used
            in reporting and workflow configurations to traverse related data.
          </Typography>
        </Alert>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Path</TableCell>
                <TableCell>Reachable Tables</TableCell>
                <TableCell>Depth</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dotWalkPaths.map((path, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                    >
                      {path.path}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {path.reachableTables.map((table, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <ArrowIcon fontSize="small" sx={{ mx: 0.5 }} />}
                          <Chip
                            label={table}
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const target = tables.find((t) => t.name === table);
                              if (target) handleTableSelect(target);
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={path.segments.length}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  if (loading && tables.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Data Model Explorer
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Explore the platform's data model, relationships, and dictionary metadata.
          </Typography>
        </Box>
        <Tooltip title="Refresh data model cache">
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {renderSummaryCards()}

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          {renderTableList()}
        </Grid>

        <Grid item xs={12} md={9}>
          {selectedTable ? (
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TableIcon color="primary" />
                <Box>
                  <Typography variant="h6">{selectedTable.label}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {selectedTable.tableName}
                  </Typography>
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  {selectedTable.isTenantScoped && (
                    <Chip
                      icon={<TenantIcon />}
                      label="Tenant-scoped"
                      size="small"
                      color="primary"
                    />
                  )}
                  {selectedTable.hasSoftDelete && (
                    <Chip
                      icon={<SoftDeleteIcon />}
                      label="Soft delete"
                      size="small"
                    />
                  )}
                  {selectedTable.hasAuditFields && (
                    <Chip
                      icon={<AuditIcon />}
                      label="Audit fields"
                      size="small"
                    />
                  )}
                </Box>
              </Box>

              {selectedTable.description && (
                <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
                  {selectedTable.description}
                </Alert>
              )}

              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Fields" icon={<TableIcon />} iconPosition="start" />
                <Tab
                  label="Relationships"
                  icon={
                    <Badge badgeContent={selectedTable.relationships.length} color="secondary">
                      <LinkIcon />
                    </Badge>
                  }
                  iconPosition="start"
                />
                <Tab label="Visual Graph" icon={<TreeIcon />} iconPosition="start" />
                <Tab label="Dot-Walking" icon={<ArrowIcon />} iconPosition="start" />
              </Tabs>

              <TabPanel value={activeTab} index={0}>
                {renderFieldsTable()}
              </TabPanel>
              <TabPanel value={activeTab} index={1}>
                {renderRelationships()}
              </TabPanel>
              <TabPanel value={activeTab} index={2}>
                {renderVisualGraph()}
              </TabPanel>
              <TabPanel value={activeTab} index={3}>
                {renderDotWalking()}
              </TabPanel>
            </Paper>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <TableIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                Select a table to view its details
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
