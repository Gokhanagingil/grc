import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  IconButton,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Gavel as ClauseIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { standardsLibraryApi, unwrapResponse } from '../services/grcClient';
import { LoadingState, ErrorState } from '../components/common';

interface StandardClause {
  id: string;
  code: string;
  title: string;
  description: string | null;
  descriptionLong: string | null;
  level: number;
  sortOrder: number;
  path: string | null;
  isAuditable: boolean;
  metadata: Record<string, unknown> | null;
  standardId: string;
  parentClauseId: string | null;
  standard?: {
    id: string;
    code: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export const ClauseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [clause, setClause] = useState<StandardClause | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClause = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await standardsLibraryApi.getClause(id);
      const data = unwrapResponse<StandardClause>(response);
      setClause(data);
    } catch (err) {
      console.error('Error fetching clause:', err);
      setError('Failed to load clause details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClause();
  }, [fetchClause]);

  const handleBack = () => {
    if (clause?.standardId) {
      navigate(`/standards/${clause.standardId}`);
    } else {
      navigate('/standards');
    }
  };

  if (loading) {
    return <LoadingState message="Loading clause details..." />;
  }

  if (error && !clause) {
    return <ErrorState message={error} onRetry={fetchClause} />;
  }

  if (!clause) {
    return <ErrorState message="Clause not found" />;
  }

  return (
    <Box sx={{ p: 3 }} data-testid="clause-detail-page">
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/standards" underline="hover" color="inherit">
          Standards Library
        </Link>
        {clause.standard && (
          <Link 
            component={RouterLink} 
            to={`/standards/${clause.standardId}`} 
            underline="hover" 
            color="inherit"
          >
            {clause.standard.code}
          </Link>
        )}
        <Typography color="text.primary">{clause.code}</Typography>
      </Breadcrumbs>

      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={handleBack} data-testid="back-button">
          <BackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ClauseIcon /> {clause.code}
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {clause.title}
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          {clause.isAuditable && (
            <Chip label="Auditable" color="primary" size="medium" />
          )}
          <Chip label={`Level ${clause.level}`} variant="outlined" size="medium" />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Description</Typography>
              <Typography variant="body1" paragraph>
                {clause.description || 'No description provided.'}
              </Typography>

              {clause.descriptionLong && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>Detailed Description</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {clause.descriptionLong}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Details</Typography>
              <Divider sx={{ mb: 2 }} />

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Code</Typography>
                <Typography>{clause.code}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Standard</Typography>
                {clause.standard ? (
                  <Link 
                    component={RouterLink} 
                    to={`/standards/${clause.standardId}`}
                    underline="hover"
                  >
                    {clause.standard.name} ({clause.standard.code})
                  </Link>
                ) : (
                  <Typography>-</Typography>
                )}
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Level</Typography>
                <Typography>{clause.level}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Path</Typography>
                <Typography>{clause.path || '-'}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Auditable</Typography>
                <Chip 
                  label={clause.isAuditable ? 'Yes' : 'No'} 
                  size="small" 
                  color={clause.isAuditable ? 'success' : 'default'}
                />
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Sort Order</Typography>
                <Typography>{clause.sortOrder}</Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" color="textSecondary">Created</Typography>
                <Typography>{formatDate(clause.createdAt)}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="textSecondary">Last Updated</Typography>
                <Typography>{formatDate(clause.updatedAt)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ClauseDetail;
