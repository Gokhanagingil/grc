import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Security as ControlIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { controlApi, unwrapResponse } from '../services/grcClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable, TableToolbar, FilterOption } from '../components/common';
import { GrcFrameworkWarningBanner } from '../components/onboarding';

// Control enums matching backend
export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

export enum ControlImplementationType {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  IT_DEPENDENT = 'it_dependent',
}

export enum ControlStatus {
  DRAFT = 'draft',
  IN_DESIGN = 'in_design',
  IMPLEMENTED = 'implemented',
  INOPERATIVE = 'inoperative',
  RETIRED = 'retired',
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

// Control interface matching NestJS backend response
interface Control {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  description: string | null;
  type: ControlType;
  implementationType: ControlImplementationType;
  status: ControlStatus;
  frequency: ControlFrequency | null;
  ownerUserId: string | null;
  owner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  effectiveDate: string | null;
  lastTestedDate: string | null;
  nextTestDate: string | null;
  lastTestResult: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

interface ControlListResponse {
  items: Control[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ControlList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ControlStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ControlType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unlinkedFilter, setUnlinkedFilter] = useState(false);
  
  // URL params for filtering by process or requirement
  const processId = searchParams.get('processId') || '';
  const requirementId = searchParams.get('requirementId') || '';

  const tenantId = user?.tenantId || '';

  const fetchControls = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params: Record<string, unknown> = {
        page: page + 1,
        pageSize: rowsPerPage,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (typeFilter) {
        params.type = typeFilter;
      }
      if (searchQuery) {
        params.q = searchQuery;
      }
      if (unlinkedFilter) {
        params.unlinked = 'true';
      }
      if (processId) {
        params.processId = processId;
      }
      if (requirementId) {
        params.requirementId = requirementId;
      }
      
      const response = await controlApi.list(tenantId, params);
      const result = unwrapResponse<ControlListResponse>(response);
      
      if (result && 'items' in result) {
        setControls(result.items);
        setTotal(result.total);
      } else {
        setControls([]);
        setTotal(0);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.response?.data?.message;
      
      if (status === 401) {
        setError('Session expired. Please login again.');
      } else if (status === 403) {
        setError('You do not have permission to view controls.');
      } else if (status === 404 || status === 502) {
        setControls([]);
        setTotal(0);
        console.warn('Control management backend not available');
      } else {
        setError(message || 'Failed to fetch controls. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, rowsPerPage, statusFilter, typeFilter, searchQuery, unlinkedFilter, processId, requirementId]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const handleViewControl = (control: Control) => {
    navigate(`/controls/${control.id}`);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusColor = (status: ControlStatus): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (status) {
      case ControlStatus.IMPLEMENTED: return 'success';
      case ControlStatus.IN_DESIGN: return 'info';
      case ControlStatus.DRAFT: return 'default';
      case ControlStatus.INOPERATIVE: return 'warning';
      case ControlStatus.RETIRED: return 'error';
      default: return 'default';
    }
  };

  const getTypeColor = (type: ControlType): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (type) {
      case ControlType.PREVENTIVE: return 'info';
      case ControlType.DETECTIVE: return 'warning';
      case ControlType.CORRECTIVE: return 'success';
      default: return 'default';
    }
  };

  const formatStatus = (status: ControlStatus): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatType = (type: ControlType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatFrequency = (frequency: ControlFrequency | null): string => {
    if (!frequency) return '-';
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const clearUrlFilters = () => {
    setSearchParams({});
  };

  const getActiveFilters = (): FilterOption[] => {
    const filters: FilterOption[] = [];
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: formatStatus(statusFilter) });
    }
    if (typeFilter) {
      filters.push({ key: 'type', label: 'Type', value: formatType(typeFilter) });
    }
    if (unlinkedFilter) {
      filters.push({ key: 'unlinked', label: 'Unlinked', value: 'Yes' });
    }
    if (processId) {
      filters.push({ key: 'processId', label: 'Process', value: processId.substring(0, 8) + '...' });
    }
    if (requirementId) {
      filters.push({ key: 'requirementId', label: 'Requirement', value: requirementId.substring(0, 8) + '...' });
    }
    return filters;
  };

  const handleFilterRemove = (key: string) => {
    if (key === 'status') setStatusFilter('');
    if (key === 'type') setTypeFilter('');
    if (key === 'unlinked') setUnlinkedFilter(false);
    if (key === 'processId' || key === 'requirementId') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete(key);
      setSearchParams(newParams);
    }
    setPage(0);
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setSearchQuery('');
    setUnlinkedFilter(false);
    clearUrlFilters();
    setPage(0);
  };

  if (loading && controls.length === 0) {
    return <LoadingState message="Loading controls..." />;
  }

  if (error && controls.length === 0) {
    return (
      <ErrorState
        title="Failed to load controls"
        message={error}
        onRetry={fetchControls}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ControlIcon /> Control Library
        </Typography>
      </Box>

      <GrcFrameworkWarningBanner />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <TableToolbar
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(0);
        }}
        searchPlaceholder="Search controls..."
        filters={getActiveFilters()}
        onFilterRemove={handleFilterRemove}
        onClearFilters={handleClearFilters}
        onRefresh={fetchControls}
        loading={loading}
        actions={
          <Box display="flex" gap={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value as ControlStatus | '');
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(ControlStatus).map((status) => (
                  <MenuItem key={status} value={status}>{formatStatus(status)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => {
                  setTypeFilter(e.target.value as ControlType | '');
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(ControlType).map((type) => (
                  <MenuItem key={type} value={type}>{formatType(type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Linked</InputLabel>
              <Select
                value={unlinkedFilter ? 'unlinked' : 'all'}
                label="Linked"
                onChange={(e) => {
                  setUnlinkedFilter(e.target.value === 'unlinked');
                  setPage(0);
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="unlinked">Unlinked Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        }
      />

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={900}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Last Tested</TableCell>
                  <TableCell>Next Test</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {controls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<ControlIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No controls found"
                        message={
                          getActiveFilters().length > 0 || searchQuery
                            ? "Try adjusting your filters or search query"
                            : "Controls will appear here once created"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  controls.map((control) => (
                    <TableRow key={control.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {control.code || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={control.description || ''}>
                          <Typography variant="body2" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {control.name}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatType(control.type)}
                          size="small"
                          color={getTypeColor(control.type)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(control.status)}
                          size="small"
                          color={getStatusColor(control.status)}
                        />
                      </TableCell>
                      <TableCell>{formatFrequency(control.frequency)}</TableCell>
                      <TableCell>{formatDate(control.lastTestedDate)}</TableCell>
                      <TableCell>{formatDate(control.nextTestDate)}</TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewControl(control)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default ControlList;
