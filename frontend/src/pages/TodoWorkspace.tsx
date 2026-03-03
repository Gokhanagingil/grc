import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  CardActions,
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
  IconButton,
  Drawer,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tabs,
  Tab,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  ViewKanban as BoardIcon,
  ViewList as ListIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Flag as FlagIcon,
  Schedule as ScheduleIcon,
  DragIndicator as DragIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Label as TagIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { Menu as MuiMenu, ListItemIcon, ListItemText } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ListToolbar } from '../components/common/ListToolbar';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface TodoTag {
  id: string;
  name: string;
  color: string | null;
}

interface SimpleUser {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface SimpleGroup {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

interface TodoTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string | null;
  tags: string[] | null;
  taskTags?: TodoTag[];
  dueDate: string | null;
  completedAt: string | null;
  assigneeUserId: string | null;
  ownerGroupId: string | null;
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

interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
  overdue: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

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

const COLUMN_TINTS: Record<string, string> = {
  todo: '#e3f2fd',
  pending: '#e3f2fd',
  doing: '#fff3e0',
  in_progress: '#fff3e0',
  done: '#e8f5e9',
  completed: '#e8f5e9',
};

const COLUMN_BORDER: Record<string, string> = {
  todo: '#90caf9',
  pending: '#90caf9',
  doing: '#ffcc80',
  in_progress: '#ffcc80',
  done: '#a5d6a7',
  completed: '#a5d6a7',
};

const TODO_CATEGORIES = ['Work', 'Personal', 'Compliance', 'Audit', 'Risk', 'Policy', 'Security', 'Other'];

const VIEW_KEY = 'todo-workspace-view';

const isOverdue = (task: TodoTask): boolean => {
  if (!task.dueDate || task.status === 'done' || task.status === 'completed') return false;
  return new Date(task.dueDate) < new Date();
};

/* ------------------------------------------------------------------ */
/* TaskCard (Board view)                                               */
/* ------------------------------------------------------------------ */

const TaskCard: React.FC<{
  task: TodoTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: (task: TodoTask) => void;
}> = ({ task, onDragStart, onClick }) => (
  <Card
    draggable
    onDragStart={(e) => onDragStart(e, task.id)}
    onClick={() => onClick(task)}
    sx={{
      mb: 1,
      cursor: 'pointer',
      '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
      borderLeft: isOverdue(task) ? '3px solid #f44336' : '3px solid transparent',
      opacity: task.status === 'done' || task.status === 'completed' ? 0.7 : 1,
      transition: 'all 0.15s ease',
    }}
  >
    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Box display="flex" alignItems="flex-start" gap={0.5}>
        <DragIcon fontSize="small" sx={{ color: 'text.disabled', mt: 0.25, cursor: 'grab' }} />
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
            {(task.taskTags || []).map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                sx={{
                  height: 20,
                  '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' },
                  bgcolor: tag.color || '#e0e0e0',
                  color: tag.color ? '#fff' : 'text.primary',
                }}
              />
            ))}
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
/* KanbanColumn (Board view)                                           */
/* ------------------------------------------------------------------ */

const KanbanColumn: React.FC<{
  column: BoardColumn;
  tasks: TodoTask[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, columnKey: string) => void;
  onQuickAdd: (columnKey: string, title: string) => void;
  onCardClick: (task: TodoTask) => void;
}> = ({ column, tasks, onDragStart, onDrop, onQuickAdd, onCardClick }) => {
  const [dragOver, setDragOver] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const overWipLimit = column.wipLimit != null && tasks.length > column.wipLimit;
  const tint = COLUMN_TINTS[column.key] || '#fafafa';
  const border = COLUMN_BORDER[column.key] || '#bdbdbd';

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
        bgcolor: dragOver ? 'action.hover' : '#fafafa',
        borderTop: `3px solid ${overWipLimit ? '#ff9800' : border}`,
        borderRadius: 1,
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(e, column.key); }}
    >
      {/* Column header */}
      <Box sx={{ p: 1.5, bgcolor: tint, borderBottom: `1px solid ${border}` }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
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
          <TaskCard key={task.id} task={task} onDragStart={onDragStart} onClick={onCardClick} />
        ))}

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
/* TaskDetailDrawer                                                    */
/* ------------------------------------------------------------------ */

