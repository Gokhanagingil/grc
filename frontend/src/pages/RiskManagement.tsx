import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { api } from '../services/api';

interface Risk {
  id: number;
  title: string;
  description: string;
  category: string;
  severity: string;
  likelihood: string;
  impact: string;
  risk_score: number;
  status: string;
  mitigation_plan: string;
  due_date: string;
  owner_first_name: string;
  owner_last_name: string;
  assigned_first_name: string;
  assigned_last_name: string;
  created_at: string;
}

export const RiskManagement: React.FC = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    severity: 'Medium',
    likelihood: 'Medium',
    impact: 'Medium',
    status: 'open',
    mitigationPlan: '',
    dueDate: null as Date | null,
    assignedTo: '',
  });

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      const response = await api.get('/risk/risks');
      setRisks(response.data.risks);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch risks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRisk = () => {
    setEditingRisk(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      severity: 'Medium',
      likelihood: 'Medium',
      impact: 'Medium',
      status: 'open',
      mitigationPlan: '',
      dueDate: null,
      assignedTo: '',
    });
    setOpenDialog(true);
  };

  const handleEditRisk = (risk: Risk) => {
    setEditingRisk(risk);
    setFormData({
      title: risk.title,
      description: risk.description || '',
      category: risk.category || '',
      severity: risk.severity,
      likelihood: risk.likelihood,
      impact: risk.impact,
      status: risk.status,
      mitigationPlan: risk.mitigation_plan || '',
      dueDate: risk.due_date ? new Date(risk.due_date) : null,
      assignedTo: '',
    });
    setOpenDialog(true);
  };

  const handleSaveRisk = async () => {
    try {
      const riskData = {
        ...formData,
        dueDate: formData.dueDate?.toISOString().split('T')[0],
      };

      if (editingRisk) {
        await api.put(`/risk/risks/${editingRisk.id}`, riskData);
      } else {
        await api.post('/risk/risks', riskData);
      }

      setOpenDialog(false);
      fetchRisks();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save risk');
    }
  };

  const handleDeleteRisk = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this risk?')) {
      try {
        await api.delete(`/risk/risks/${id}`);
        fetchRisks();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to delete risk');
      }
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'error';
      case 'High': return 'warning';
      case 'Medium': return 'info';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 16) return 'error';
    if (score >= 9) return 'warning';
    if (score >= 4) return 'info';
    return 'success';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Risk Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRisk}
        >
          New Risk
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Risk Score</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {risks.map((risk) => (
                  <TableRow key={risk.id}>
                    <TableCell>
                      <Typography variant="subtitle2">{risk.title}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {risk.description}
                      </Typography>
                    </TableCell>
                    <TableCell>{risk.category}</TableCell>
                    <TableCell>
                      <Chip
                        label={risk.severity}
                        color={getSeverityColor(risk.severity) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">{risk.risk_score}</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(risk.risk_score / 16) * 100}
                          color={getRiskScoreColor(risk.risk_score) as any}
                          sx={{ width: 50, height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={risk.status}
                        color={risk.status === 'closed' ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {risk.owner_first_name} {risk.owner_last_name}
                    </TableCell>
                    <TableCell>
                      {risk.due_date ? new Date(risk.due_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleEditRisk(risk)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteRisk(risk.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Risk Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRisk ? 'Edit Risk' : 'Create New Risk'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Likelihood</InputLabel>
                <Select
                  value={formData.likelihood}
                  onChange={(e) => setFormData({ ...formData, likelihood: e.target.value })}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Very High">Very High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Impact</InputLabel>
                <Select
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                              <DatePicker
                                label="Due Date"
                                value={formData.dueDate}
                                onChange={(newValue: Date | null) =>
                                  setFormData({ ...formData, dueDate: newValue })
                                }
                                slotProps={{
                                  textField: { fullWidth: true },
                                }}
                              />
                            </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Mitigation Plan"
                multiline
                rows={4}
                value={formData.mitigationPlan}
                onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveRisk} variant="contained">
            {editingRisk ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
