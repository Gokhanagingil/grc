import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { api } from '../../services/api';

interface Requirement {
  id: string;
  framework: string;
  referenceCode: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string;
}

interface Finding {
  id: string;
  title: string;
  status: string;
  severity: string;
  owner?: { firstName?: string; lastName?: string } | null;
  createdAt: string;
}

interface RequirementDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  requirement: Requirement | null;
  onOpenFinding?: (findingId: string) => void;
  onAddFinding?: (requirementId: string) => void;
}

const unwrapResponse = <T,>(response: { data: { success?: boolean; data?: T } | T }): T | null => {
  try {
    const data = response.data;
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return (data as { success: boolean; data: T }).data;
    }
    return data as T;
  } catch {
    return null;
  }
};

export const RequirementDetailDrawer: React.FC<RequirementDetailDrawerProps> = ({
  open,
  onClose,
  requirement,
  onOpenFinding,
  onAddFinding,
}) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFindings = useCallback(async () => {
    if (!requirement) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/grc/requirements/${requirement.id}/issues`);
      const data = unwrapResponse<Finding[]>(response);
      setFindings(data || []);
    } catch {
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [requirement]);

  useEffect(() => {
    if (open && requirement) {
      fetchFindings();
    }
  }, [open, requirement, fetchFindings]);

  const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' => {
    switch (status) {
      case 'open': return 'warning';
      case 'in_progress': return 'primary';
      case 'resolved':
      case 'closed': return 'success';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string | null | undefined): 'error' | 'warning' | 'info' | 'default' => {
    switch (priority) {
      case 'critical':
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  if (!requirement) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 500 } },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Chip
              label={requirement.framework}
              color="primary"
              size="small"
              sx={{ mb: 1 }}
            />
            <Typography variant="h6">
              {requirement.referenceCode}
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              {requirement.title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Description
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {requirement.description || 'No description available'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {requirement.category && (
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">
                Category
              </Typography>
              <Chip label={requirement.category} size="small" variant="outlined" />
            </Box>
          )}
          {requirement.priority && (
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">
                Priority
              </Typography>
              <Chip
                label={requirement.priority}
                size="small"
                color={getPriorityColor(requirement.priority)}
              />
            </Box>
          )}
          {requirement.status && (
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">
                Status
              </Typography>
              <Chip label={requirement.status.replace(/_/g, ' ')} size="small" variant="outlined" />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2">
            Related Findings ({findings.length})
          </Typography>
          {onAddFinding && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddFinding(requirement.id)}
            >
              Add Finding
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : findings.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              No findings linked to this requirement
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {findings.map((finding) => (
                  <TableRow key={finding.id} hover>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                        {finding.title}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {finding.owner?.firstName && finding.owner?.lastName
                          ? `${finding.owner.firstName} ${finding.owner.lastName}`
                          : 'Unassigned'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={finding.status.replace(/_/g, ' ')}
                        size="small"
                        color={getStatusColor(finding.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={finding.severity}
                        size="small"
                        color={getSeverityColor(finding.severity)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => onOpenFinding?.(finding.id)}
                        title="Open Finding"
                      >
                        <OpenIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Drawer>
  );
};

export default RequirementDetailDrawer;