const TaskDetailDrawer: React.FC<{
  task: TodoTask | null;
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  boards: Board[];
  allTags: TodoTag[];
  users: SimpleUser[];
  groups: SimpleGroup[];
  onTagCreated: (tag: TodoTag) => void;
}> = ({ task, open, onClose, onSave, onDelete, boards, allTags, users, groups, onTagCreated }) => {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TodoTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1976d2');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const res = await api.post('/todos/tags', { name: newTagName.trim(), color: newTagColor });
      const tag = res.data?.data || res.data;
      onTagCreated(tag);
      setSelectedTags((prev) => [...prev, tag]);
      setNewTagName('');
      setShowCreateTag(false);
    } catch { /* ignore */ } finally {
      setCreatingTag(false);
    }
  };

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        category: task.category || '',
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
        boardId: task.boardId || '',
        assigneeUserId: task.assigneeUserId || '',
        ownerGroupId: task.ownerGroupId || '',
      });
      setSelectedTags(task.taskTags || []);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.tagIds = selectedTags.map((t) => t.id);
      if (!payload.dueDate) payload.dueDate = null;
      if (!payload.boardId) payload.boardId = null;
      if (!payload.assigneeUserId) payload.assigneeUserId = null;
      if (!payload.ownerGroupId) payload.ownerGroupId = null;
      if (!payload.category) payload.category = null;
      await onSave(task.id, payload);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!task || !window.confirm('Delete this task?')) return;
    await onDelete(task.id);
    onClose();
  };

  if (!task) return null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Task Details</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* Form fields */}
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Title"
            fullWidth
            required
            value={form.title || ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <Box display="flex" gap={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={form.status || 'todo'} label="Status" onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="doing">Doing</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select value={form.priority || 'medium'} label="Priority" onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select value={form.category || ''} label="Category" onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <MenuItem value="">None</MenuItem>
              {TODO_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Board</InputLabel>
            <Select value={form.boardId || ''} label="Board" onChange={(e) => setForm({ ...form, boardId: e.target.value })}>
              <MenuItem value="">No board</MenuItem>
              {boards.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField
            label="Due Date"
            type="date"
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            value={form.dueDate || ''}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />

          {/* Assigned To */}
          <Autocomplete
            options={users}
            value={users.find((u) => u.id === form.assigneeUserId) || null}
            onChange={(_, newVal) => setForm({ ...form, assigneeUserId: newVal?.id || '' })}
            getOptionLabel={(o) => o.displayName || `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email || o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Assigned To" size="small" />}
          />

          {/* Assignment Group */}
          <FormControl fullWidth size="small">
            <InputLabel>Assignment Group</InputLabel>
            <Select
              value={form.ownerGroupId || ''}
              label="Assignment Group"
              onChange={(e) => setForm({ ...form, ownerGroupId: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {groups.length > 0 ? (
                groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)
              ) : (
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    No groups yet &mdash; <a href="/groups" style={{ color: 'inherit' }}>create one</a>
                  </Typography>
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {/* Tags */}
          <Autocomplete
            multiple
            options={allTags}
            value={selectedTags}
            onChange={(_, newVal) => setSelectedTags(newVal)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
            renderTags={(value, getTagProps) =>
              value.map((tag, index) => {
                const { key, ...rest } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={tag.name}
                    size="small"
                    {...rest}
                    sx={{ bgcolor: tag.color || undefined, color: tag.color ? '#fff' : undefined }}
                  />
                );
              })
            }
          />
          {/* Inline Create Tag */}
          {showCreateTag ? (
            <Box display="flex" gap={1} alignItems="center">
              <TextField
                size="small"
                label="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                sx={{ width: 56 }}
              />
              <Button size="small" variant="contained" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()}>
                Add
              </Button>
              <Button size="small" onClick={() => setShowCreateTag(false)}>Cancel</Button>
            </Box>
          ) : (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setShowCreateTag(true)} sx={{ alignSelf: 'flex-start' }}>
              Create Tag
            </Button>
          )}

          {/* Metadata */}
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Created: {new Date(task.createdAt).toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Updated: {new Date(task.updatedAt).toLocaleString()}
          </Typography>
          {task.completedAt && (
            <Typography variant="caption" color="success.main">
              Completed: {new Date(task.completedAt).toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box display="flex" gap={1} mt={2} pt={2} borderTop={1} borderColor="divider">
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || !form.title}
            fullWidth
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteClick}>
            Delete
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */
/* CreateBoardDialog                                                   */
/* ------------------------------------------------------------------ */

const CreateBoardDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: (board: Board) => void;
}> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/todos/boards', { name: name.trim(), description: description.trim() || null });
      const board = res.data?.data || res.data;
      onCreated(board);
      setName('');
      setDescription('');
      onClose();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Board</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Board Name" fullWidth required value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Description" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* CreateTaskDialog                                                    */
/* ------------------------------------------------------------------ */

const CreateTaskDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  boards: Board[];
  allTags: TodoTag[];
  defaultBoardId?: string;
}> = ({ open, onClose, onCreated, boards, allTags, defaultBoardId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [boardId, setBoardId] = useState(defaultBoardId || '');
  const [selectedTags, setSelectedTags] = useState<TodoTag[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBoardId(defaultBoardId || '');
    }
  }, [open, defaultBoardId]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        category: category || undefined,
        dueDate: dueDate || undefined,
        boardId: boardId || undefined,
        tagIds: selectedTags.length > 0 ? selectedTags.map((t) => t.id) : undefined,
      };
      await api.post('/todos', payload);
      onCreated();
      // Reset
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setCategory('');
      setDueDate('');
      setSelectedTags([]);
      onClose();
    } catch {
      // handled by parent snackbar
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Task</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title" fullWidth required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Description" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Box display="flex" gap={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select value={priority} label="Priority" onChange={(e) => setPriority(e.target.value)}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="doing">Doing</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box display="flex" gap={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
                <MenuItem value="">None</MenuItem>
                {TODO_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Board</InputLabel>
              <Select value={boardId} label="Board" onChange={(e) => setBoardId(e.target.value)}>
                <MenuItem value="">No board</MenuItem>
                {boards.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <TextField label="Due Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Autocomplete
            multiple
            options={allTags}
            value={selectedTags}
            onChange={(_, newVal) => setSelectedTags(newVal)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
            renderTags={(value, getTagProps) =>
              value.map((tag, index) => {
                const { key, ...rest } = getTagProps({ index });
                return (
                  <Chip key={key} label={tag.name} size="small" {...rest} sx={{ bgcolor: tag.color || undefined, color: tag.color ? '#fff' : undefined }} />
                );
              })
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={saving || !title.trim()}>
          {saving ? 'Creating...' : 'Create Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* TodoWorkspace (main page)                                           */
/* ------------------------------------------------------------------ */

export const TodoWorkspace: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _navigate = useNavigate();
  const { boardId: routeBoardId } = useParams<{ boardId?: string }>();
  const { user, loading: authLoading } = useAuth();

  // View toggle (persisted in localStorage)
  const [view, setView] = useState<'board' | 'list'>(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'list' ? 'list' : 'board';
  });

  // Data
  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [allTags, setAllTags] = useState<TodoTag[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [groups, setGroups] = useState<SimpleGroup[]>([]);

  // Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TodoTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createBoardDialogOpen, setCreateBoardDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Board settings menu
  const [boardMenuAnchor, setBoardMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteBoardDialogOpen, setDeleteBoardDialogOpen] = useState(false);
  const [renameBoardDialogOpen, setRenameBoardDialogOpen] = useState(false);
  const [renameBoardName, setRenameBoardName] = useState('');

  const resolvedBoardIdRef = useRef<string | null>(null);

  // ---- Data fetching ----

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get('/todos/tags/list');
      const data = res.data?.data || res.data;
      setAllTags(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
    } catch {
      setAllTags([]);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/todos/stats/summary');
      const data = response.data?.data || response.data;
      setStats(data);
    } catch {
      setStats({ total: 0, completed: 0, pending: 0, in_progress: 0, overdue: 0 });
    }
  }, []);

  const fetchTasks = useCallback(async (boardId?: string) => {
    const targetBoardId = boardId || resolvedBoardIdRef.current;
    setTasksLoading(true);
    try {
      const params: Record<string, string> = { pageSize: '1000' };
      if (targetBoardId) params.boardId = targetBoardId;
      if (searchQuery) params.search = searchQuery;
      if (filterPriority !== 'all') params.priority = filterPriority;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterCategory !== 'all') params.category = filterCategory;
      if (filterAssignee !== 'all') params.assigneeUserId = filterAssignee;
      if (filterGroup !== 'all') params.ownerGroupId = filterGroup;
      if (filterTagIds.length > 0) params.tagIds = filterTagIds.join(',');
      const tasksRes = await api.get('/todos', { params });
      const tasksData = tasksRes.data?.data || tasksRes.data;
      const taskList = tasksData?.items || tasksData || [];
      setTasks(Array.isArray(taskList) ? taskList : []);
      setError(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        setError('Authentication required. Please log in again.');
      } else {
        setError(axiosError.response?.data?.message || 'Failed to load tasks');
      }
    } finally {
      setTasksLoading(false);
    }
  }, [searchQuery, filterPriority, filterStatus, filterCategory, filterAssignee, filterGroup, filterTagIds]);

  const initWorkspace = useCallback(async () => {
    if (authLoading || !user) return;
    setInitialLoading(true);
    try {
      // Ensure seed data exists
      await api.post('/todos/seed').catch(() => { /* ignore */ });

      // Fetch boards
      const boardsRes = await api.get('/todos/boards/list');
      const boardsData = boardsRes.data?.data || boardsRes.data;
      const boardList: Board[] = Array.isArray(boardsData?.items) ? boardsData.items : Array.isArray(boardsData) ? boardsData : [];
      setBoards(boardList);

      // Determine current board
      let targetBoardId: string | undefined;
      if (routeBoardId) {
        targetBoardId = routeBoardId;
      } else if (boardList.length > 0) {
        targetBoardId = boardList[0].id;
      }

      if (targetBoardId) {
        resolvedBoardIdRef.current = targetBoardId;
        const boardRes = await api.get(`/todos/boards/${targetBoardId}`);
        const boardDetail = boardRes.data?.data || boardRes.data;
        setCurrentBoard(boardDetail);
      }

      // Fetch users and departments
      const [, , , usersRes, groupsRes] = await Promise.all([
        fetchTasks(targetBoardId),
        fetchTags(),
        fetchStats(),
        api.get('/users', { params: { pageSize: '500' } }).catch(() => ({ data: { items: [] } })),
        api.get('/grc/groups/directory', { params: { pageSize: '200' } }).catch(() => ({ data: { items: [] } })),
      ]);

      // Parse users
      const usersData = usersRes.data?.data || usersRes.data;
      const userList = Array.isArray(usersData?.items) ? usersData.items : Array.isArray(usersData) ? usersData : [];
      setUsers(userList);

      // Parse groups
      const groupsData = groupsRes.data?.data || groupsRes.data;
      const groupList = Array.isArray(groupsData?.items) ? groupsData.items : Array.isArray(groupsData) ? groupsData : [];
      setGroups(groupList);

      setError(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        setError('Authentication required.');
      } else {
        setError(axiosError.response?.data?.message || 'Failed to load workspace');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [authLoading, user, routeBoardId, fetchTasks, fetchTags, fetchStats]);

  useEffect(() => {
    if (!authLoading && user) {
      initWorkspace();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, routeBoardId]);

  // Re-fetch tasks when filters change
  useEffect(() => {
    if (!authLoading && user && !initialLoading) {
      fetchTasks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterPriority, filterStatus, filterCategory, filterAssignee, filterGroup, filterTagIds]);

  // ---- View toggle ----

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: 'board' | 'list' | null) => {
    if (newView) {
      setView(newView);
      localStorage.setItem(VIEW_KEY, newView);
    }
  };

  // ---- Board switching ----

  const handleBoardChange = async (boardId: string) => {
    resolvedBoardIdRef.current = boardId;
    try {
      const boardRes = await api.get(`/todos/boards/${boardId}`);
      const boardDetail = boardRes.data?.data || boardRes.data;
      setCurrentBoard(boardDetail);
      await fetchTasks(boardId);
    } catch {
      setSnackbar({ open: true, message: 'Failed to load board', severity: 'error' });
    }
  };

  // ---- Board CRUD ----

  const handleBoardCreated = (board: Board) => {
    setBoards((prev) => [board, ...prev]);
    handleBoardChange(board.id);
    setSnackbar({ open: true, message: `Board "${board.name}" created`, severity: 'success' });
  };

  const handleDeleteBoard = async () => {
    if (!currentBoard) return;
    try {
      await api.delete(`/todos/boards/${currentBoard.id}`);
      setBoards((prev) => {
        const remaining = prev.filter((b) => b.id !== currentBoard!.id);
        if (remaining.length > 0) {
          handleBoardChange(remaining[0].id);
        } else {
          setCurrentBoard(null);
          resolvedBoardIdRef.current = null;
          setTasks([]);
        }
        return remaining;
      });
      setDeleteBoardDialogOpen(false);
      setSnackbar({ open: true, message: `Board "${currentBoard.name}" deleted`, severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete board', severity: 'error' });
    }
  };

  const handleRenameBoard = async () => {
    if (!currentBoard || !renameBoardName.trim()) return;
    try {
      const res = await api.patch(`/todos/boards/${currentBoard.id}`, { name: renameBoardName.trim() });
      const updated = res.data?.data || res.data;
      setCurrentBoard(updated);
      setBoards((prev) => prev.map((b) => (b.id === currentBoard.id ? { ...b, name: renameBoardName.trim() } : b)));
      setRenameBoardDialogOpen(false);
      setSnackbar({ open: true, message: 'Board renamed', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to rename board', severity: 'error' });
    }
  };

  const handleTagCreated = (tag: TodoTag) => {
    setAllTags((prev) => [...prev, tag]);
  };

  // ---- Task CRUD ----

  const handleTaskSave = async (taskId: string, data: Record<string, unknown>) => {
    try {
      await api.patch(`/todos/${taskId}`, data);
      setSnackbar({ open: true, message: 'Task updated', severity: 'success' });
      fetchTasks();
      fetchStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setSnackbar({ open: true, message: axiosError.response?.data?.message || 'Failed to update task', severity: 'error' });
      throw err;
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await api.delete(`/todos/${taskId}`);
      setSnackbar({ open: true, message: 'Task deleted', severity: 'success' });
      fetchTasks();
      fetchStats();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setSnackbar({ open: true, message: axiosError.response?.data?.message || 'Failed to delete task', severity: 'error' });
    }
  };

  const handleTaskCreated = () => {
    setSnackbar({ open: true, message: 'Task created', severity: 'success' });
    fetchTasks();
    fetchStats();
  };

  const handleToggleComplete = async (task: TodoTask) => {
    try {
      const isDone = task.status === 'done' || task.status === 'completed';
      const newStatus = isDone ? 'todo' : 'done';
      await api.patch(`/todos/${task.id}`, { status: newStatus });
      fetchTasks();
      fetchStats();
    } catch {
      setSnackbar({ open: true, message: 'Failed to update task', severity: 'error' });
    }
  };

  const handleCardClick = (task: TodoTask) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  // ---- Board drag/drop ----

  const handleDragStart = (_e: React.DragEvent, taskId: string) => {
    setDraggingTaskId(taskId);
  };

  const handleDrop = async (_e: React.DragEvent, toColumnKey: string) => {
    if (!draggingTaskId || !currentBoard) return;
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
      await api.post(`/todos/boards/${currentBoard.id}/tasks/${draggingTaskId}/move`, {
        toColumnKey,
        toIndex: 0,
      });
    } catch {
      fetchTasks();
      setSnackbar({ open: true, message: 'Failed to move task', severity: 'error' });
    }
  };

  const handleQuickAdd = async (columnKey: string, title: string) => {
    if (!currentBoard) return;
    try {
      await api.post('/todos', {
        title,
        status: columnKey,
        boardId: currentBoard.id,
        priority: 'medium',
      });
      setSnackbar({ open: true, message: 'Task created', severity: 'success' });
      fetchTasks();
      fetchStats();
    } catch {
      setSnackbar({ open: true, message: 'Failed to create task', severity: 'error' });
    }
  };

  // ---- Helpers ----

  const getColumnTasks = (columnKey: string): TodoTask[] => {
    return tasks
      .filter((t) => t.status === columnKey)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const loading = initialLoading || tasksLoading;

  const filteredListTasks = tasks.filter((todo) => {
    if (tabValue === 1 && (todo.status === 'done' || todo.status === 'completed')) return false;
    if (tabValue === 2 && todo.status !== 'done' && todo.status !== 'completed') return false;
    return true;
  });

  const completionPercentage = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const columns = currentBoard?.columns
    ? [...currentBoard.columns].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  // ---- Render ----

  if (authLoading || initialLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h4" component="h1">
            Work Management
          </Typography>
          {/* Board Selector */}
          {boards.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={currentBoard?.id || ''}
                onChange={(e) => handleBoardChange(e.target.value)}
                displayEmpty
                sx={{ fontWeight: 600 }}
              >
                {boards.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {/* Board Settings kebab menu */}
          {currentBoard && (
            <>
              <IconButton
                size="small"
                onClick={(e) => setBoardMenuAnchor(e.currentTarget)}
                aria-label="Board settings"
              >
                <MoreVertIcon />
              </IconButton>
              <MuiMenu
                anchorEl={boardMenuAnchor}
                open={Boolean(boardMenuAnchor)}
                onClose={() => setBoardMenuAnchor(null)}
              >
                <MenuItem onClick={() => { setBoardMenuAnchor(null); setRenameBoardName(currentBoard.name); setRenameBoardDialogOpen(true); }}>
                  <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Rename Board</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setBoardMenuAnchor(null); setDeleteBoardDialogOpen(true); }} sx={{ color: 'error.main' }}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete Board</ListItemText>
                </MenuItem>
              </MuiMenu>
            </>
          )}
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <ToggleButtonGroup value={view} exclusive onChange={handleViewChange} size="small">
            <ToggleButton value="board" aria-label="board view">
              <BoardIcon sx={{ mr: 0.5 }} /> Board
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <ListIcon sx={{ mr: 0.5 }} /> List
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" size="small" onClick={() => setCreateBoardDialogOpen(true)}>
            New Board
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Add Task
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <ListToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search tasks..."
        onRefresh={() => { fetchTasks(); fetchStats(); }}
        loading={loading}
        showSort={false}
        showPageSize={false}
        actions={
          <Box display="flex" gap={1}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="doing">Doing</MenuItem>
                <MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Priority</InputLabel>
              <Select value={filterPriority} label="Priority" onChange={(e) => setFilterPriority(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Category</InputLabel>
              <Select value={filterCategory} label="Category" onChange={(e) => setFilterCategory(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                {TODO_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            {/* Tag filter */}
            <Autocomplete
              multiple
              size="small"
              options={allTags}
              value={allTags.filter((t) => filterTagIds.includes(t.id))}
              onChange={(_, newVal) => setFilterTagIds(newVal.map((t) => t.id))}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
              sx={{ minWidth: 150 }}
            />
            {/* Assignee filter */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Assigned To</InputLabel>
              <Select value={filterAssignee} label="Assigned To" onChange={(e) => setFilterAssignee(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Assignment Group filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Group</InputLabel>
              <Select value={filterGroup} label="Group" onChange={(e) => setFilterGroup(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        }
      />

      {/* Stats Bar */}
      {stats && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box flex={1}>
              <LinearProgress
                variant="determinate"
                value={completionPercentage}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" noWrap>
              {stats.completed}/{stats.total} done
            </Typography>
            <Box display="flex" gap={0.5}>
              <Chip label={`${stats.pending} Pending`} size="small" />
              <Chip label={`${stats.in_progress} Active`} size="small" color="primary" />
              <Chip label={`${stats.completed} Done`} size="small" color="success" />
              {stats.overdue > 0 && <Chip label={`${stats.overdue} Overdue`} size="small" color="error" />}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Board View */}
      {view === 'board' && (
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
              onCardClick={handleCardClick}
            />
          ))}
          {columns.length === 0 && !loading && (
            <Paper sx={{ p: 4, textAlign: 'center', width: '100%' }}>
              <Typography color="text.secondary">
                No board columns configured. Please select or create a board.
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* List View */}
      {view === 'list' && (
        <Box>
          <Paper sx={{ mb: 2 }}>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
              <Tab label="All" />
              <Tab label="Active" />
              <Tab label="Completed" />
            </Tabs>
          </Paper>

          <Grid container spacing={2}>
            {filteredListTasks.map((todo) => (
              <Grid item xs={12} sm={6} md={4} key={todo.id}>
                <Card
                  onClick={() => handleCardClick(todo)}
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 3 },
                    opacity: (todo.status === 'done' || todo.status === 'completed') ? 0.7 : 1,
                    borderLeft: isOverdue(todo) ? '4px solid #f44336' : '4px solid transparent',
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
                          fontSize: '1rem',
                        }}
                      >
                        {todo.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleToggleComplete(todo); }}
                        color={(todo.status === 'done' || todo.status === 'completed') ? 'success' : 'default'}
                      >
                        <CheckIcon />
                      </IconButton>
                    </Box>

                    {todo.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
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
                      {(todo.taskTags || []).map((tag) => (
                        <Chip
                          key={tag.id}
                          label={tag.name}
                          size="small"
                          icon={<TagIcon />}
                          sx={{
                            bgcolor: tag.color || undefined,
                            color: tag.color ? '#fff' : undefined,
                            '& .MuiChip-icon': { color: tag.color ? '#fff' : undefined },
                          }}
                        />
                      ))}
                    </Box>

                    {todo.dueDate && (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <ScheduleIcon fontSize="small" color={isOverdue(todo) ? 'error' : 'action'} />
                        <Typography variant="caption" color={isOverdue(todo) ? 'error' : 'text.secondary'}>
                          Due: {new Date(todo.dueDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<EditIcon />} onClick={(e) => { e.stopPropagation(); handleCardClick(todo); }}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={(e) => { e.stopPropagation(); handleTaskDelete(todo.id); }}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {filteredListTasks.length === 0 && !loading && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No tasks found. Click &quot;Add Task&quot; to create one.
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedTask(null); }}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
        boards={boards}
        allTags={allTags}
        users={users}
        groups={groups}
        onTagCreated={handleTagCreated}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={handleTaskCreated}
        boards={boards}
        allTags={allTags}
        defaultBoardId={currentBoard?.id}
      />

      {/* Create Board Dialog */}
      <CreateBoardDialog
        open={createBoardDialogOpen}
        onClose={() => setCreateBoardDialogOpen(false)}
        onCreated={handleBoardCreated}
      />

      {/* Delete Board Confirmation Dialog */}
      <Dialog open={deleteBoardDialogOpen} onClose={() => setDeleteBoardDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Board</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{currentBoard?.name}&quot;?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Tasks in this board will not be deleted. They will become unassigned from any board and appear in &quot;All Tasks&quot;.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteBoardDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteBoard}>Delete Board</Button>
        </DialogActions>
      </Dialog>

      {/* Rename Board Dialog */}
      <Dialog open={renameBoardDialogOpen} onClose={() => setRenameBoardDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Board</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Board Name"
            value={renameBoardName}
            onChange={(e) => setRenameBoardName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameBoardDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameBoard} disabled={!renameBoardName.trim()}>Rename</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TodoWorkspace;
