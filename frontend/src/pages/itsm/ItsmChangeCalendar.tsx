import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tab,
  Tabs,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  AcUnit as FreezeIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import {
  itsmApi,
  ItsmCalendarEventData,
  ItsmFreezeWindowData,
  CreateItsmFreezeWindowDto,
} from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

const EVENT_TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  CHANGE: 'primary',
  MAINTENANCE: 'warning',
  FREEZE: 'error',
};

const EVENT_STATUS_COLORS: Record<string, 'default' | 'primary' | 'info' | 'warning' | 'success' | 'error'> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

const FREEZE_SCOPE_COLORS: Record<string, 'default' | 'primary' | 'error' | 'warning'> = {
  GLOBAL: 'error',
  SERVICE: 'warning',
  CLASS: 'primary',
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const ItsmChangeCalendar: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [tabValue, setTabValue] = useState(0);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<ItsmCalendarEventData[]>([]);
  const [freezeWindows, setFreezeWindows] = useState<ItsmFreezeWindowData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingFreezes, setLoadingFreezes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeForm, setFreezeForm] = useState<Partial<CreateItsmFreezeWindowDto>>({
    name: '',
    description: '',
    startAt: '',
    endAt: '',
    scope: 'GLOBAL',
  });
  const [savingFreeze, setSavingFreeze] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    setError(null);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const response = await itsmApi.calendar.events.list({
        startFrom: start.toISOString(),
        startTo: end.toISOString(),
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        pageSize: 200,
      });
      const data = response.data as { data?: ItsmCalendarEventData[]; items?: ItsmCalendarEventData[] };
      if (data?.data) {
        setEvents(Array.isArray(data.data) ? data.data : []);
      } else if (data?.items) {
        setEvents(Array.isArray(data.items) ? data.items : []);
      } else if (Array.isArray(data)) {
        setEvents(data);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setError('Failed to load calendar events.');
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [currentMonth, typeFilter, statusFilter]);

  const fetchFreezeWindows = useCallback(async () => {
    setLoadingFreezes(true);
    try {
      const response = await itsmApi.calendar.freezeWindows.list({ pageSize: 100 });
      const data = response.data as { data?: ItsmFreezeWindowData[]; items?: ItsmFreezeWindowData[] };
      if (data?.data) {
        setFreezeWindows(Array.isArray(data.data) ? data.data : []);
      } else if (data?.items) {
        setFreezeWindows(Array.isArray(data.items) ? data.items : []);
      } else if (Array.isArray(data)) {
        setFreezeWindows(data);
      } else {
        setFreezeWindows([]);
      }
    } catch (err) {
      console.error('Failed to fetch freeze windows:', err);
      setFreezeWindows([]);
    } finally {
      setLoadingFreezes(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchFreezeWindows();
  }, [fetchFreezeWindows]);

  const handlePreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleTypeChange = (event: SelectChangeEvent<string>) => setTypeFilter(event.target.value);
  const handleStatusChange = (event: SelectChangeEvent<string>) => setStatusFilter(event.target.value);

  const handleSaveFreeze = async () => {
    if (!freezeForm.name || !freezeForm.startAt || !freezeForm.endAt) {
      showNotification('Name, start, and end are required', 'error');
      return;
    }
    setSavingFreeze(true);
    try {
      await itsmApi.calendar.freezeWindows.create({
        name: freezeForm.name,
        description: freezeForm.description,
        startAt: new Date(freezeForm.startAt).toISOString(),
        endAt: new Date(freezeForm.endAt).toISOString(),
        scope: freezeForm.scope || 'GLOBAL',
        isActive: true,
      });
      showNotification('Freeze window created', 'success');
      setFreezeDialogOpen(false);
      setFreezeForm({ name: '', description: '', startAt: '', endAt: '', scope: 'GLOBAL' });
      fetchFreezeWindows();
    } catch (err) {
      console.error('Failed to create freeze window:', err);
      showNotification('Failed to create freeze window', 'error');
    } finally {
      setSavingFreeze(false);
    }
  };

  const handleDeleteFreeze = async (id: string) => {
    try {
      await itsmApi.calendar.freezeWindows.delete(id);
      showNotification('Freeze window deleted', 'success');
      fetchFreezeWindows();
    } catch (err) {
      console.error('Failed to delete freeze window:', err);
      showNotification('Failed to delete freeze window', 'error');
    }
  };

  const groupEventsByDate = (evts: ItsmCalendarEventData[]) => {
    const grouped: Record<string, ItsmCalendarEventData[]> = {};
    evts.forEach(event => {
      const dateKey = format(parseISO(event.startAt), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        dateLabel: format(parseISO(date), 'EEEE, MMMM d, yyyy'),
        items,
      }));
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const eventsForDay = useCallback(
    (day: Date) =>
      events.filter(ev => {
        const evStart = parseISO(ev.startAt);
        const evEnd = parseISO(ev.endAt);
        return isSameDay(day, evStart) || isSameDay(day, evEnd) ||
          isWithinInterval(day, { start: evStart, end: evEnd });
      }),
    [events],
  );

  const activeFreezeForDay = useCallback(
    (day: Date) =>
      freezeWindows.filter(fw => {
        if (!fw.isActive) return false;
        const fwStart = parseISO(fw.startAt);
        const fwEnd = parseISO(fw.endAt);
        return isSameDay(day, fwStart) || isSameDay(day, fwEnd) ||
          isWithinInterval(day, { start: fwStart, end: fwEnd });
      }),
    [freezeWindows],
  );

  const groupedEvents = groupEventsByDate(events);

  return (
    <Box data-testid="itsm-change-calendar">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Change Calendar
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FreezeIcon />}
            onClick={() => setFreezeDialogOpen(true)}
          >
            New Freeze Window
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={handlePreviousMonth}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6" sx={{ minWidth: 180, textAlign: 'center' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </Typography>
            <IconButton onClick={handleNextMonth}>
              <ChevronRightIcon />
            </IconButton>
            <IconButton onClick={handleToday} title="Go to today">
              <TodayIcon />
            </IconButton>
          </Stack>

          <FormControl sx={{ minWidth: 140 }} size="small">
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} onChange={handleTypeChange} label="Type">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="CHANGE">Change</MenuItem>
              <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
              <MenuItem value="FREEZE">Freeze</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 140 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={handleStatusChange} label="Status">
              <MenuItem value="">All</MenuItem>
              <MenuItem value="SCHEDULED">Scheduled</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <IconButton onClick={() => { fetchEvents(); fetchFreezeWindows(); }} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Calendar Grid" />
          <Tab label="List View" />
          <Tab label={`Freeze Windows (${freezeWindows.length})`} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {loadingEvents ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <Box key={d} sx={{ textAlign: 'center', py: 1, fontWeight: 600, color: 'text.secondary' }}>
                    <Typography variant="caption">{d}</Typography>
                  </Box>
                ))}
                {calendarDays.map(day => {
                  const dayEvents = eventsForDay(day);
                  const dayFreezes = activeFreezeForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        minHeight: 90,
                        border: '1px solid',
                        borderColor: isToday ? 'primary.main' : 'divider',
                        bgcolor: dayFreezes.length > 0
                          ? 'error.50'
                          : isCurrentMonth ? 'background.paper' : 'grey.50',
                        opacity: isCurrentMonth ? 1 : 0.5,
                        p: 0.5,
                        borderRadius: 0.5,
                        position: 'relative',
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={isToday ? 700 : 400}
                        color={isToday ? 'primary.main' : 'text.secondary'}
                      >
                        {format(day, 'd')}
                      </Typography>
                      {dayFreezes.length > 0 && (
                        <Tooltip title={dayFreezes.map(f => f.name).join(', ')}>
                          <FreezeIcon sx={{ fontSize: 12, color: 'error.main', position: 'absolute', top: 4, right: 4 }} />
                        </Tooltip>
                      )}
                      <Box sx={{ mt: 0.25 }}>
                        {dayEvents.slice(0, 3).map(ev => (
                          <Chip
                            key={ev.id}
                            label={ev.title}
                            size="small"
                            color={EVENT_TYPE_COLORS[ev.type?.toUpperCase()] || 'default'}
                            variant="outlined"
                            onClick={() => {
                              if (ev.changeId) navigate(`/itsm/changes/${ev.changeId}`);
                            }}
                            sx={{ fontSize: 10, height: 20, mb: 0.25, maxWidth: '100%', cursor: ev.changeId ? 'pointer' : 'default' }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{dayEvents.length - 3} more
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {loadingEvents ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : groupedEvents.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No events found for {format(currentMonth, 'MMMM yyyy')}.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {groupedEvents.map(({ date, dateLabel, items }) => (
                <Paper key={date} variant="outlined" sx={{ mb: 2 }}>
                  <Box sx={{ bgcolor: 'grey.100', px: 2, py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>{dateLabel}</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell width="12%">Time</TableCell>
                          <TableCell width="12%">Type</TableCell>
                          <TableCell width="40%">Title</TableCell>
                          <TableCell width="12%">Status</TableCell>
                          <TableCell width="12%">End</TableCell>
                          <TableCell width="12%">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map(ev => (
                          <TableRow key={ev.id} hover>
                            <TableCell>
                              <Typography variant="body2">
                                {format(parseISO(ev.startAt), 'HH:mm')}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={ev.type}
                                size="small"
                                color={EVENT_TYPE_COLORS[ev.type?.toUpperCase()] || 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{ev.title}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={ev.status}
                                size="small"
                                color={EVENT_STATUS_COLORS[ev.status?.toUpperCase()] || 'default'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {format(parseISO(ev.endAt), 'MMM d HH:mm')}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {ev.changeId && (
                                <Button
                                  size="small"
                                  onClick={() => navigate(`/itsm/changes/${ev.changeId}`)}
                                >
                                  View Change
                                </Button>
                              )}
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
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {loadingFreezes ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : freezeWindows.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No freeze windows configured.</Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                sx={{ mt: 2 }}
                onClick={() => setFreezeDialogOpen(true)}
              >
                Create Freeze Window
              </Button>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {freezeWindows.map(fw => (
                      <TableRow key={fw.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{fw.name}</Typography>
                          {fw.description && (
                            <Typography variant="caption" color="text.secondary">{fw.description}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={fw.scope}
                            size="small"
                            color={FREEZE_SCOPE_COLORS[fw.scope?.toUpperCase()] || 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {format(parseISO(fw.startAt), 'MMM d, yyyy HH:mm')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {format(parseISO(fw.endAt), 'MMM d, yyyy HH:mm')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={fw.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            color={fw.isActive ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteFreeze(fw.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </TabPanel>
      </Paper>

      <Dialog open={freezeDialogOpen} onClose={() => setFreezeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Freeze Window</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              required
              value={freezeForm.name || ''}
              onChange={e => setFreezeForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={freezeForm.description || ''}
              onChange={e => setFreezeForm(prev => ({ ...prev, description: e.target.value }))}
            />
            <FormControl fullWidth>
              <InputLabel>Scope</InputLabel>
              <Select
                value={freezeForm.scope || 'GLOBAL'}
                label="Scope"
                onChange={e => setFreezeForm(prev => ({ ...prev, scope: e.target.value }))}
              >
                <MenuItem value="GLOBAL">Global</MenuItem>
                <MenuItem value="SERVICE">Service</MenuItem>
                <MenuItem value="CLASS">Class</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Start"
              type="datetime-local"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={freezeForm.startAt || ''}
              onChange={e => setFreezeForm(prev => ({ ...prev, startAt: e.target.value }))}
            />
            <TextField
              label="End"
              type="datetime-local"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              value={freezeForm.endAt || ''}
              onChange={e => setFreezeForm(prev => ({ ...prev, endAt: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFreezeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFreeze} disabled={savingFreeze}>
            {savingFreeze ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItsmChangeCalendar;
