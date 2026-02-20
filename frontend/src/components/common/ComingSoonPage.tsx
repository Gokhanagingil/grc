import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Chip } from '@mui/material';
import {
  Construction as ConstructionIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

export interface ComingSoonPageProps {
  title: string;
  description?: string;
  moduleName?: string;
  expectedRelease?: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
  title,
  description,
  moduleName,
  expectedRelease,
}) => {
  const navigate = useNavigate();

  const handleReturnToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 500,
        }}
      >
        <ConstructionIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
        <Chip
          label="Coming Soon"
          color="warning"
          size="small"
          sx={{ mb: 2 }}
        />
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
        {moduleName && (
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            Part of {moduleName}
          </Typography>
        )}
        <Typography variant="body1" color="text.secondary" paragraph>
          {description || 'This feature is currently under development and will be available soon.'}
        </Typography>
        {expectedRelease && (
          <Typography variant="body2" color="text.secondary" paragraph>
            Expected release: {expectedRelease}
          </Typography>
        )}
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={handleReturnToDashboard}
          >
            Return to Dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ComingSoonPage;
