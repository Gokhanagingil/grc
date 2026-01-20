import React from 'react';
import { Box, Chip, Tooltip, Button } from '@mui/material';
import { Warning as WarningIcon, Save as SaveIcon, Undo as UndoIcon } from '@mui/icons-material';

export interface DirtyStateIndicatorProps {
  isDirty: boolean;
  changedFields?: string[];
  onSave?: () => void;
  onDiscard?: () => void;
  saving?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * Visual indicator for unsaved changes in forms
 * Shows a warning chip when there are unsaved changes
 * Optionally shows Save/Discard buttons
 */
export const DirtyStateIndicator: React.FC<DirtyStateIndicatorProps> = ({
  isDirty,
  changedFields = [],
  onSave,
  onDiscard,
  saving = false,
  showActions = true,
  compact = false,
}) => {
  if (!isDirty) {
    return null;
  }

  const tooltipContent = changedFields.length > 0
    ? `Unsaved changes in: ${changedFields.join(', ')}`
    : 'You have unsaved changes';

  if (compact) {
    return (
      <Tooltip title={tooltipContent}>
        <Chip
          icon={<WarningIcon />}
          label="Unsaved"
          color="warning"
          size="small"
          sx={{ ml: 1 }}
        />
      </Tooltip>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        px: 2,
        backgroundColor: 'warning.light',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'warning.main',
      }}
    >
      <WarningIcon color="warning" fontSize="small" />
      <Tooltip title={tooltipContent}>
        <Box component="span" sx={{ fontSize: '0.875rem', color: 'warning.dark' }}>
          You have unsaved changes
          {changedFields.length > 0 && ` (${changedFields.length} field${changedFields.length > 1 ? 's' : ''})`}
        </Box>
      </Tooltip>
      {showActions && (
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          {onDiscard && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<UndoIcon />}
              onClick={onDiscard}
              disabled={saving}
            >
              Discard
            </Button>
          )}
          {onSave && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<SaveIcon />}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default DirtyStateIndicator;
