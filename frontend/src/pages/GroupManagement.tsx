import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { api } from '../services/api';
import { LoadingState, ErrorState, EmptyState, ResponsiveTable } from '../components/common';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Group {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface UserOption {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Group CRUD dialog
  const [openGroupDialog, setOpenGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });

  // Members dialog
  const [openMembersDialog, setOpenMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Add member
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  /* ---- Groups CRUD ---- */

  const fetchGroups = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/grc/groups');
      const data = res.data?.data || res.data;
      const items = data.items || data || [];
      setGroups(Array.isArray(items) ? items : []);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e.response?.status === 403) {
        setError('You do not have permission to manage groups.');
      } else {
        setError('Failed to load groups.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', description: '' });
    setOpenGroupDialog(true);
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupForm({ name: group.name, description: group.description || '' });
    setOpenGroupDialog(true);
  };

  const handleSaveGroup = async () => {
    try {
      if (editingGroup) {
        await api.put(`/grc/groups/${editingGroup.id}`, groupForm);
      } else {
        await api.post('/grc/groups', groupForm);
      }
      setOpenGroupDialog(false);
      fetchGroups();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to save group');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        await api.delete(`/grc/groups/${id}`);
        fetchGroups();
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message || 'Failed to delete group');
      }
    }
  };

  /* ---- Members ---- */

  const handleOpenMembers = async (group: Group) => {
    setSelectedGroup(group);
    setOpenMembersDialog(true);
    setMembersLoading(true);
    try {
      const res = await api.get(`/grc/groups/${group.id}/members`);
      const data = res.data?.data || res.data;
      const items = data.items || data || [];
      setMembers(Array.isArray(items) ? items : []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUser) return;
    try {
      await api.post(`/grc/groups/${selectedGroup.id}/members`, {
        userId: selectedUser.id,
      });
      setSelectedUser(null);
      // Reload members
      const res = await api.get(`/grc/groups/${selectedGroup.id}/members`);
      const data = res.data?.data || res.data;
      const items = data.items || data || [];
      setMembers(Array.isArray(items) ? items : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await api.delete(`/grc/groups/${selectedGroup.id}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to remove member');
    }
  };

  /* ---- User search ---- */

  useEffect(() => {
    if (userSearch.length < 2) {
      setUsers([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setUsersLoading(true);
      try {
        const res = await api.get('/users', { params: { search: userSearch, limit: 10 } });
        const data = res.data?.data || res.data;
        const items = data.items || data.users || data || [];
        setUsers(Array.isArray(items) ? items : []);
      } catch {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearch]);

  /* ---- Render ---- */

  if (loading) {
    return <LoadingState message="Loading groups..." />;
  }

  if (error && groups.length === 0) {
    return (
      <ErrorState
        title="Failed to load groups"
        message={error}
        onRetry={fetchGroups}
      />
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Group Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateGroup}>
          New Group
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card>
        <CardContent>
          <ResponsiveTable minWidth={600}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 0, border: 'none' }}>
                      <EmptyState
                        icon={<GroupIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                        title="No groups found"
                        message="Create your first group to manage team-based assignments."
                        actionLabel="New Group"
                        onAction={handleCreateGroup}
                        minHeight="200px"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <Typography variant="subtitle2">{group.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                          {group.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={group.isActive ? 'Active' : 'Inactive'}
                          color={group.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(group.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Manage Members">
                          <IconButton size="small" onClick={() => handleOpenMembers(group)}>
                            <PersonAddIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Group">
                          <IconButton size="small" onClick={() => handleEditGroup(group)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Group">
                          <IconButton size="small" onClick={() => handleDeleteGroup(group.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>

      {/* Group Create/Edit Dialog */}
      <Dialog open={openGroupDialog} onClose={() => setOpenGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Group Name"
            value={groupForm.name}
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            required
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={groupForm.description}
            onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
            multiline
            rows={3}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGroupDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveGroup} variant="contained" disabled={!groupForm.name.trim()}>
            {editingGroup ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={openMembersDialog} onClose={() => setOpenMembersDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Members of &quot;{selectedGroup?.name}&quot;
        </DialogTitle>
        <DialogContent>
          {/* Add Member Section */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={users}
              loading={usersLoading}
              getOptionLabel={(opt) =>
                `${opt.first_name || ''} ${opt.last_name || ''} (${opt.username || opt.email})`.trim()
              }
              value={selectedUser}
              onChange={(_e, val) => setSelectedUser(val)}
              onInputChange={(_e, val) => setUserSearch(val)}
              renderInput={(params) => (
                <TextField {...params} label="Search users..." size="small" />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              noOptionsText={userSearch.length < 2 ? 'Type to search...' : 'No users found'}
            />
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={handleAddMember}
              disabled={!selectedUser}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Add
            </Button>
          </Box>

          <Divider />

          {/* Members List */}
          {membersLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : members.length === 0 ? (
            <Box py={3} textAlign="center">
              <Typography color="text.secondary">No members yet</Typography>
            </Box>
          ) : (
            <List>
              {members.map((member) => (
                <ListItem key={member.id} divider>
                  <ListItemText
                    primary={
                      member.user
                        ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || member.user.email
                        : member.userId
                    }
                    secondary={member.user ? `${member.user.email} (${member.userId.slice(0, 8)}…)` : `User ID: ${member.userId}`}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Remove member">
                      <IconButton edge="end" onClick={() => handleRemoveMember(member.userId)}>
                        <PersonRemoveIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMembersDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GroupManagement;
