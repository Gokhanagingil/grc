import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns';
import { CalendarEventData, CalendarEventSourceType } from '../../services/grcClient';

interface CalendarGridProps {
  currentMonth: Date;
  events: CalendarEventData[];
  onEventClick: (event: CalendarEventData) => void;
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
  BCM_EXERCISE: 'BCM',
  CAPA: 'CAPA',
  CAPA_TASK: 'Task',
  AUDIT: 'Audit',
  POLICY_REVIEW: 'Policy',
  EVIDENCE_REVIEW: 'Evidence',
};

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonth,
  events,
  onEventClick,
}) => {
  const theme = useTheme();

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventData[]> = {};
    events.forEach((event) => {
      const dateKey = format(parseISO(event.startAt), 'yyyy-MM-dd');
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Paper sx={{ overflow: 'hidden' }} data-testid="calendar-grid">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'grey.100',
        }}
      >
        {weekDays.map((day) => (
          <Box
            key={day}
            sx={{
              p: 1,
              textAlign: 'center',
              fontWeight: 'medium',
              borderRight: `1px solid ${theme.palette.divider}`,
              '&:last-child': { borderRight: 'none' },
            }}
          >
            <Typography variant="body2" fontWeight="medium">
              {day}
            </Typography>
          </Box>
        ))}
      </Box>

      {weeks.map((week, weekIndex) => (
        <Box
          key={weekIndex}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            minHeight: 120,
            borderBottom: `1px solid ${theme.palette.divider}`,
            '&:last-child': { borderBottom: 'none' },
          }}
        >
          {week.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <Box
                key={dateKey}
                sx={{
                  p: 0.5,
                  borderRight: `1px solid ${theme.palette.divider}`,
                  '&:last-child': { borderRight: 'none' },
                  bgcolor: isCurrentMonth ? 'background.paper' : 'grey.50',
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                }}
                data-testid={`calendar-day-${dateKey}`}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      bgcolor: isCurrentDay ? 'primary.main' : 'transparent',
                      color: isCurrentDay
                        ? 'primary.contrastText'
                        : isCurrentMonth
                        ? 'text.primary'
                        : 'text.disabled',
                      fontWeight: isCurrentDay ? 'bold' : 'normal',
                    }}
                  >
                    {format(day, 'd')}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.25,
                  }}
                >
                  {dayEvents.slice(0, 3).map((event) => (
                    <Tooltip
                      key={event.id}
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {event.title}
                          </Typography>
                          <Typography variant="caption">
                            {format(parseISO(event.startAt), 'h:mm a')} - {event.status}
                          </Typography>
                        </Box>
                      }
                      arrow
                    >
                      <Chip
                        label={event.title}
                        size="small"
                        onClick={() => onEventClick(event)}
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: SOURCE_TYPE_COLORS[event.sourceType] || theme.palette.grey[500],
                          color: 'white',
                          cursor: 'pointer',
                          '& .MuiChip-label': {
                            px: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          },
                          '&:hover': {
                            opacity: 0.85,
                          },
                        }}
                        data-testid={`calendar-event-${event.id}`}
                      />
                    </Tooltip>
                  ))}
                  {dayEvents.length > 3 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        pl: 0.5,
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      +{dayEvents.length - 3} more
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}

      <Box sx={{ p: 1, bgcolor: 'grey.50', borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {Object.entries(SOURCE_TYPE_LABELS).map(([type, label]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '2px',
                  bgcolor: SOURCE_TYPE_COLORS[type as CalendarEventSourceType],
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

export default CalendarGrid;
