import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import {
  listViewApi,
  ListViewData,
  ListViewColumnData,
} from '../../services/grcClient';

interface ColumnConfig {
  columnName: string;
  label: string;
  visible: boolean;
  orderIndex: number;
}

interface ColumnManagementModalProps {
  open: boolean;
  onClose: () => void;
  tableName: string;
  availableColumns: Array<{ name: string; label: string }>;
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export const ColumnManagementModal: React.FC<ColumnManagementModalProps> = ({
  open,
  onClose,
  tableName,
  availableColumns,
  onColumnsChange,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ListViewData | null>(null);

  const loadListView = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listViewApi.list(tenantId, tableName);
      const defaultView = response.defaultView;

      if (defaultView && defaultView.columns.length > 0) {
        setCurrentView(defaultView);
        const viewColumns = defaultView.columns.map((col: ListViewColumnData) => ({
          columnName: col.columnName,
          label: availableColumns.find((c) => c.name === col.columnName)?.label || col.columnName,
          visible: col.visible,
          orderIndex: col.orderIndex,
        }));

        const missingColumns = availableColumns
          .filter((ac) => !viewColumns.find((vc: ColumnConfig) => vc.columnName === ac.name))
          .map((ac, index) => ({
            columnName: ac.name,
            label: ac.label,
            visible: false,
            orderIndex: viewColumns.length + index,
          }));

        setColumns([...viewColumns, ...missingColumns].sort((a, b) => a.orderIndex - b.orderIndex));
      } else {
        setCurrentView(null);
        setColumns(
          availableColumns.map((col, index) => ({
            columnName: col.name,
            label: col.label,
            visible: true,
            orderIndex: index,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load list view:', err);
      setColumns(
        availableColumns.map((col, index) => ({
          columnName: col.name,
          label: col.label,
          visible: true,
          orderIndex: index,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, tableName, availableColumns]);

  useEffect(() => {
    if (open && tenantId) {
      loadListView();
    }
  }, [open, tenantId, loadListView]);

  const handleToggleColumn = (columnName: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.columnName === columnName ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setColumns((prev) => {
      const newColumns = [...prev];
      [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
      return newColumns.map((col, i) => ({ ...col, orderIndex: i }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === columns.length - 1) return;
    setColumns((prev) => {
      const newColumns = [...prev];
      [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
      return newColumns.map((col, i) => ({ ...col, orderIndex: i }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const columnsData = columns.map((col, index) => ({
        columnName: col.columnName,
        orderIndex: index,
        visible: col.visible,
      }));

      if (currentView) {
        await listViewApi.updateColumns(tenantId, currentView.id, { columns: columnsData });
      } else {
        const newView = await listViewApi.create(tenantId, {
          tableName,
          name: 'Default View',
          scope: 'user',
          isDefault: true,
          columns: columnsData,
        });
        setCurrentView(newView);
      }

      onColumnsChange(columns);
      onClose();
    } catch (err) {
      console.error('Failed to save column configuration:', err);
      setError('Failed to save column configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setColumns(
      availableColumns.map((col, index) => ({
        columnName: col.name,
        label: col.label,
        visible: true,
        orderIndex: index,
      }))
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <SettingsIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Manage Columns</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Check columns to show them in the table. Drag to reorder.
            </Typography>
            <List dense>
              {columns.map((column, index) => (
                <ListItem
                  key={column.columnName}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 0.5,
                    backgroundColor: column.visible ? 'background.paper' : 'action.disabledBackground',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                    >
                      <DragIcon fontSize="small" />
                    </IconButton>
                  </ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={column.visible}
                    onChange={() => handleToggleColumn(column.columnName)}
                    tabIndex={-1}
                  />
                  <ListItemText
                    primary={column.label}
                    secondary={column.columnName}
                    primaryTypographyProps={{
                      style: { opacity: column.visible ? 1 : 0.5 },
                    }}
                  />
                  <Box>
                    <Button
                      size="small"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                    >
                      Up
                    </Button>
                    <Button
                      size="small"
                      disabled={index === columns.length - 1}
                      onClick={() => handleMoveDown(index)}
                    >
                      Down
                    </Button>
                  </Box>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} disabled={saving}>
          Reset to Default
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ColumnManagementModal;
