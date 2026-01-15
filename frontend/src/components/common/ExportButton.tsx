import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { exportApi, ExportRequestDto } from '../../services/grcClient';

interface ExportButtonProps {
  tableName: string;
  viewId?: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  search?: string;
  sort?: { field: string; order: 'ASC' | 'DESC' };
  disabled?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  tableName,
  viewId,
  columns,
  filters,
  search,
  sort,
  disabled = false,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!tenantId) return;

    setExporting(true);
    handleClose();

    try {
      const exportRequest: ExportRequestDto = {
        tableName,
        format,
      };

      if (viewId) {
        exportRequest.viewId = viewId;
      }
      if (columns && columns.length > 0) {
        exportRequest.columns = columns;
      }
      if (filters && Object.keys(filters).length > 0) {
        exportRequest.filters = filters;
      }
      if (search) {
        exportRequest.search = search;
      }
      if (sort) {
        exportRequest.sort = sort;
      }

      const blob = await exportApi.export(tenantId, exportRequest);

      const now = new Date();
      const timestamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12);
      const filename = `${tableName}_${timestamp}.${format}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={exporting ? <CircularProgress size={16} /> : <ExportIcon />}
        onClick={handleClick}
        disabled={disabled || exporting || !tenantId}
      >
        {exporting ? 'Exporting...' : 'Export'}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={() => handleExport('csv')}>
          <ListItemIcon>
            <CsvIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as CSV</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportButton;
