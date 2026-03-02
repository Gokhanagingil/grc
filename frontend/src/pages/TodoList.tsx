import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Card,
  CardContent,
  CardActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon,
  ViewKanban as BoardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ListToolbar } from '../components/common/ListToolbar';

interface Todo {
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
  createdAt: string;
  updatedAt: string;
}

interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
  overdue: number;
}

interface TodoFormData {
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  dueDate: string;
}

const priorityColors: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const statusColors: Record<string, 'default' | 'primary' | 'success'> = {
  todo: 'default',
  pending: 'default',
  doing: 'primary',
  in_progress: 'primary',
  done: 'success',
  completed: 'success',
};

const TODO_CATEGORIES = ['Work', 'Personal', 'Compliance', 'Audit', 'Risk', 'Policy', 'Security', 'Other'];

const initialFormData: TodoFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  category: '',
  dueDate: '',
};

export const TodoList: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [authError, setAuthError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [formData, setFormData] = useState<TodoFormData>(initialFormData);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);

  const fetchTodos = useCallback(async () => {
    if (authLoading || !user) return;

    try {
      setLoading(true);
      setAuthError(false);
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterPriority !== 'all') params.priority = filterPriority;
      const response = await api.get('/todos', { params });
      // Support both new LIST-CONTRACT shape and legacy shape
      const data = response.data?.data || response.data;
      const todoList = data?.items || data?.todos || [];
      setTodos(Array.isArray(todoList) ? todoList : []);
      setError(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        setAuthError(true);
        setTodos([]);
        setError('Session expired or unauthorized. Please log in again.');
      } else if (axiosError.response?.status === 404 || axiosError.response?.status === 502) {
        setTodos([]);
        setError(null);
      } else {
        setError(axiosError.response?.data?.message || 'Failed to fetch todos');
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, searchQuery, filterStatus, filterPriority]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/todos/stats/summary');
      const data = response.data?.data || response.data;
      setStats(data);
    } catch {
      setStats({ total: 0, completed: 0, pending: 0, in_progress: 0, overdue: 0 });
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTodos();
      fetchStats();
    }
  }, [fetchTodos, fetchStats, authLoading, user]);

  const handleOpenDialog = (todo?: Todo) => {
    if (todo) {
      setEditingTodo(todo);
      setFormData({
        title: todo.title,
        description: todo.description || '',
        priority: todo.priority || 'medium',
        status: todo.status || 'todo',
        category: todo.category || '',
        dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
      });
    } else {
      setEditingTodo(null);
      setFormData(initialFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTodo(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setSnackbar({ open: true, message: 'Title is required', severity: 'error' });
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        status: formData.status,
        category: formData.category || undefined,
        dueDate: formData.dueDate || undefined,
      };
      if (editingTodo) {
        await api.patch(`/todos/${editingTodo.id}`, payload);
        setSnackbar({ open: true, message: 'Task updated', severity: 'success' });
      } else {
        await api.post('/todos', payload);
        setSnackbar({ open: true, message: 'Task created', severity: 'success' });
      }
      handleCloseDialog();
      fetchTodos();
      fetchStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const msg = axiosError.response?.data?.message || 'Failed to save task';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/todos/${id}`);
      setSnackbar({ open: true, message: 'Task deleted', severity: 'success' });
      fetchTodos();
      fetchStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setSnackbar({ open: true, message: axiosError.response?.data?.message || 'Failed to delete task', severity: 'error' });
    }
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      const isDone = todo.status === 'done' || todo.status === 'completed';
      const newStatus = isDone ? 'todo' : 'done';
      await api.patch(`/todos/${todo.id}`, { status: newStatus });
      fetchTodos();
      fetchStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setSnackbar({ open: true, message: axiosError.response?.data?.message || 'Failed to update task', severity: 'error' });
    }
  };

  const filteredTodos = todos.filter((todo) => {
    if (tabValue === 1 && (todo.status === 'done' || todo.status === 'completed')) return false;
    if (tabValue === 2 && todo.status !== 'done' && todo.status !== 'completed') return false;
    return true;
  });

  const isOverdue = (todo: Todo) => {
    if (!todo.dueDate || todo.status === 'done' || todo.status === 'completed') return false;
    return new Date(todo.dueDate) < new Date();
  };

  const completionPercentage = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (authError) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px" gap={2}>
        <Alert severity="error">
          Session expired or unauthorized. Please log in again.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/login')}>
          Go to Login
        </Button>
      </Box>
    );
  }

  if (loading && todos.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          To-Do List
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<BoardIcon />}
            onClick={() => navigate('/todos/board')}
          >
            Board View
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Task
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
        onRefresh={() => { fetchTodos(); fetchStats(); }}
        loading={loading}
        showSort={false}
        showPageSize={false}
        actions={
          <Box display="flex" gap={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="doing">Doing</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
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
          </Box>
        }
      />

      {stats && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Progress: {stats.completed} of {stats.total} completed
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={completionPercentage} 
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
                <Chip label={`${stats.pending} Pending`} size="small" />
                <Chip label={`${stats.in_progress} In Progress`} size="small" color="primary" />
                <Chip label={`${stats.completed} Completed`} size="small" color="success" />
                {stats.overdue > 0 && (
                  <Chip label={`${stats.overdue} Overdue`} size="small" color="error" />
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="All" />
          <Tab label="Active" />
          <Tab label="Completed" />
        </Tabs>
      </Paper>

      <Grid container spacing={2}>
        {filteredTodos.map((todo) => (
          <Grid item xs={12} sm={6} md={4} key={todo.id}>
            <Card 
              sx={{ 
                height: '100%',
                opacity: (todo.status === 'done' || todo.status === 'completed') ? 0.7 : 1,
                borderLeft: isOverdue(todo) ? '4px solid red' : 'none',
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography 
                    variant="h6" 
                    component="h2"
                    sx={{ 
                      textDecoration: (todo.status === 'done' || todo.status === 'completed') ? 'line-through' : 'none',
                      flex: 1,
                    }}
                  >
                    {todo.title}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => handleToggleComplete(todo)}
                    color={(todo.status === 'done' || todo.status === 'completed') ? 'success' : 'default'}
                  >
                    <CheckIcon />
                  </IconButton>
                </Box>
                
                {todo.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {todo.description}
                  </Typography>
                )}
                
                <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                  <Chip 
                    label={todo.priority} 
                    size="small" 
                    color={priorityColors[todo.priority] || 'default'}
                    icon={<FlagIcon />}
                  />
                  <Chip 
                    label={todo.status.replace('_', ' ')} 
                    size="small" 
                    color={statusColors[todo.status] || 'default'}
                  />
                  {todo.category && (
                    <Chip label={todo.category} size="small" variant="outlined" />
                  )}
                </Box>
                
                {todo.dueDate && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ScheduleIcon fontSize="small" color={isOverdue(todo) ? 'error' : 'action'} />
                    <Typography 
                      variant="caption" 
                      color={isOverdue(todo) ? 'error' : 'text.secondary'}
                    >
                      Due: {new Date(todo.dueDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpenDialog(todo)}>
                  Edit
                </Button>
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(todo.id)}>
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredTodos.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No tasks found. {tabValue === 0 && 'Click "Add Task" to create one.'}
          </Typography>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTodo ? 'Edit Task' : 'Add New Task'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Title"
              fullWidth
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              error={!formData.title.trim() && formData.title.length > 0}
              helperText={!formData.title.trim() && formData.title.length > 0 ? 'Title is required' : ''}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="doing">Doing</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {TODO_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.title.trim()}>
            {editingTodo ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default TodoList;
