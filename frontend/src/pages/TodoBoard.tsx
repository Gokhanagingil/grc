import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  ViewList as ListIcon,
  Flag as FlagIcon,
  Schedule as ScheduleIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ListToolbar } from '../components/common/ListToolbar';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface TodoTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string | null;
  tags: string[] | null;
  dueDate: string | null;
  completedAt: string | null;
  assigneeUserId: string | null;
  sortOrder: number;
  boardId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BoardColumn {
  id: string;
  key: string;
  title: string;
  orderIndex: number;
  wipLimit: number | null;
  isDoneColumn: boolean;
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  columns: BoardColumn[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const priorityColors: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const isOverdue = (task: TodoTask): boolean => {
  if (!task.dueDate || task.status === 'done' || task.status === 'completed') return false;
  return new Date(task.dueDate) < new Date();
};

/* ------------------------------------------------------------------ */
/* TaskCard                                                            */
/* ------------------------------------------------------------------ */

const TaskCard: React.FC<{
  task: TodoTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}> = ({ task, onDragStart }) => (
  <Card
    draggable
    onDragStart={(e) => onDragStart(e, task.id)}
    sx={{
      mb: 1,
      cursor: 'grab',
      '&:hover': { boxShadow: 3 },
      borderLeft: isOverdue(task) ? '3px solid red' : 'none',
      opacity: task.status === 'done' || task.status === 'completed' ? 0.7 : 1,
    }}
  >
    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Box display="flex" alignItems="flex-start" gap={0.5}>
        <DragIcon fontSize="small" sx={{ color: 'text.disabled', mt: 0.25 }} />
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {task.title}
          </Typography>
          {task.description && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {task.description}
            </Typography>
          )}
          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            <Chip
              label={task.priority}
              size="small"
              color={priorityColors[task.priority] || 'default'}
              icon={<FlagIcon />}
              sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
            />
            {task.category && (
              <Chip
                label={task.category}
                size="small"
                variant="outlined"
                sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' } }}
              />
            )}
          </Box>
          {task.dueDate && (
            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
              <ScheduleIcon sx={{ fontSize: 14 }} color={isOverdue(task) ? 'error' : 'action'} />
              <Typography variant="caption" color={isOverdue(task) ? 'error' : 'text.secondary'}>
                {new Date(task.dueDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/* ------------------------------------------------------------------ */
/* KanbanColumn                                                        */
/* ------------------------------------------------------------------ */

const KanbanColumn: React.FC<{
  column: BoardColumn;
  tasks: TodoTask[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, columnKey: string) => void;
  onQuickAdd: (columnKey: string, title: string) => void;
}> = ({ column, tasks, onDragStart, onDrop, onQuickAdd }) => {
  const [dragOver, setDragOver] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const overWipLimit = column.wipLimit != null && tasks.length > column.wipLimit;

  const handleSubmitQuickAdd = () => {
    const title = quickAddTitle.trim();
    if (title) {
      onQuickAdd(column.key, title);
      setQuickAddTitle('');
      setShowQuickAdd(false);
    }
  };

  return (
    <Paper
      sx={{
        width: 300,
        minWidth: 300,
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: dragOver ? 'action.hover' : 'grey.50',
        borderTop: overWipLimit ? '3px solid orange' : '3px solid transparent',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(e, column.key); }}
    >
      {/* Column header */}
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={700}>
              {column.title}
            </Typography>
            <Badge badgeContent={tasks.length} color={overWipLimit ? 'warning' : 'default'} max={999}>
              <Box />
            </Badge>
          </Box>
          {column.wipLimit != null && (
            <Tooltip title={`WIP limit: ${column.wipLimit}`}>
              <Typography variant="caption" color={overWipLimit ? 'warning.main' : 'text.secondary'}>
                /{column.wipLimit}
              </Typography>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Cards */}
      <Box sx={{ p: 1, flex: 1, overflowY: 'auto', minHeight: 100 }}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDragStart={onDragStart} />
        ))}

        {/* Quick-add inline form */}
        {showQuickAdd ? (
          <Box sx={{ mt: 1 }}>
            <TextField
              size="small"
              fullWidth
              autoFocus
              placeholder="Task title..."
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitQuickAdd();
                if (e.key === 'Escape') { setShowQuickAdd(false); setQuickAddTitle(''); }
              }}
              onBlur={() => { if (!quickAddTitle.trim()) setShowQuickAdd(false); }}
            />
            <Box display="flex" gap={0.5} mt={0.5}>
              <Button size="small" variant="contained" onClick={handleSubmitQuickAdd} disabled={!quickAddTitle.trim()}>
                Add
              </Button>
              <Button size="small" onClick={() => { setShowQuickAdd(false); setQuickAddTitle(''); }}>
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowQuickAdd(true)}
            sx={{ mt: 1, width: '100%', justifyContent: 'flex-start', color: 'text.secondary' }}
          >
            Add task
          </Button>
        )}
      </Box>
    </Paper>
  );
};

/* ------------------------------------------------------------------ */
/* TodoBoard (main page)                                               */
/* ------------------------------------------------------------------ */

export const TodoBoard: React.FC = () => {
  const navigate = useNavigate();
  const { boardId: routeBoardId } = useParams<{ boardId?: string }>();
  const { user, loading: authLoading } = useAuth();

  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Track the resolved board ID so fetchTasks can use it without re-running initBoard
  const resolvedBoardIdRef = useRef<string | null>(null);

  // Fetch only tasks for the current board (used on filter/search changes)
  const fetchTasks = useCallback(async (boardId?: string) => {
    const targetBoardId = boardId || resolvedBoardIdRef.current;
    if (!targetBoardId) return;
    setTasksLoading(true);
    try {
      const params: Record<string, string> = { boardId: targetBoardId, pageSize: '1000' };
      if (searchQuery) params.search = searchQuery;
      if (filterPriority !== 'all') params.priority = filterPriority;
      const tasksRes = await api.get('/todos', { params });
      const tasksData = tasksRes.data?.data || tasksRes.data;
      const taskList = tasksData?.items || tasksData || [];
      setTasks(Array.isArray(taskList) ? taskList : []);
      setError(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  }, [searchQuery, filterPriority]);

  // Seed + resolve board + fetch columns (only on mount or board change)
  const initBoard = useCallback(async () => {
    if (authLoading || !user) return;
    setInitialLoading(true);
    try {
      // Ensure seed data exists (only runs on board init, not filter changes)
      await api.post('/todos/seed').catch(() => { /* ignore if already seeded */ });

      // Determine which board to load
      let boardId: string;
      if (routeBoardId) {
        boardId = routeBoardId;
      } else {
        const boardsRes = await api.get('/todos/boards/list');
        const boardsData = boardsRes.data?.data || boardsRes.data;
        const boards = boardsData?.items || boardsData || [];
        if (!Array.isArray(boards) || boards.length === 0) {
          setError('No boards found. Please create a board first.');
          setInitialLoading(false);
          return;
        }
        boardId = boards[0].id;
      }

      resolvedBoardIdRef.current = boardId;

      // Fetch board detail with columns
      const boardRes = await api.get(`/todos/boards/${boardId}`);
      const boardDetail = boardRes.data?.data || boardRes.data;
      setBoard(boardDetail);

      // Also fetch tasks on initial load
      await fetchTasks(boardId);
      setError(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        setError('Authentication required.');
      } else {
        setError(axiosError.response?.data?.message || 'Failed to load board');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [authLoading, user, routeBoardId, fetchTasks]);

  // Init board on mount or when board ID changes
  useEffect(() => {
    if (!authLoading && user) {
      initBoard();
    }
  }, [initBoard, authLoading, user]);

  // Re-fetch only tasks when search/filter changes (board already loaded)
  useEffect(() => {
    if (!authLoading && user && resolvedBoardIdRef.current && !initialLoading) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterPriority]);

  const getColumnTasks = (columnKey: string): TodoTask[] => {
    return tasks
      .filter((t) => t.status === columnKey)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const handleDragStart = (_e: React.DragEvent, taskId: string) => {
    setDraggingTaskId(taskId);
  };

  const handleDrop = async (_e: React.DragEvent, toColumnKey: string) => {
    if (!draggingTaskId || !board) return;
    const task = tasks.find((t) => t.id === draggingTaskId);
    if (!task || task.status === toColumnKey) {
      setDraggingTaskId(null);
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === draggingTaskId ? { ...t, status: toColumnKey } : t))
    );
    setDraggingTaskId(null);

    try {
      await api.post(`/todos/boards/${board.id}/tasks/${draggingTaskId}/move`, {
        toColumnKey,
        toIndex: 0,
      });
    } catch {
      // Revert on failure
      fetchTasks();
      setSnackbar({ open: true, message: 'Failed to move task', severity: 'error' });
    }
  };

  const handleQuickAdd = async (columnKey: string, title: string) => {
    if (!board) return;
    try {
      await api.post('/todos', {
        title,
        status: columnKey,
        boardId: board.id,
        priority: 'medium',
      });
      setSnackbar({ open: true, message: 'Task created', severity: 'success' });
      fetchTasks();
    } catch {
      setSnackbar({ open: true, message: 'Failed to create task', severity: 'error' });
    }
  };

  const loading = initialLoading || tasksLoading;

  if (authLoading || initialLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const columns = board?.columns
    ? [...board.columns].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" component="h1">
          {board?.name || 'Task Board'}
        </Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<ListIcon />} onClick={() => navigate('/todos')}>
            List View
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <ListToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search tasks..."
        onRefresh={fetchTasks}
        loading={loading}
        showSort={false}
        showPageSize={false}
        actions={
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={filterPriority}
              label="Priority"
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>
        }
      />

      {/* Kanban columns */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flex: 1,
          overflowX: 'auto',
          pb: 2,
          minHeight: 400,
        }}
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={getColumnTasks(col.key)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onQuickAdd={handleQuickAdd}
          />
        ))}
        {columns.length === 0 && !loading && (
          <Paper sx={{ p: 4, textAlign: 'center', width: '100%' }}>
            <Typography color="text.secondary">
              No board columns configured. The board will be set up automatically.
            </Typography>
          </Paper>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TodoBoard;
