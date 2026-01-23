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
  Alert,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  LibraryBooks as StandardsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { standardsLibraryApi } from '../services/grcClient';
import { ApiError } from '../services/api';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable } from '../components/common';

interface Standard {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  version: string;
  description?: string | null;
  publisher?: string | null;
  effectiveDate?: string | null;
  domain?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeStandardsResponse(data: unknown): { items: Standard[]; total: number } {
  if (!data) {
    return { items: [], total: 0 };
  }
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.success === true && 'data' in obj) {
      const innerData = obj.data;
      const items = Array.isArray(innerData) ? innerData : [];
      const meta = obj.meta as { total?: number } | undefined;
      const total = meta?.total ?? items.length;
      return { items: items as Standard[], total };
    }
    if ('items' in obj && Array.isArray(obj.items)) {
      return { items: obj.items as Standard[], total: (obj.total as number) ?? obj.items.length };
    }
    if ('data' in obj && Array.isArray(obj.data)) {
      return { items: obj.data as Standard[], total: (obj.total as number) ?? obj.data.length };
    }
  }
  return { items: [], total: 0 };
}

export const StandardsLibrary: React.FC = () => {
  const navigate = useNavigate();

  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStandards = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await standardsLibraryApi.list();
      const data = response.data;
      const normalized = normalizeStandardsResponse(data);
      setStandards(normalized.items);
      setLoading(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        const retryAfter = (err.details?.retryAfter as number) || 60;
        setError(`Too many requests. Please try again in ${retryAfter} seconds.`);
        setLoading(false);
        return;
      }

      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 404) {
        setStandards([]);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch standards');
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  const handleViewStandard = (id: string) => {
    navigate(`/standards/${id}`);
  };

  if (loading && standards.length === 0) {
    return <LoadingState message="Loading standards library..." />;
  }

  if (error && standards.length === 0) {
    return (
      <ErrorState
        title="Failed to load standards"
        message={error}
        onRetry={() => fetchStandards()}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Standards Library</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={800}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Domain</TableCell>
                  <TableCell>Publisher</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {standards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<StandardsIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No standards found"
                        message="No standards have been seeded yet. An administrator can run 'npm run seed:standards' to populate the standards library, or standards can be imported through the admin interface."
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  standards.map((standard) => (
                    <TableRow key={standard.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {standard.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {standard.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{standard.version || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {standard.domain || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {standard.publisher || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={standard.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={standard.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleViewStandard(standard.id)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StandardsLibrary;
