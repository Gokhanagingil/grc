import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { itsmApi, CabMeetingData, CreateCabMeetingDto, unwrapPaginatedResponse } from '../../services/grcClient';
import { classifyApiError } from '../../utils/apiErrorClassifier';
import { stripUndefined, CAB_MEETING_CREATE_FIELDS, stripForbiddenFields } from '../../utils/payloadNormalizer';

const CAB_STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  SCHEDULED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const CAB_STATUSES = ['', 'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function ItsmCabMeetingList() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<CabMeetingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMeetingAt, setNewMeetingAt] = useState('');
  const [newEndAt, setNewEndAt] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await itsmApi.cabMeetings.list({
        page: page + 1,
        pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      const { items, total: totalCount } = unwrapPaginatedResponse<CabMeetingData>(res);
      setMeetings(items);
      setTotal(totalCount);
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to load CAB meetings');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleCreate = async () => {
    if (!newTitle || !newMeetingAt) return;
    setCreating(true);
    try {
      const rawPayload: Record<string, unknown> = {
        title: newTitle,
        meetingAt: new Date(newMeetingAt).toISOString(),
        endAt: newEndAt ? new Date(newEndAt).toISOString() : undefined,
      };
      const cleanPayload = stripUndefined(stripForbiddenFields(rawPayload, CAB_MEETING_CREATE_FIELDS)) as unknown as CreateCabMeetingDto;
      await itsmApi.cabMeetings.create(cleanPayload);
      setCreateOpen(false);
      setNewTitle('');
      setNewMeetingAt('');
      setNewEndAt('');
      fetchMeetings();
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      setError(classified.message || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this CAB meeting?')) return;
    try {
      await itsmApi.cabMeetings.delete(id);
      fetchMeetings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete meeting';
      setError(msg);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">CAB Meetings</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchMeetings}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Meeting
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              >
                {CAB_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s || 'All'}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Meeting Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Chairperson</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : meetings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No CAB meetings found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                meetings.map((m) => (
                  <TableRow
                    key={m.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/itsm/change-management/cab/${m.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{m.code}</Typography>
                    </TableCell>
                    <TableCell>{m.title}</TableCell>
                    <TableCell>
                      <Chip
                        label={m.status}
                        size="small"
                        color={CAB_STATUS_COLORS[m.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell>{formatDate(m.meetingAt)}</TableCell>
                    <TableCell>{formatDate(m.endAt)}</TableCell>
                    <TableCell>
                      {m.chairperson
                        ? `${m.chairperson.firstName || ''} ${m.chairperson.lastName || ''}`.trim() || m.chairperson.email || '-'
                        : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigate(`/itsm/change-management/cab/${m.id}`); }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigate(`/itsm/change-management/cab/${m.id}`); }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create CAB Meeting</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Meeting Date & Time"
              type="datetime-local"
              value={newMeetingAt}
              onChange={(e) => setNewMeetingAt(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date & Time"
              type="datetime-local"
              value={newEndAt}
              onChange={(e) => setNewEndAt(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !newTitle || !newMeetingAt}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
