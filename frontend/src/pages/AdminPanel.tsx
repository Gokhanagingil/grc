import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  department: string;
  role: string;
}

const initialUserFormData: UserFormData = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  department: '',
  role: 'user',
};

export const AdminPanel: React.FC = () => {
  const { isAdmin } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>(initialUserFormData);

  const [systemStatus, setSystemStatus] = useState<{
    backend: string;
    database: string;
    uptime: number;
  } | null>(null);

  const [logs, setLogs] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data.users || response.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const response = await api.get('/health/detailed');
      setSystemStatus({
        backend: response.data.status,
        database: response.data.checks?.database?.status || 'Unknown',
        uptime: response.data.uptime || 0,
      });
    } catch (err) {
      setSystemStatus({
        backend: 'Error',
        database: 'Unknown',
        uptime: 0,
      });
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await api.get('/compliance/audit-logs?limit=50');
      const auditLogs = response.data.logs || response.data || [];
      setLogs(auditLogs.map((log: any) => 
        `[${new Date(log.created_at).toLocaleString()}] ${log.action} - ${log.entity_type} (User: ${log.user_id})`
      ));
    } catch (err) {
      setLogs(['Failed to fetch logs']);
    }
  }, []);

  useEffect(() => {
    if (tabValue === 0) fetchUsers();
    if (tabValue === 2) fetchSystemStatus();
    if (tabValue === 3) fetchLogs();
  }, [tabValue, fetchUsers, fetchSystemStatus, fetchLogs]);

  const handleOpenUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({
        username: user.username,
        email: user.email,
        password: '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        department: user.department || '',
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setUserFormData(initialUserFormData);
    }
    setUserDialogOpen(true);
  };

  const handleCloseUserDialog = () => {
    setUserDialogOpen(false);
    setEditingUser(null);
    setUserFormData(initialUserFormData);
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        const updateData: Partial<UserFormData> = { ...userFormData };
        if (!updateData.password) delete updateData.password;
        await api.put(`/users/${editingUser.id}`, updateData);
        setSuccess('User updated successfully');
      } else {
        await api.post('/users', userFormData);
        setSuccess('User created successfully');
      }
      handleCloseUserDialog();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      const endpoint = user.is_active ? 'deactivate' : 'activate';
      await api.put(`/users/${user.id}/${endpoint}`);
      setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      setSuccess('User role updated successfully');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user role');
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (!isAdmin) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography color="text.secondary">
            You must be an administrator to access this page.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Admin Panel
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="User Management" />
          <Tab label="Tenant Management" />
          <Tab label="System Status" />
          <Tab label="Audit Logs" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Users</Typography>
            <Box>
              <Button
                startIcon={<RefreshIcon />}
                onClick={fetchUsers}
                sx={{ mr: 1 }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenUserDialog()}
              >
                Add User
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || '-'}</TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          >
                            <MenuItem value="user">User</MenuItem>
                            <MenuItem value="manager">Manager</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? 'Active' : 'Inactive'}
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                          onClick={() => handleToggleUserActive(user)}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleOpenUserDialog(user)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteUser(user.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>Tenant Management</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Multi-tenant features are available in the NestJS backend. 
            The Express backend operates in single-tenant mode.
          </Alert>
          <Paper sx={{ p: 3 }}>
            <Typography variant="body1" gutterBottom>
              Current Mode: <strong>Single Tenant</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              To enable multi-tenant features, migrate to the NestJS backend (port 3002) 
              which supports full tenant isolation with the x-tenant-id header.
            </Typography>
          </Paper>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">System Status</Typography>
            <Button startIcon={<RefreshIcon />} onClick={fetchSystemStatus}>
              Refresh
            </Button>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Backend Status
                  </Typography>
                  <Chip
                    label={systemStatus?.backend || 'Loading...'}
                    color={systemStatus?.backend === 'OK' ? 'success' : 'error'}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Database Status
                  </Typography>
                  <Chip
                    label={systemStatus?.database || 'Loading...'}
                    color={systemStatus?.database === 'OK' ? 'success' : 'error'}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Uptime
                  </Typography>
                  <Typography variant="h6">
                    {systemStatus ? formatUptime(systemStatus.uptime) : 'Loading...'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>System Commands</Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              System commands require server-side implementation. 
              These controls are for demonstration purposes.
            </Alert>
            <Grid container spacing={2}>
              <Grid item>
                <Button variant="outlined" startIcon={<InfoIcon />} onClick={fetchSystemStatus}>
                  Check Health
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Audit Logs</Typography>
            <Button startIcon={<RefreshIcon />} onClick={fetchLogs}>
              Refresh
            </Button>
          </Box>

          <Paper sx={{ p: 2, bgcolor: '#1e1e1e', maxHeight: 400, overflow: 'auto' }}>
            {logs.length === 0 ? (
              <Typography color="grey.500" sx={{ fontFamily: 'monospace' }}>
                No logs available
              </Typography>
            ) : (
              logs.map((log, index) => (
                <Typography
                  key={index}
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#d4d4d4',
                    py: 0.5,
                  }}
                >
                  {log}
                </Typography>
              ))
            )}
          </Paper>
        </TabPanel>
      </Paper>

      <Dialog open={userDialogOpen} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Username"
              fullWidth
              required
              value={userFormData.username}
              onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
              disabled={!!editingUser}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={userFormData.email}
              onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
            />
            <TextField
              label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
              type="password"
              fullWidth
              required={!editingUser}
              value={userFormData.password}
              onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
            />
            <TextField
              label="First Name"
              fullWidth
              value={userFormData.first_name}
              onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
            />
            <TextField
              label="Last Name"
              fullWidth
              value={userFormData.last_name}
              onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
            />
            <TextField
              label="Department"
              fullWidth
              value={userFormData.department}
              onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={userFormData.role}
                label="Role"
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog}>Cancel</Button>
          <Button
            onClick={handleSaveUser}
            variant="contained"
            disabled={!userFormData.username || !userFormData.email || (!editingUser && !userFormData.password)}
          >
            {editingUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPanel;
