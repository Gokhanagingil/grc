import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { itsmApi, ItsmJournalEntryData, ItsmJournalType } from '../../services/grcClient';
import { useNotification } from '../../contexts/NotificationContext';

type JournalListContract = {
  items: ItsmJournalEntryData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export interface ActivityStreamProps {
  table: string;
  recordId: string;
}

export const ActivityStream: React.FC<ActivityStreamProps> = ({ table, recordId }) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [type, setType] = useState<ItsmJournalType>('work_note');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<ItsmJournalEntryData[]>([]);

  const canPost = useMemo(() => message.trim().length > 0 && !posting, [message, posting]);

  const fetchItems = useCallback(async () => {
    if (!recordId) return;

    setLoading(true);
    try {
      const resp = await itsmApi.journal.list(table, recordId, {
        page: 1,
        pageSize: 50,
        type,
        sortOrder: 'DESC',
      });

      const payload = resp.data as unknown;
      if (
        payload &&
        typeof payload === 'object' &&
        'data' in payload &&
        (payload as { data?: unknown }).data &&
        typeof (payload as { data?: unknown }).data === 'object'
      ) {
        const data = (payload as { data: JournalListContract }).data;
        setItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('Error fetching journal entries:', e);
      showNotification('Failed to load activity stream', 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [recordId, showNotification, table, type]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handlePost = async () => {
    if (!canPost) return;

    setPosting(true);
    try {
      await itsmApi.journal.create(table, recordId, {
        type,
        message: message.trim(),
      });
      setMessage('');
      showNotification('Posted', 'success');
      await fetchItems();
    } catch (e) {
      console.error('Error posting journal entry:', e);
      showNotification('Failed to post', 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card data-testid="activity-stream">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Activity
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={(_, v) => {
              if (v) setType(v);
            }}
            size="small"
          >
            <ToggleButton value="work_note" data-testid="journal-type-work_note">
              Work notes
            </ToggleButton>
            <ToggleButton value="comment" data-testid="journal-type-comment">
              Comments
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={10}
            label={type === 'work_note' ? 'Add work note' : 'Add comment'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            inputProps={{ 'data-testid': 'journal-message' }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button
              variant="contained"
              onClick={handlePost}
              disabled={!canPost}
              data-testid="journal-post"
            >
              {posting ? 'Posting...' : 'Post'}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" data-testid="journal-empty">
            No entries yet
          </Typography>
        ) : (
          <List dense>
            {items.map((it) => (
              <ListItem key={it.id} alignItems="flex-start" data-testid="journal-entry">
                <ListItemText
                  primary={new Date(it.createdAt).toLocaleString()}
                  secondary={it.message}
                  secondaryTypographyProps={{ sx: { whiteSpace: 'pre-wrap' } }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityStream;
