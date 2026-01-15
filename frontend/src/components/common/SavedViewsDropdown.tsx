/**
 * SavedViewsDropdown Component
 *
 * A dropdown component for managing saved list views.
 * Provides functionality to:
 * - Load and display available views for a table
 * - Apply a saved view (columns + default sort + default filter)
 * - Save current view configuration
 * - Delete saved views
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ViewList as ViewIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { listViewApi, ListViewData, CreateListViewDto } from '../../services/grcClient';
import { useAuth } from '../../contexts/AuthContext';

export interface SavedViewsDropdownProps {
  tableName: string;
  currentColumns?: Array<{
    columnName: string;
    orderIndex: number;
    visible?: boolean;
    width?: number;
  }>;
  currentSort?: string;
  currentFilter?: string;
  onViewApply?: (view: ListViewData) => void;
  disabled?: boolean;
}

export const SavedViewsDropdown: React.FC<SavedViewsDropdownProps> = ({
  tableName,
  currentColumns,
  currentSort,
  currentFilter,
  onViewApply,
  disabled = false,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [views, setViews] = useState<ListViewData[]>([]);
  const [defaultView, setDefaultView] = useState<ListViewData | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = Boolean(anchorEl);

  const fetchViews = useCallback(async () => {
    if (!tenantId || !tableName) return;

    setLoading(true);
    setError(null);

    try {
      const result = await listViewApi.list(tenantId, tableName);
      setViews(result.views || []);
      setDefaultView(result.defaultView || null);
    } catch (err) {
      console.error('Failed to fetch views:', err);
      setError('Failed to load saved views');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tableName]);

  useEffect(() => {
    if (open) {
      fetchViews();
    }
  }, [open, fetchViews]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleViewSelect = (view: ListViewData) => {
    setActiveViewId(view.id);
    if (onViewApply) {
      onViewApply(view);
    }
    handleClose();
  };

  const handleSaveClick = () => {
    setSaveName('');
    setSaveAsDefault(false);
    setSaveDialogOpen(true);
    handleClose();
  };

  const handleSaveDialogClose = () => {
    setSaveDialogOpen(false);
    setSaveName('');
    setSaveAsDefault(false);
  };

  const handleSaveView = async () => {
    if (!tenantId || !saveName.trim()) return;

    setSaving(true);

    try {
      const dto: CreateListViewDto = {
        tableName,
        name: saveName.trim(),
        scope: 'user',
        isDefault: saveAsDefault,
        columns: currentColumns?.map((col, index) => ({
          columnName: col.columnName,
          orderIndex: col.orderIndex ?? index,
          visible: col.visible ?? true,
          width: col.width,
        })),
      };

      const newView = await listViewApi.create(tenantId, dto);
      setViews(prev => [...prev, newView]);
      if (saveAsDefault) {
        setDefaultView(newView);
      }
      setActiveViewId(newView.id);
      handleSaveDialogClose();
    } catch (err) {
      console.error('Failed to save view:', err);
      setError('Failed to save view');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteView = async (viewId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!tenantId) return;

    try {
      await listViewApi.delete(tenantId, viewId);
      setViews(prev => prev.filter(v => v.id !== viewId));
      if (defaultView?.id === viewId) {
        setDefaultView(null);
      }
      if (activeViewId === viewId) {
        setActiveViewId(null);
      }
    } catch (err) {
      console.error('Failed to delete view:', err);
      setError('Failed to delete view');
    }
  };

  const handleSetDefault = async (viewId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!tenantId) return;

    try {
      const updatedView = await listViewApi.update(tenantId, viewId, { isDefault: true });
      setViews(prev => prev.map(v => ({
        ...v,
        isDefault: v.id === viewId,
      })));
      setDefaultView(updatedView);
    } catch (err) {
      console.error('Failed to set default view:', err);
      setError('Failed to set default view');
    }
  };

  const activeView = views.find(v => v.id === activeViewId);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={handleClick}
        disabled={disabled || !tenantId}
        endIcon={<ExpandMoreIcon />}
        startIcon={<ViewIcon />}
      >
        {activeView ? activeView.name : 'Views'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 250, maxWidth: 350 },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <MenuItem disabled>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </MenuItem>
        ) : (
          <>
            {views.length === 0 ? (
              <MenuItem disabled>
                <Typography color="text.secondary" variant="body2">
                  No saved views
                </Typography>
              </MenuItem>
            ) : (
              views.map((view) => (
                <MenuItem
                  key={view.id}
                  onClick={() => handleViewSelect(view)}
                  selected={activeViewId === view.id}
                >
                  <ListItemIcon>
                    {activeViewId === view.id ? (
                      <CheckIcon fontSize="small" color="primary" />
                    ) : view.isDefault ? (
                      <StarIcon fontSize="small" color="warning" />
                    ) : null}
                  </ListItemIcon>
                  <ListItemText
                    primary={view.name}
                    secondary={view.scope === 'user' ? 'Personal' : view.scope}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!view.isDefault && (
                      <Tooltip title="Set as default">
                        <IconButton
                          size="small"
                          onClick={(e) => handleSetDefault(view.id, e)}
                        >
                          <StarBorderIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {view.scope === 'user' && (
                      <Tooltip title="Delete view">
                        <IconButton
                          size="small"
                          onClick={(e) => handleDeleteView(view.id, e)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </MenuItem>
              ))
            )}

            <Divider />

            <MenuItem onClick={handleSaveClick}>
              <ListItemIcon>
                <SaveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save current view..." />
            </MenuItem>
          </>
        )}
      </Menu>

      <Dialog open={saveDialogOpen} onClose={handleSaveDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>Save View</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="View Name"
            fullWidth
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="My Custom View"
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant={saveAsDefault ? 'contained' : 'outlined'}
              size="small"
              startIcon={saveAsDefault ? <StarIcon /> : <StarBorderIcon />}
              onClick={() => setSaveAsDefault(!saveAsDefault)}
            >
              {saveAsDefault ? 'Default View' : 'Set as Default'}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSaveDialogClose}>Cancel</Button>
          <Button
            onClick={handleSaveView}
            variant="contained"
            disabled={!saveName.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SavedViewsDropdown;
