import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { AdminPageHeader } from '../../components/admin';
import { api } from '../../services/api';

// ── Types ────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  code: string | null;
  status: string;
  domain: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompanyFormData {
  name: string;
  type: string;
  code: string;
  status: string;
  domain: string;
  country: string;
  notes: string;
}

const COMPANY_TYPES = ['CUSTOMER', 'VENDOR', 'INTERNAL'];
const COMPANY_STATUSES = ['ACTIVE', 'INACTIVE'];

const initialFormData: CompanyFormData = {
  name: '',
  type: 'CUSTOMER',
  code: '',
  status: 'ACTIVE',
  domain: '',
  country: '',
  notes: '',
};

// ── Helpers ──────────────────────────────────────────────────────────────

function unwrapData<T>(responseData: unknown): T {
  const d = responseData as Record<string, unknown>;
  if (d && d.success === true && d.data !== undefined) {
    return d.data as T;
  }
  return responseData as T;
}

function getTypeColor(type: string): 'primary' | 'secondary' | 'info' {
  switch (type) {
    case 'CUSTOMER':
      return 'primary';
    case 'VENDOR':
      return 'secondary';
    case 'INTERNAL':
      return 'info';
    default:
      return 'primary';
  }
}

function getStatusColor(status: string): 'success' | 'default' {
  return status === 'ACTIVE' ? 'success' : 'default';
}

// ── Main Component ───────────────────────────────────────────────────────

export const AdminCompanies: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);

  // Pagination
  const [page, setPage] = useState(0); // MUI TablePagination is 0-indexed
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page + 1)); // API is 1-indexed
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);

      const res = await api.get(`/grc/admin/companies?${params.toString()}`);
      const data = unwrapData<{
        items: Company[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(res.data);
      setCompanies(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load companies';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterType, filterStatus]);

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      fetchCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialized) {
      fetchCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filterType, filterStatus]);

  // ── Search handler (debounced via Enter key) ──────────────────────────

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(0);
      fetchCompanies();
    }
  };

  // ── Modal CRUD ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingCompany(null);
    setFormData(initialFormData);
    setModalOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      type: company.type,
      code: company.code || '',
      status: company.status,
      domain: company.domain || '',
      country: company.country || '',
      notes: company.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        type: formData.type,
        status: formData.status,
      };
      if (formData.code) payload.code = formData.code;
      if (formData.domain) payload.domain = formData.domain;
      if (formData.country) payload.country = formData.country;
      if (formData.notes) payload.notes = formData.notes;

      if (editingCompany) {
        await api.patch(`/grc/admin/companies/${editingCompany.id}`, payload);
        setSuccessMsg('Company updated successfully');
      } else {
        await api.post('/grc/admin/companies', payload);
        setSuccessMsg('Company created successfully');
      }

      setModalOpen(false);
      await fetchCompanies();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save company';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company: Company) => {
    if (!window.confirm(`Are you sure you want to delete "${company.name}"?`)) return;
    try {
      await api.delete(`/grc/admin/companies/${company.id}`);
      setSuccessMsg('Company deleted');
      await fetchCompanies();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete company';
      setError(msg);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Box>
      <AdminPageHeader
        title="Companies"
        subtitle="Manage shared company dimension (customers, vendors, internal entities)"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Companies' },
        ]}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<RefreshIcon />} onClick={fetchCompanies} disabled={loading}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Company
            </Button>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            label="Type"
            onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All</MenuItem>
            {COMPANY_TYPES.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All</MenuItem>
            {COMPANY_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Domain</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No companies found. Click "Add Company" to create one.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((company) => (
                    <TableRow key={company.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {company.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {company.code || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={company.type}
                          color={getTypeColor(company.type)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={company.status}
                          color={getStatusColor(company.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {company.domain || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {company.country || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(company)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(company)}>
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
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Paper>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCompany ? 'Edit Company' : 'Add Company'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {COMPANY_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Code (optional, unique per tenant)"
              fullWidth
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              helperText="Short identifier, e.g. ACME, CUST-001"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {COMPANY_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Domain (optional)"
              fullWidth
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              helperText="e.g. acme.com"
            />
            <TextField
              label="Country (optional)"
              fullWidth
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
            <TextField
              label="Notes (optional)"
              fullWidth
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name || saving}
          >
            {saving ? 'Saving...' : editingCompany ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCompanies;
