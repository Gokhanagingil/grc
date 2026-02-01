import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { format, parseISO } from 'date-fns';
import { CalendarEventData, CalendarEventSourceType } from '../../services/grcClient';

interface EventDetailDrawerProps {
  event: CalendarEventData | null;
  open: boolean;
  onClose: () => void;
}

const SOURCE_TYPE_COLORS: Record<CalendarEventSourceType, string> = {
  BCM_EXERCISE: '#0288d1',
  CAPA: '#d32f2f',
  CAPA_TASK: '#ed6c02',
  AUDIT: '#1976d2',
  POLICY_REVIEW: '#9c27b0',
  EVIDENCE_REVIEW: '#2e7d32',
};

const SOURCE_TYPE_LABELS: Record<CalendarEventSourceType, string> = {
  BCM_EXERCISE: 'BCM Exercise',
  CAPA: 'CAPA',
  CAPA_TASK: 'CAPA Task',
  AUDIT: 'Audit',
  POLICY_REVIEW: 'Policy Review',
  EVIDENCE_REVIEW: 'Evidence Review',
};

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  event,
  open,
  onClose,
}) => {
  if (!event) return null;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'PPpp');
    } catch {
      return dateStr;
    }
  };

  const handleViewDetails = () => {
    if (event.url) {
      window.location.href = event.url;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } },
      }}
      data-testid="event-detail-drawer"
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, pr: 1 }}>
            <Chip
              label={SOURCE_TYPE_LABELS[event.sourceType]}
              size="small"
              sx={{
                bgcolor: SOURCE_TYPE_COLORS[event.sourceType],
                color: 'white',
                mb: 1,
              }}
            />
            <Typography variant="h6" component="h2">
              {event.title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" data-testid="close-drawer-button">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ my: 2 }} />

        <List disablePadding>
          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemText
              primary="Start Date"
              secondary={formatDate(event.startAt)}
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
              secondaryTypographyProps={{ variant: 'body1' }}
            />
          </ListItem>

          {event.endAt && (
            <ListItem disablePadding sx={{ py: 1 }}>
              <ListItemText
                primary="End Date"
                secondary={formatDate(event.endAt)}
                primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                secondaryTypographyProps={{ variant: 'body1' }}
              />
            </ListItem>
          )}

          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemText
              primary="Status"
              secondary={
                <Chip
                  label={event.status}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              }
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
            />
          </ListItem>

          {event.priority && (
            <ListItem disablePadding sx={{ py: 1 }}>
              <ListItemText
                primary="Priority"
                secondary={event.priority}
                primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                secondaryTypographyProps={{ variant: 'body1' }}
              />
            </ListItem>
          )}

          {event.severity && (
            <ListItem disablePadding sx={{ py: 1 }}>
              <ListItemText
                primary="Severity"
                secondary={event.severity}
                primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                secondaryTypographyProps={{ variant: 'body1' }}
              />
            </ListItem>
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        <Button
          variant="contained"
          fullWidth
          endIcon={<OpenInNewIcon />}
          onClick={handleViewDetails}
          disabled={!event.url}
          data-testid="view-details-button"
        >
          View Full Details
        </Button>
      </Box>
    </Drawer>
  );
};

export default EventDetailDrawer;
