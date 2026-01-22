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
} from '@mui/icons-material';
import { api } from '../services/api';

interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  category: string | null;
  tags: string | null;
  due_date: string | null;
  completed_at: string | null;
  owner_id: number;
  assigned_to: number | null;
  assigned_first_name: string | null;
  assigned_last_name: string | null;
  created_at: string;
  updated_at: string;
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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  category: string;
  due_date: string;
}

const priorityColors: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const statusColors: Record<string, 'default' | 'primary' | 'success'> = {
  pending: 'default',
  in_progress: 'primary',
  completed: 'success',
};

const TODO_CATEGORIES = ['Work', 'Personal', 'Compliance', 'Audit', 'Risk', 'Policy', 'Security', 'Other'];

const initialFormData: TodoFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  category: '',
  due_date: '',
};

export const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [formData, setFormData] = useState<TodoFormData>(initialFormData);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [tabValue, setTabValue] = useState(0);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/todos');
      setTodos(response.data.todos || []);
      setError(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      // Handle 404 gracefully - endpoint may not be implemented yet
      if (axiosError.response?.status === 404 || axiosError.response?.status === 502) {
        setTodos([]);
        setError(null);
        console.warn('Todo API not available yet');
      } else {
        setError(axiosError.response?.data?.message || 'Failed to fetch todos');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/todos/stats/summary');
      setStats(response.data);
    } catch (err: unknown) {
      // Silently handle 404 - endpoint may not be implemented yet
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status !== 404 && axiosError.response?.status !== 502) {
        console.error('Failed to fetch stats:', err);
      }
      // Set default stats when endpoint is not available
      setStats({ total: 0, completed: 0, pending: 0, in_progress: 0, overdue: 0 });
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchStats();
  }, [fetchTodos, fetchStats]);

  const handleOpenDialog = (todo?: Todo) => {
    if (todo) {
      setEditingTodo(todo);
      setFormData({
        title: todo.title,
        description: todo.description || '',
        priority: todo.priority,
        status: todo.status,
        category: todo.category || '',
        due_date: todo.due_date || '',
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
    try {
      if (editingTodo) {
        await api.put(`/todos/${editingTodo.id}`, formData);
      } else {
        await api.post('/todos', formData);
      }
      handleCloseDialog();
      fetchTodos();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save todo');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this todo?')) return;
    try {
      await api.delete(`/todos/${id}`);
      fetchTodos();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete todo');
    }
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
      const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
      await api.put(`/todos/${todo.id}`, { 
        status: newStatus,
        completed_at: completedAt 
      });
      fetchTodos();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update todo');
    }
  };

  const filteredTodos = todos.filter((todo) => {
    if (filterStatus !== 'all' && todo.status !== filterStatus) return false;
    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false;
    if (tabValue === 1 && todo.status === 'completed') return false;
    if (tabValue === 2 && todo.status !== 'completed') return false;
    return true;
  });

  const isOverdue = (todo: Todo) => {
    if (!todo.due_date || todo.status === 'completed') return false;
    return new Date(todo.due_date) < new Date();
  };

  const completionPercentage = stats ? Math.round((stats.completed / stats.total) * 100) || 0 : 0;

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
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Todo
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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

      <Box display="flex" gap={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
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

      <Grid container spacing={2}>
        {filteredTodos.map((todo) => (
          <Grid item xs={12} sm={6} md={4} key={todo.id}>
            <Card 
              sx={{ 
                height: '100%',
                opacity: todo.status === 'completed' ? 0.7 : 1,
                borderLeft: isOverdue(todo) ? '4px solid red' : 'none',
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography 
                    variant="h6" 
                    component="h2"
                    sx={{ 
                      textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                      flex: 1,
                    }}
                  >
                    {todo.title}
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => handleToggleComplete(todo)}
                    color={todo.status === 'completed' ? 'success' : 'default'}
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
                    color={priorityColors[todo.priority]}
                    icon={<FlagIcon />}
                  />
                  <Chip 
                    label={todo.status.replace('_', ' ')} 
                    size="small" 
                    color={statusColors[todo.status]}
                  />
                  {todo.category && (
                    <Chip label={todo.category} size="small" variant="outlined" />
                  )}
                </Box>
                
                {todo.due_date && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ScheduleIcon fontSize="small" color={isOverdue(todo) ? 'error' : 'action'} />
                    <Typography 
                      variant="caption" 
                      color={isOverdue(todo) ? 'error' : 'text.secondary'}
                    >
                      Due: {new Date(todo.due_date).toLocaleDateString()}
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

      {filteredTodos.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No todos found. {tabValue === 0 && 'Click "Add Todo" to create one.'}
          </Typography>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTodo ? 'Edit Todo' : 'Add New Todo'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Title"
              fullWidth
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TodoFormData['priority'] })}
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
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TodoFormData['status'] })}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
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
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.title}>
            {editingTodo ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TodoList;
