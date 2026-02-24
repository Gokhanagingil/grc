import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { itsmApi, cmdbApi, ItsmChangeCiLinkData, ensureArray } from '../../services/grcClient';

interface ChangeAffectedCisSectionProps {
  changeId: string;
  showNotification: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
}

const RELATIONSHIP_TYPES = ['PRIMARY', 'AFFECTED', 'RELATED'];

interface CiOption {
  id: string;
  name: string;
  className?: string;
}

export const ChangeAffectedCisSection: React.FC<ChangeAffectedCisSectionProps> = ({
  changeId,
  showNotification,
}) => {
  const [links, setLinks] = useState<ItsmChangeCiLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [ciSearch, setCiSearch] = useState('');
  const [ciOptions, setCiOptions] = useState<CiOption[]>([]);
  const [selectedCiId, setSelectedCiId] = useState('');
  const [relationshipType, setRelationshipType] = useState('AFFECTED');
  const [searching, setSearching] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await itsmApi.changes.listAffectedCis(changeId, { pageSize: 100 });
      const data = res.data as Record<string, unknown>;
      // Normalize envelope: { success, data: { items } } or { data: { items } } or { items }
      const inner = data?.data as Record<string, unknown> | undefined;
      const items = ensureArray(
        inner?.items ?? inner?.data ?? (Array.isArray(data?.items) ? data.items : [])
      ) as ItsmChangeCiLinkData[];
      setLinks(items);
    } catch (err) {
      console.error('[ChangeAffectedCis] Failed to load:', err);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [changeId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleSearchCis = useCallback(async () => {
    if (!ciSearch.trim()) return;
    try {
      setSearching(true);
      const res = await cmdbApi.cis.list({ q: ciSearch, pageSize: 20 });
      const data = res.data as Record<string, unknown>;
      const inner = data?.data as Record<string, unknown> | undefined;
      const items = ensureArray(
        inner?.items ?? (Array.isArray(data?.items) ? data.items : [])
      ) as CiOption[];
      setCiOptions(items.map((ci) => ({
        id: (ci as unknown as Record<string, unknown>).id as string,
        name: (ci as unknown as Record<string, unknown>).name as string,
        className: ((ci as unknown as Record<string, unknown>).ciClass as Record<string, unknown>)?.name as string || 'Unknown',
      })));
    } catch {
      setCiOptions([]);
    } finally {
      setSearching(false);
    }
  }, [ciSearch]);

  const handleAdd = async () => {
    if (!selectedCiId || !relationshipType) {
      showNotification('Please select a CI and relationship type', 'warning');
      return;
    }
    try {
      setAdding(true);
      await itsmApi.changes.addAffectedCi(changeId, {
        ciId: selectedCiId,
        relationshipType,
      });
      showNotification('CI linked successfully', 'success');
      setShowAddForm(false);
      setSelectedCiId('');
      setCiSearch('');
      setCiOptions([]);
      await fetchLinks();
    } catch (err) {
      console.error('[ChangeAffectedCis] Failed to add:', err);
      showNotification('Failed to link CI', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (linkId: string) => {
    try {
      await itsmApi.changes.removeAffectedCi(changeId, linkId);
      showNotification('CI unlinked successfully', 'success');
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error('[ChangeAffectedCis] Failed to remove:', err);
      showNotification('Failed to unlink CI', 'error');
    }
  };

  return (
    <Card sx={{ mt: 3 }} data-testid="change-affected-cis-section">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            Affected CIs ({links.length})
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(!showAddForm)}
            data-testid="add-affected-ci-btn"
          >
            {showAddForm ? 'Cancel' : 'Add CI'}
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* Add CI Form */}
        {showAddForm && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }} data-testid="add-ci-form">
            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-end' }}>
              <TextField
                size="small"
                label="Search CIs"
                value={ciSearch}
                onChange={(e) => setCiSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchCis(); }}
                sx={{ flex: 1 }}
              />
              <IconButton onClick={handleSearchCis} disabled={searching} size="small">
                {searching ? <CircularProgress size={20} /> : <SearchIcon />}
              </IconButton>
            </Box>

            {ciOptions.length > 0 && (
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel>Select CI</InputLabel>
                <Select
                  value={selectedCiId}
                  onChange={(e) => setSelectedCiId(e.target.value)}
                  label="Select CI"
                  data-testid="ci-select"
                >
                  {ciOptions.map((ci) => (
                    <MenuItem key={ci.id} value={ci.id}>
                      {ci.name} ({ci.className})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Relationship Type</InputLabel>
                <Select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  label="Relationship Type"
                  data-testid="relationship-type-select"
                >
                  {RELATIONSHIP_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="small"
                onClick={handleAdd}
                disabled={adding || !selectedCiId}
                data-testid="confirm-add-ci-btn"
              >
                {adding ? 'Linking...' : 'Link CI'}
              </Button>
            </Box>
          </Box>
        )}

        {/* CI Links Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : links.length === 0 ? (
          <Typography variant="body2" color="text.secondary" data-testid="no-affected-cis">
            No affected CIs linked to this change. Use the &quot;Add CI&quot; button to link configuration items.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>CI Name</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Relationship</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id} data-testid={`ci-link-row-${link.id}`}>
                    <TableCell>{link.ci?.name || link.ciId}</TableCell>
                    <TableCell>
                      <Chip
                        label={link.ci?.ciClass?.name || 'Unknown'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={link.relationshipType}
                        size="small"
                        color={link.relationshipType === 'PRIMARY' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemove(link.id)}
                        data-testid={`remove-ci-link-${link.id}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};
