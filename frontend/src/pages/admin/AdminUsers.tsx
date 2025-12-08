import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PersonOff as DeactivateIcon,
  PersonAdd as ActivateIcon,
} from '@mui/icons-material';
import {
  AdminPageHeader,
  AdminTable,
  AdminModal,
  AdminFormField,
  Column,
} from '../../components/admin';
import { userClient, User, UserFormData } from '../../services/userClient';
import { useAuth } from '../../contexts/AuthContext';

interface UserFormState {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  password: string;
  isActive: boolean;
}

const initialFormState: UserFormState = {
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  department: '',
  role: 'user',
  password: '',
  isActive: true,
};

export const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null);
  const [newRole, setNewRole] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userClient.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setUsers(response.users);
      setTotal(response.pagination?.total || response.users.length);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData(initialFormState);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      department: user.department || '',
      role: user.role,
      password: '',
      isActive: user.is_active,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormData(initialFormState);
    setFormErrors({});
  };

  const handleFormChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!editingUser && !formData.password) {
      errors.password = 'Password is required for new users';
    } else if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    }

    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      const userData: UserFormData = {
        username: formData.username || formData.email.split('@')[0],
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department || undefined,
        role: formData.role,
        password: formData.password || undefined,
        isActive: formData.isActive,
      };

      if (editingUser) {
        await userClient.update(editingUser.id, userData);
        setSuccess('User updated successfully');
      } else {
        await userClient.create(userData);
        setSuccess('User created successfully');
      }

      handleCloseModal();
      fetchUsers();
    } catch (err: unknown) {
      // Extract error message from Axios error response
      const axiosError = err as { 
        response?: { 
          data?: { 
            message?: string | string[]; 
            error?: string;
          } 
        };
        message?: string;
      };
      
      let errorMessage = 'Failed to save user';
      
      if (axiosError.response?.data?.message) {
        const msg = axiosError.response.data.message;
        // NestJS ValidationPipe returns an array of messages
        if (Array.isArray(msg)) {
          errorMessage = msg.join('. ');
        } else {
          errorMessage = msg;
        }
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeleteModal = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      await userClient.delete(userToDelete.id);
      setSuccess('User deleted successfully');
      handleCloseDeleteModal();
      fetchUsers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string | string[] } }; message?: string };
      let errorMessage = 'Failed to delete user';
      if (axiosError.response?.data?.message) {
        const msg = axiosError.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join('. ') : msg;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      if (user.is_active) {
        await userClient.deactivate(user.id);
        setSuccess('User deactivated successfully');
      } else {
        await userClient.activate(user.id);
        setSuccess('User activated successfully');
      }
      fetchUsers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string | string[] } }; message?: string };
      let errorMessage = 'Failed to update user status';
      if (axiosError.response?.data?.message) {
        const msg = axiosError.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join('. ') : msg;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      setError(errorMessage);
    }
  };

  const handleOpenRoleModal = (user: User) => {
    setUserToChangeRole(user);
    setNewRole(user.role);
    setRoleModalOpen(true);
  };

  const handleCloseRoleModal = () => {
    setRoleModalOpen(false);
    setUserToChangeRole(null);
    setNewRole('');
  };

  const handleChangeRole = async () => {
    if (!userToChangeRole || !newRole) return;

    try {
      await userClient.updateRole(userToChangeRole.id, newRole);
      setSuccess('User role updated successfully');
      handleCloseRoleModal();
      fetchUsers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string | string[] } }; message?: string };
      let errorMessage = 'Failed to update user role';
      if (axiosError.response?.data?.message) {
        const msg = axiosError.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join('. ') : msg;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      setError(errorMessage);
    }
  };

  const columns: Column<User>[] = [
    {
      id: 'email',
      label: 'Email',
      minWidth: 200,
    },
    {
      id: 'first_name',
      label: 'Name',
      minWidth: 150,
      format: (_, row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || '-',
    },
    {
      id: 'department',
      label: 'Department',
      minWidth: 120,
      format: (value) => (value as string) || '-',
    },
    {
      id: 'role',
      label: 'Role',
      minWidth: 100,
      format: (value, row) => (
        <Chip
          label={(value as string).toUpperCase()}
          size="small"
          color={
            value === 'admin' ? 'error' : value === 'manager' ? 'warning' : 'default'
          }
          onClick={() => handleOpenRoleModal(row)}
          sx={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      id: 'is_active',
      label: 'Status',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value ? 'Active' : 'Inactive'}
          size="small"
          color={value ? 'success' : 'default'}
        />
      ),
    },
    {
      id: 'created_at',
      label: 'Created',
      minWidth: 120,
      format: (value) => new Date(value as string).toLocaleDateString(),
    },
  ];

  const rowActions = (row: User) => (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title="Edit">
        <IconButton size="small" onClick={() => handleOpenEditModal(row)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={row.is_active ? 'Deactivate' : 'Activate'}>
        <IconButton
          size="small"
          onClick={() => handleToggleActive(row)}
          color={row.is_active ? 'warning' : 'success'}
        >
          {row.is_active ? (
            <DeactivateIcon fontSize="small" />
          ) : (
            <ActivateIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
          size="small"
          color="error"
          onClick={() => handleOpenDeleteModal(row)}
          disabled={String(row.id) === String(currentUser?.id)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <Box>
      <AdminPageHeader
        title="User Management"
        subtitle="Manage users, roles, and permissions"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users' },
        ]}
        actions={
          <>
            <Button startIcon={<RefreshIcon />} onClick={fetchUsers}>
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateModal}
            >
              Add User
            </Button>
          </>
        }
      />

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

      <Box sx={{ mb: 2 }}>
        <TextField
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <AdminTable<User>
        columns={columns}
        data={users}
        loading={loading}
        error={null}
        rowKey="id"
        rowActions={rowActions}
        pagination={{
          page,
          rowsPerPage,
          total,
          onPageChange: setPage,
          onRowsPerPageChange: (newRowsPerPage) => {
            setRowsPerPage(newRowsPerPage);
            setPage(0);
          },
        }}
      />

      <AdminModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Create User'}
        subtitle={editingUser ? `Editing ${editingUser.email}` : 'Add a new user to the system'}
        primaryAction={{
          label: editingUser ? 'Update' : 'Create',
          onClick: handleSaveUser,
          loading: saving,
          disabled: saving,
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: handleCloseModal,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <AdminFormField
            name="email"
            label="Email"
            type="email"
            value={formData.email}
            onChange={handleFormChange}
            error={formErrors.email}
            required
            autoFocus
          />
          <AdminFormField
            name="password"
            label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={formData.password}
            onChange={handleFormChange}
            error={formErrors.password}
            required={!editingUser}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <AdminFormField
              name="firstName"
              label="First Name"
              value={formData.firstName}
              onChange={handleFormChange}
              error={formErrors.firstName}
              required
            />
            <AdminFormField
              name="lastName"
              label="Last Name"
              value={formData.lastName}
              onChange={handleFormChange}
              error={formErrors.lastName}
              required
            />
          </Box>
          <AdminFormField
            name="department"
            label="Department"
            value={formData.department}
            onChange={handleFormChange}
          />
          <AdminFormField
            name="role"
            label="Role"
            type="select"
            value={formData.role}
            onChange={handleFormChange}
            options={[
              { value: 'user', label: 'User' },
              { value: 'manager', label: 'Manager' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <AdminFormField
            name="isActive"
            label="Active"
            type="switch"
            value={formData.isActive}
            onChange={handleFormChange}
          />
        </Box>
      </AdminModal>

      <AdminModal
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        title="Delete User"
        subtitle={`Are you sure you want to delete ${userToDelete?.email}?`}
        primaryAction={{
          label: 'Delete',
          onClick: handleDeleteUser,
          loading: deleting,
          color: 'error',
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: handleCloseDeleteModal,
        }}
      >
        <Alert severity="warning">
          This action cannot be undone. The user will be permanently removed from the
          system.
        </Alert>
      </AdminModal>

      <AdminModal
        open={roleModalOpen}
        onClose={handleCloseRoleModal}
        title="Change User Role"
        subtitle={`Change role for ${userToChangeRole?.email}`}
        primaryAction={{
          label: 'Update Role',
          onClick: handleChangeRole,
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: handleCloseRoleModal,
        }}
      >
        <FormControl fullWidth>
          <InputLabel>Role</InputLabel>
          <Select
            value={newRole}
            label="Role"
            onChange={(e) => setNewRole(e.target.value)}
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>
      </AdminModal>
    </Box>
  );
};

export default AdminUsers;
