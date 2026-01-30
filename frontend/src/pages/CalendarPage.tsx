import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Button,
  Stack,
  SelectChangeEvent,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { calendarApi, CalendarEventData, CalendarEventSourceType } from '../services/grcClient';

const SOURCE_TYPE_LABELS: Record<CalendarEventSourceType, string> = {
  BCM_EXERCISE: 'BCM Exercise',
  CAPA: 'CAPA',
  CAPA_TASK: 'CAPA Task',
  AUDIT: 'Audit',
  POLICY_REVIEW: 'Policy Review',
};

const SOURCE_TYPE_COLORS: Record<CalendarEventSourceType, 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
  BCM_EXERCISE: 'info',
  CAPA: 'error',
  CAPA_TASK: 'warning',
  AUDIT: 'primary',
  POLICY_REVIEW: 'secondary',
};

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
  PLANNED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  PASS: 'success',
  PARTIAL: 'warning',
  FAIL: 'error',
  open: 'info',
  in_progress: 'warning',
  closed: 'success',
  pending: 'info',
  done: 'success',
};

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedTypes, setSelectedTypes] = useState<CalendarEventSourceType[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  const fetchEvents = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const response = await calendarApi.getEvents({
        start: start.toISOString(),
        end: end.toISOString(),
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
        status: statusFilter || undefined,
      });
      
      setEvents(response.data || []);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setError('Failed to load calendar events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentMonth, selectedTypes, statusFilter]);
  
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);
  
  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };
  
  const handleToday = () => {
    setCurrentMonth(new Date());
  };
  
  const handleTypeChange = (event: SelectChangeEvent<CalendarEventSourceType[]>) => {
    const value = event.target.value;
    setSelectedTypes(typeof value === 'string' ? value.split(',') as CalendarEventSourceType[] : value);
  };
  
  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    setStatusFilter(event.target.value);
  };
  
  const handleEventClick = (event: CalendarEventData) => {
    if (event.url) {
      navigate(event.url);
    }
  };
  
  const groupEventsByDate = (events: CalendarEventData[]) => {
    const grouped: Record<string, CalendarEventData[]> = {};
    
    events.forEach(event => {
      const dateKey = format(parseISO(event.startAt), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date,
        dateLabel: format(parseISO(date), 'EEEE, MMMM d, yyyy'),
        events,
      }));
  };
  
  const groupedEvents = groupEventsByDate(events);
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }} data-testid="calendar-page">
        <Typography variant="h4" gutterBottom>
          GRC Calendar
        </Typography>
        
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" data-testid="calendar-filters">
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={handlePreviousMonth} data-testid="calendar-prev-month">
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="h6" sx={{ minWidth: 180, textAlign: 'center' }}>
                {format(currentMonth, 'MMMM yyyy')}
              </Typography>
              <IconButton onClick={handleNextMonth} data-testid="calendar-next-month">
                <ChevronRightIcon />
              </IconButton>
              <IconButton onClick={handleToday} title="Go to today" data-testid="calendar-today">
                <TodayIcon />
              </IconButton>
            </Stack>
            
            <FormControl sx={{ minWidth: 200 }} size="small">
              <InputLabel id="type-filter-label">Event Types</InputLabel>
              <Select
                labelId="type-filter-label"
                multiple
                value={selectedTypes}
                onChange={handleTypeChange}
                label="Event Types"
                data-testid="calendar-type-filter"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={SOURCE_TYPE_LABELS[value]} size="small" />
                    ))}
                  </Box>
                )}
              >
                {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl sx={{ minWidth: 150 }} size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                onChange={handleStatusChange}
                label="Status"
                data-testid="calendar-status-filter"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="PLANNED">Planned</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
            
            <IconButton onClick={fetchEvents} title="Refresh" data-testid="calendar-refresh">
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Paper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : events.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No events found for {format(currentMonth, 'MMMM yyyy')}.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try adjusting your filters or selecting a different month.
            </Typography>
          </Paper>
        ) : (
          <Box>
            {groupedEvents.map(({ date, dateLabel, events }) => (
              <Paper key={date} sx={{ mb: 2 }}>
                <Box sx={{ bgcolor: 'grey.100', px: 2, py: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {dateLabel}
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="15%">Time</TableCell>
                        <TableCell width="15%">Type</TableCell>
                        <TableCell width="40%">Title</TableCell>
                        <TableCell width="15%">Status</TableCell>
                        <TableCell width="15%">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow
                          key={event.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleEventClick(event)}
                          data-testid="calendar-event-row"
                        >
                          <TableCell>
                            {format(parseISO(event.startAt), 'h:mm a')}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={SOURCE_TYPE_LABELS[event.sourceType] || event.sourceType}
                              color={SOURCE_TYPE_COLORS[event.sourceType] || 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{event.title}</TableCell>
                          <TableCell>
                            <Chip
                              label={event.status}
                              color={STATUS_COLORS[event.status] || 'default'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                              data-testid={`view-event-${event.id}`}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default CalendarPage;
