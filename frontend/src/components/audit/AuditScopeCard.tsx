import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Business as BusinessIcon,
  Flag as ObjectiveIcon,
} from '@mui/icons-material';

interface AuditScopeCardProps {
  audit: {
    name: string;
    description?: string | null;
    objectives?: string | null;
    plannedStartDate?: string | null;
    plannedEndDate?: string | null;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    department?: string | null;
  };
  frameworks: string[];
}

export const AuditScopeCard: React.FC<AuditScopeCardProps> = ({
  audit,
  frameworks,
}) => {
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString();
  };

  const getAuditPeriod = (): string => {
    const startDate = audit.actualStartDate || audit.plannedStartDate;
    const endDate = audit.actualEndDate || audit.plannedEndDate;
    
    if (!startDate && !endDate) return 'Not defined';
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    if (startDate) return `From ${formatDate(startDate)}`;
    return `Until ${formatDate(endDate)}`;
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ObjectiveIcon color="primary" />
          Audit Scope
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Frameworks in Scope
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {frameworks.length > 0 ? (
                  frameworks.map((framework) => (
                    <Chip
                      key={framework}
                      label={framework}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No frameworks linked. Add requirements to define the audit scope.
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <CalendarIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Audit Period
                </Typography>
                <Typography variant="body2">
                  {getAuditPeriod()}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <BusinessIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Audited Organizational Units
                </Typography>
                <Typography variant="body2">
                  {audit.department || 'All departments (scope to be defined)'}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {(audit.objectives || audit.description) && (
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Audit Objective
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {audit.objectives || audit.description || 'No objective defined'}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default AuditScopeCard;
