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
  Divider,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { FieldSchema } from '../../services/grcClient';

interface ColumnPickerDialogProps {
  open: boolean;
  onClose: () => void;
  fields: FieldSchema[];
  visibleColumns: string[];
  columnOrder: string[];
  onSave: (visibleColumns: string[], columnOrder: string[]) => void;
}

export function ColumnPickerDialog({
  open,
  onClose,
  fields,
  visibleColumns,
  columnOrder,
  onSave,
}: ColumnPickerDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(visibleColumns),
  );
  const [orderedColumns, setOrderedColumns] = useState<string[]>(columnOrder);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedColumns(new Set(visibleColumns));
      setOrderedColumns(columnOrder.length > 0 ? columnOrder : fields.map((f) => f.name));
    }
  }, [open, visibleColumns, columnOrder, fields]);

  const handleToggleColumn = useCallback((fieldName: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, fieldName: string) => {
      setDraggedItem(fieldName);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', fieldName);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetFieldName: string) => {
      e.preventDefault();
      if (!draggedItem || draggedItem === targetFieldName) {
        setDraggedItem(null);
        return;
      }

      setOrderedColumns((prev) => {
        const newOrder = [...prev];
        const draggedIndex = newOrder.indexOf(draggedItem);
        const targetIndex = newOrder.indexOf(targetFieldName);

        if (draggedIndex === -1 || targetIndex === -1) {
          return prev;
        }

        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);
        return newOrder;
      });

      setDraggedItem(null);
    },
    [draggedItem],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const handleSave = useCallback(() => {
    const visibleArray = orderedColumns.filter((col) => selectedColumns.has(col));
    onSave(visibleArray, orderedColumns);
    onClose();
  }, [orderedColumns, selectedColumns, onSave, onClose]);

  const handleSelectAll = useCallback(() => {
    setSelectedColumns(new Set(fields.map((f) => f.name)));
  }, [fields]);

  const handleSelectNone = useCallback(() => {
    setSelectedColumns(new Set());
  }, []);

  const handleResetToDefault = useCallback(() => {
    const defaultVisible = fields.filter((f) => f.defaultVisible).map((f) => f.name);
    setSelectedColumns(new Set(defaultVisible));
    setOrderedColumns(fields.map((f) => f.name));
  }, [fields]);

  const fieldMap = new Map(fields.map((f) => [f.name, f]));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Configure Columns</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Box>
            <Button size="small" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button size="small" onClick={handleSelectNone}>
              Select None
            </Button>
          </Box>
          <Button size="small" onClick={handleResetToDefault} color="secondary">
            Reset to Default
          </Button>
        </Box>
        <Typography variant="body2" color="textSecondary" mb={1}>
          Drag to reorder columns. Check/uncheck to show/hide.
        </Typography>
        <Divider />
        <List dense>
          {orderedColumns.map((fieldName) => {
            const field = fieldMap.get(fieldName);
            if (!field) return null;

            return (
              <ListItem
                key={fieldName}
                draggable
                onDragStart={(e) => handleDragStart(e, fieldName)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, fieldName)}
                onDragEnd={handleDragEnd}
                sx={{
                  cursor: 'grab',
                  bgcolor: draggedItem === fieldName ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  borderRadius: 1,
                  mb: 0.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <DragIcon color="action" />
                </ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selectedColumns.has(fieldName)}
                  onChange={() => handleToggleColumn(fieldName)}
                  tabIndex={-1}
                  disableRipple
                />
                <ListItemText
                  primary={field.label}
                  secondary={field.dataType}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={selectedColumns.size === 0}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ColumnPickerDialog;
