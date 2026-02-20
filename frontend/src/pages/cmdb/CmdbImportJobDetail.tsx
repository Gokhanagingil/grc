import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  IconButton,
  Divider,
  LinearProgress,
  TablePagination,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as ApplyIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  cmdbImportApi,
  CmdbImportJobData,
  CmdbImportRowData,
  CmdbReconcileResultData,
  CmdbImportJobReport,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info' | 'primary'> = {
  PENDING: 'default',
  PARSING: 'info',
  RECONCILING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  APPLIED: 'primary',
};

const rowStatusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PARSED: 'default',
  MATCHED: 'info',
  CREATED: 'success',
  UPDATED: 'info',
  CONFLICT: 'warning',
  ERROR: 'error',
};

const actionColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  CREATE: 'success',
  UPDATE: 'info',
  SKIP: 'default',
  CONFLICT: 'warning',
};

function extractData(response: { data: unknown }): unknown {
  const d = response.data;
  if (d && typeof d === 'object' && 'data' in d) {
    return (d as Record<string, unknown>).data;
  }
  return d;
}

export const CmdbImportJobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [job, setJob] = useState<CmdbImportJobData | null>(null);
  const [report, setReport] = useState<CmdbImportJobReport | null>(null);
  const [rows, setRows] = useState<CmdbImportRowData[]>([]);
  const [results, setResults] = useState<CmdbReconcileResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [explainResult, setExplainResult] = useState<CmdbReconcileResultData | null>(null);

  const [rowPage, setRowPage] = useState(0);
  const [rowPageSize, setRowPageSize] = useState(10);
  const [rowTotal, setRowTotal] = useState(0);
  const [resultPage, setResultPage] = useState(0);
  const [resultPageSize, setResultPageSize] = useState(10);
  const [resultTotal, setResultTotal] = useState(0);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const jobRes = await cmdbImportApi.jobs.get(id);
      const jobData = extractData(jobRes) as CmdbImportJobData;
      setJob(jobData);

      try {
        const reportRes = await cmdbImportApi.jobs.report(id);
        const reportData = extractData(reportRes) as CmdbImportJobReport;
        setReport(reportData);
      } catch {
        // report may not be available for all jobs
      }
    } catch (err) {
      console.error('Error fetching job:', err);
      showNotification('Failed to load import job', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showNotification]);

  const fetchRows = useCallback(async () => {
    if (!id) return;
    try {
      const res = await cmdbImportApi.jobs.rows(id, { page: rowPage + 1, pageSize: rowPageSize });
      const data = extractData(res) as { items: CmdbImportRowData[]; total: number };
      setRows(Array.isArray(data?.items) ? data.items : []);
      setRowTotal(data?.total || 0);
    } catch {
      setRows([]);
    }
  }, [id, rowPage, rowPageSize]);

  const fetchResults = useCallback(async () => {
    if (!id) return;
    try {
      const res = await cmdbImportApi.jobs.results(id, { page: resultPage + 1, pageSize: resultPageSize });
      const data = extractData(res) as { items: CmdbReconcileResultData[]; total: number };
      setResults(Array.isArray(data?.items) ? data.items : []);
      setResultTotal(data?.total || 0);
    } catch {
      setResults([]);
    }
  }, [id, resultPage, resultPageSize]);

  useEffect(() => { fetchJob(); }, [fetchJob]);
  useEffect(() => { if (tab === 0) fetchRows(); }, [tab, fetchRows]);
  useEffect(() => { if (tab === 1) fetchResults(); }, [tab, fetchResults]);

  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      await cmdbImportApi.jobs.apply(id);
      showNotification('Import applied successfully! CIs have been created/updated.', 'success');
      setApplyOpen(false);
      fetchJob();
    } catch (err) {
      console.error('Error applying job:', err);
      showNotification('Failed to apply import job', 'error');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!job) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">Import job not found</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/cmdb/import-jobs')} sx={{ mt: 2 }}>
          Back to Import Jobs
        </Button>
      </Box>
    );
  }

  const summary = report?.summary || {
    totalRows: job.totalRows,
    wouldCreate: job.createdCount,
    wouldUpdate: job.updatedCount,
    conflicts: job.conflictCount,
    errors: job.errorCount,
    skipped: 0,
  };

  const canApply = job.dryRun && job.status === 'COMPLETED';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/cmdb/import-jobs')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={600}>
          Import Job
        </Typography>
        <Chip label={job.status} color={statusColors[job.status] || 'default'} />
        {job.dryRun && <Chip label="Dry Run" variant="outlined" color="info" />}
        <Box sx={{ flex: 1 }} />
        {canApply && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<ApplyIcon />}
            onClick={() => setApplyOpen(true)}
          >
            Apply Changes
          </Button>
        )}
      </Box>

      {job.dryRun && job.status === 'COMPLETED' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This is a dry-run. No changes have been applied yet. Review the results below and click &quot;Apply Changes&quot; to create/update CIs.
        </Alert>
      )}

      {job.status === 'APPLIED' && (
        <Alert severity="success" sx={{ mb: 3 }}>
          This import has been applied. CIs have been created and updated.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h3" fontWeight={700}>{summary.totalRows}</Typography>
            <Typography variant="body2" color="text.secondary">Total Rows</Typography>
          </CardContent>
        </Card>
        <Card sx={{ borderLeft: '4px solid #4caf50' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h3" fontWeight={700} color="success.main">{summary.wouldCreate}</Typography>
            <Typography variant="body2" color="text.secondary">Would Create</Typography>
          </CardContent>
        </Card>
        <Card sx={{ borderLeft: '4px solid #2196f3' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h3" fontWeight={700} color="info.main">{summary.wouldUpdate}</Typography>
            <Typography variant="body2" color="text.secondary">Would Update</Typography>
          </CardContent>
        </Card>
        <Card sx={{ borderLeft: '4px solid #ff9800' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h3" fontWeight={700} color="warning.main">{summary.conflicts}</Typography>
            <Typography variant="body2" color="text.secondary">Conflicts</Typography>
          </CardContent>
        </Card>
        <Card sx={{ borderLeft: '4px solid #f44336' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h3" fontWeight={700} color="error.main">{summary.errors}</Typography>
            <Typography variant="body2" color="text.secondary">Errors</Typography>
          </CardContent>
        </Card>
      </Box>

      {(job.status === 'PARSING' || job.status === 'RECONCILING') && (
        <LinearProgress sx={{ mb: 2 }} />
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Rows (${job.totalRows})`} />
          <Tab label="Reconcile Results" />
          <Tab label={`Conflicts (${summary.conflicts})`} />
        </Tabs>
      </Box>

      {tab === 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Hostname / Name</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Environment</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.rowNo}</TableCell>
                  <TableCell>
                    <Chip label={row.status} size="small" color={rowStatusColors[row.status] || 'default'} />
                  </TableCell>
                  <TableCell>{String(row.parsed?.hostname || row.parsed?.name || '-')}</TableCell>
                  <TableCell>{String(row.parsed?.ip_address || row.parsed?.ip || '-')}</TableCell>
                  <TableCell>{String(row.parsed?.environment || '-')}</TableCell>
                  <TableCell>
                    {row.errorMessage && (
                      <Typography variant="caption" color="error">{row.errorMessage}</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No rows found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={rowTotal}
            page={rowPage}
            onPageChange={(_, p) => setRowPage(p)}
            rowsPerPage={rowPageSize}
            onRowsPerPageChange={(e) => { setRowPageSize(parseInt(e.target.value, 10)); setRowPage(0); }}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </TableContainer>
      )}

      {tab === 1 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell>Matched By</TableCell>
                <TableCell>CI ID</TableCell>
                <TableCell>Diff Fields</TableCell>
                <TableCell>Explain</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Chip label={r.action} size="small" color={actionColors[r.action] || 'default'} />
                  </TableCell>
                  <TableCell>{r.matchedBy || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {r.ciId ? r.ciId.substring(0, 8) + '...' : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{r.diff ? r.diff.length + ' fields' : '-'}</TableCell>
                  <TableCell>
                    {r.explain && (
                      <IconButton size="small" onClick={() => setExplainResult(r)}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No results found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={resultTotal}
            page={resultPage}
            onPageChange={(_, p) => setResultPage(p)}
            rowsPerPage={resultPageSize}
            onRowsPerPageChange={(e) => { setResultPageSize(parseInt(e.target.value, 10)); setResultPage(0); }}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </TableContainer>
      )}

      {tab === 2 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell>Matched By</TableCell>
                <TableCell>CI</TableCell>
                <TableCell>Conflicting Fields</TableCell>
                <TableCell>Explain</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.filter(r => r.action === 'CONFLICT').map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Chip label="CONFLICT" size="small" color="warning" />
                  </TableCell>
                  <TableCell>{r.matchedBy || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {r.ciId ? r.ciId.substring(0, 8) + '...' : 'Multiple matches'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.diff?.filter(d => d.classification === 'conflict').map(d => d.field).join(', ') || '-'}
                  </TableCell>
                  <TableCell>
                    {r.explain && (
                      <IconButton size="small" onClick={() => setExplainResult(r)}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {results.filter(r => r.action === 'CONFLICT').length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No conflicts</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={applyOpen} onClose={() => setApplyOpen(false)}>
        <DialogTitle>Apply Import Changes?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will create {summary.wouldCreate} new CIs and update {summary.wouldUpdate} existing CIs.
            {summary.conflicts > 0 && ` ${summary.conflicts} conflicts will be skipped.`}
            This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleApply} disabled={applying}>
            {applying ? 'Applying...' : 'Confirm & Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={!!explainResult}
        onClose={() => setExplainResult(null)}
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        {explainResult && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Match Explanation</Typography>
              <IconButton onClick={() => setExplainResult(null)}><CloseIcon /></IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Action</Typography>
            <Chip label={explainResult.action} color={actionColors[explainResult.action] || 'default'} sx={{ mb: 2 }} />

            {explainResult.explain && (
              <>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Rule</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>{explainResult.explain.ruleName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mb: 2 }}>
                  ID: {explainResult.explain.ruleId}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Fields Used</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                  {explainResult.explain.fieldsUsed.map((f) => (
                    <Chip key={f} label={f} size="small" variant="outlined" />
                  ))}
                </Box>

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Confidence</Typography>
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={explainResult.explain.confidence * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">{(explainResult.explain.confidence * 100).toFixed(0)}%</Typography>
                </Box>

                {explainResult.explain.matchedCiName && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Matched CI</Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>{explainResult.explain.matchedCiName}</Typography>
                  </>
                )}
              </>
            )}

            {explainResult.diff && explainResult.diff.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Field Diffs</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Old</TableCell>
                        <TableCell>New</TableCell>
                        <TableCell>Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {explainResult.diff.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell><Typography variant="caption" fontWeight={500}>{d.field}</Typography></TableCell>
                          <TableCell><Typography variant="caption">{String(d.oldValue ?? '-')}</Typography></TableCell>
                          <TableCell><Typography variant="caption">{String(d.newValue ?? '-')}</Typography></TableCell>
                          <TableCell>
                            <Chip
                              label={d.classification === 'conflict' ? 'Conflict' : 'Safe'}
                              size="small"
                              color={d.classification === 'conflict' ? 'warning' : 'success'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default CmdbImportJobDetail;
