/**
 * LinkRecordDialog — reusable search/select dialog for linking
 * GRC records (Risks, Controls) to ITSM entities (Changes, Incidents).
 *
 * Created for: Activation Stabilization Pack v3 — Workstream D
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Typography,
  Alert,
  Box,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

export interface LinkableRecord {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  status?: string;
}

interface LinkRecordDialogProps {
  open: boolean;
  onClose: () => void;
  onLink: (recordId: string) => Promise<void>;
  /** Function to fetch available records. Should return array of LinkableRecord. */
  fetchRecords: (search?: string) => Promise<LinkableRecord[]>;
  /** Dialog title, e.g. "Link Risk" or "Link Control" */
  title: string;
  /** IDs of already-linked records to exclude from selection */
  alreadyLinkedIds?: Set<string>;
}

export const LinkRecordDialog: React.FC<LinkRecordDialogProps> = ({
  open,
  onClose,
  onLink,
  fetchRecords,
  title,
  alreadyLinkedIds,
}) => {
  const [records, setRecords] = useState<LinkableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchRecords(search || undefined);
      setRecords(items);
    } catch (err) {
      console.error('[LinkRecordDialog] fetch error:', err);
      setError('Failed to load records. Please try again.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fetchRecords, search]);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setError(null);
      loadRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      loadRecords();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleLink = async () => {
    if (!selectedId) return;
    setLinking(true);
    setError(null);
    try {
      await onLink(selectedId);
      onClose();
    } catch (err) {
      console.error('[LinkRecordDialog] link error:', err);
      setError('Failed to link record. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  const filteredRecords = alreadyLinkedIds
    ? records.filter((r) => !alreadyLinkedIds.has(r.id))
    : records;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="link-record-dialog">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          data-testid="link-record-search"
        />

        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : filteredRecords.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            {search ? 'No matching records found' : 'No available records to link'}
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 320, overflow: 'auto' }} data-testid="link-record-list">
            {filteredRecords.map((record) => (
              <ListItem key={record.id} disablePadding>
                <ListItemButton
                  selected={selectedId === record.id}
                  onClick={() => setSelectedId(record.id)}
                  data-testid={`link-record-item-${record.id}`}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {record.code && (
                          <Chip label={record.code} size="small" variant="outlined" />
                        )}
                        <Typography variant="body2">
                          {record.name || record.title || record.id}
                        </Typography>
                      </Box>
                    }
                    secondary={record.status ? `Status: ${record.status}` : undefined}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={linking}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleLink}
          disabled={!selectedId || linking}
          data-testid="link-record-confirm-btn"
        >
          {linking ? 'Linking...' : 'Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkRecordDialog;
