import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
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
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Label as TagIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { metadataApi, unwrapResponse, unwrapPaginatedResponse } from '../../services/grcClient';
import { useAuth } from '../../contexts/AuthContext';

interface FieldMetadata {
  id: string;
  tableName: string;
  fieldName: string;
  label: string;
  description: string;
  tags: ClassificationTag[];
}

interface ClassificationTag {
  id: string;
  name: string;
  tagType: 'privacy' | 'security' | 'compliance';
  description?: string;
  color?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const getTagTypeColor = (tagType: string) => {
  switch (tagType) {
    case 'privacy':
      return 'primary';
    case 'security':
      return 'error';
    case 'compliance':
      return 'success';
    default:
      return 'default';
  }
};

export const AdminMetadata: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [fields, setFields] = useState<FieldMetadata[]>([]);
  const [tags, setTags] = useState<ClassificationTag[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [openFieldDialog, setOpenFieldDialog] = useState(false);
  const [openTagDialog, setOpenTagDialog] = useState(false);
  const [openAssignTagDialog, setOpenAssignTagDialog] = useState(false);
  const [editingField, setEditingField] = useState<FieldMetadata | null>(null);
  const [editingTag, setEditingTag] = useState<ClassificationTag | null>(null);
  const [selectedFieldForTags, setSelectedFieldForTags] = useState<FieldMetadata | null>(null);

  const [fieldFormData, setFieldFormData] = useState({
    tableName: '',
    fieldName: '',
    label: '',
    description: '',
  });

  const [tagFormData, setTagFormData] = useState({
    name: '',
    tagType: 'privacy' as 'privacy' | 'security' | 'compliance',
    description: '',
    color: '#1976d2',
  });

  const [selectedTagsToAssign, setSelectedTagsToAssign] = useState<ClassificationTag[]>([]);

  const tenantId = user?.tenantId || '';

  useEffect(() => {
    if (tenantId) {
      fetchFields();
      fetchTags();
      fetchTables();
    }
  }, [tenantId]);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const response = await metadataApi.fields.list(tenantId);
      const result = unwrapPaginatedResponse<FieldMetadata>(response);
      setFields(result.items || []);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status !== 404) {
        setError(error.response?.data?.message || 'Failed to fetch field metadata');
      }
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await metadataApi.tags.list(tenantId);
      const result = unwrapPaginatedResponse<ClassificationTag>(response);
      setTags(result.items || []);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status !== 404) {
        console.error('Failed to fetch tags:', error);
      }
      setTags([]);
    }
  };

  const fetchTables = async () => {
    try {
      const response = await metadataApi.fields.getTables(tenantId);
      const result = unwrapResponse<string[]>(response);
      setTables(result || []);
    } catch (err) {
      setTables([]);
    }
  };

  const handleSeedDefaultTags = async () => {
    try {
      setLoading(true);
      await metadataApi.seed(tenantId);
      setSuccess('Default tags seeded successfully');
      fetchTags();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to seed default tags');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFieldDialog = (field?: FieldMetadata) => {
    if (field) {
      setEditingField(field);
      setFieldFormData({
        tableName: field.tableName,
        fieldName: field.fieldName,
        label: field.label,
        description: field.description || '',
      });
    } else {
      setEditingField(null);
      setFieldFormData({
        tableName: '',
        fieldName: '',
        label: '',
        description: '',
      });
    }
    setOpenFieldDialog(true);
  };

  const handleSaveField = async () => {
    try {
      if (editingField) {
        await metadataApi.fields.update(tenantId, editingField.id, fieldFormData);
        setSuccess('Field metadata updated successfully');
      } else {
        await metadataApi.fields.create(tenantId, fieldFormData);
        setSuccess('Field metadata created successfully');
      }
      setOpenFieldDialog(false);
      fetchFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save field metadata');
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this field metadata?')) return;
    try {
      await metadataApi.fields.delete(tenantId, id);
      setSuccess('Field metadata deleted successfully');
      fetchFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to delete field metadata');
    }
  };

  const handleOpenTagDialog = (tag?: ClassificationTag) => {
    if (tag) {
      setEditingTag(tag);
      setTagFormData({
        name: tag.name,
        tagType: tag.tagType,
        description: tag.description || '',
        color: tag.color || '#1976d2',
      });
    } else {
      setEditingTag(null);
      setTagFormData({
        name: '',
        tagType: 'privacy',
        description: '',
        color: '#1976d2',
      });
    }
    setOpenTagDialog(true);
  };

  const handleSaveTag = async () => {
    try {
      if (editingTag) {
        await metadataApi.tags.update(tenantId, editingTag.id, tagFormData);
        setSuccess('Tag updated successfully');
      } else {
        await metadataApi.tags.create(tenantId, tagFormData);
        setSuccess('Tag created successfully');
      }
      setOpenTagDialog(false);
      fetchTags();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save tag');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    try {
      await metadataApi.tags.delete(tenantId, id);
      setSuccess('Tag deleted successfully');
      fetchTags();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to delete tag');
    }
  };

  const handleOpenAssignTagDialog = (field: FieldMetadata) => {
    setSelectedFieldForTags(field);
    setSelectedTagsToAssign(field.tags || []);
    setOpenAssignTagDialog(true);
  };

  const handleAssignTags = async () => {
    if (!selectedFieldForTags) return;

    try {
      const currentTagIds = (selectedFieldForTags.tags || []).map((t) => t.id);
      const newTagIds = selectedTagsToAssign.map((t) => t.id);

      const tagsToAdd = newTagIds.filter((id) => !currentTagIds.includes(id));
      const tagsToRemove = currentTagIds.filter((id) => !newTagIds.includes(id));

      for (const tagId of tagsToAdd) {
        await metadataApi.fields.assignTag(tenantId, selectedFieldForTags.id, tagId);
      }

      for (const tagId of tagsToRemove) {
        await metadataApi.fields.removeTag(tenantId, selectedFieldForTags.id, tagId);
      }

      setSuccess('Tags updated successfully');
      setOpenAssignTagDialog(false);
      fetchFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update tags');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Metadata Management</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Field Metadata" />
          <Tab label="Classification Tags" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Field Dictionary</Typography>
            <Box>
              <Button
                startIcon={<RefreshIcon />}
                onClick={fetchFields}
                sx={{ mr: 1 }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenFieldDialog()}
              >
                Add Field
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : fields.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary">
                No field metadata found. Add fields to start classifying your data.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Table</TableCell>
                  <TableCell>Field</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>{field.tableName}</TableCell>
                    <TableCell>{field.fieldName}</TableCell>
                    <TableCell>{field.label}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {field.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {(field.tags || []).map((tag) => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            color={getTagTypeColor(tag.tagType) as 'primary' | 'error' | 'success' | 'default'}
                          />
                        ))}
                        {(!field.tags || field.tags.length === 0) && (
                          <Typography variant="body2" color="textSecondary">
                            No tags
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenAssignTagDialog(field)}
                        title="Manage Tags"
                      >
                        <TagIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenFieldDialog(field)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteField(field.id)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Classification Tags</Typography>
            <Box>
              <Button
                startIcon={<RefreshIcon />}
                onClick={fetchTags}
                sx={{ mr: 1 }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                onClick={handleSeedDefaultTags}
                sx={{ mr: 1 }}
                disabled={loading}
              >
                Seed Defaults
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenTagDialog()}
              >
                Add Tag
              </Button>
            </Box>
          </Box>

          {tags.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary" gutterBottom>
                No classification tags found.
              </Typography>
              <Button variant="outlined" onClick={handleSeedDefaultTags} disabled={loading}>
                Seed Default Tags
              </Button>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Chip
                        label={tag.name}
                        size="small"
                        color={getTagTypeColor(tag.tagType) as 'primary' | 'error' | 'success' | 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {tag.tagType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {tag.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenTagDialog(tag)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteTag(tag.id)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </Paper>

      <Dialog open={openFieldDialog} onClose={() => setOpenFieldDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingField ? 'Edit Field Metadata' : 'Add Field Metadata'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              freeSolo
              options={tables}
              value={fieldFormData.tableName}
              onInputChange={(_, value) => setFieldFormData({ ...fieldFormData, tableName: value })}
              renderInput={(params) => (
                <TextField {...params} label="Table Name" required fullWidth />
              )}
            />
            <TextField
              fullWidth
              label="Field Name"
              value={fieldFormData.fieldName}
              onChange={(e) => setFieldFormData({ ...fieldFormData, fieldName: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Label"
              value={fieldFormData.label}
              onChange={(e) => setFieldFormData({ ...fieldFormData, label: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={fieldFormData.description}
              onChange={(e) => setFieldFormData({ ...fieldFormData, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFieldDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveField}
            variant="contained"
            disabled={!fieldFormData.tableName || !fieldFormData.fieldName || !fieldFormData.label}
          >
            {editingField ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openTagDialog} onClose={() => setOpenTagDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTag ? 'Edit Tag' : 'Add Tag'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Tag Name"
              value={tagFormData.name}
              onChange={(e) => setTagFormData({ ...tagFormData, name: e.target.value })}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Tag Type</InputLabel>
              <Select
                value={tagFormData.tagType}
                label="Tag Type"
                onChange={(e) =>
                  setTagFormData({
                    ...tagFormData,
                    tagType: e.target.value as 'privacy' | 'security' | 'compliance',
                  })
                }
              >
                <MenuItem value="privacy">Privacy</MenuItem>
                <MenuItem value="security">Security</MenuItem>
                <MenuItem value="compliance">Compliance</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={tagFormData.description}
              onChange={(e) => setTagFormData({ ...tagFormData, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTagDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveTag}
            variant="contained"
            disabled={!tagFormData.name}
          >
            {editingTag ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openAssignTagDialog}
        onClose={() => setOpenAssignTagDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Manage Tags for {selectedFieldForTags?.tableName}.{selectedFieldForTags?.fieldName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              multiple
              options={tags}
              value={selectedTagsToAssign}
              onChange={(_, value) => setSelectedTagsToAssign(value)}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label="Select Tags" placeholder="Add tags..." />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.name}
                    size="small"
                    color={getTagTypeColor(option.tagType) as 'primary' | 'error' | 'success' | 'default'}
                  />
                ))
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignTagDialog(false)}>Cancel</Button>
          <Button onClick={handleAssignTags} variant="contained">
            Save Tags
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminMetadata;
