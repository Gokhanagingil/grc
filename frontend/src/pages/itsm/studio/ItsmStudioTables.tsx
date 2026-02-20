import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';

interface TableInfo {
  name: string;
  label: string;
  endpoint: string;
  keyFields: string[];
}

const ITSM_TABLES: TableInfo[] = [
  {
    name: 'itsm_incidents',
    label: 'Incidents',
    endpoint: '/grc/itsm/incidents',
    keyFields: ['title', 'status', 'priority', 'impact', 'urgency', 'category', 'assignedTo', 'assignmentGroup'],
  },
  {
    name: 'itsm_changes',
    label: 'Changes',
    endpoint: '/grc/itsm/changes',
    keyFields: ['title', 'type', 'state', 'risk', 'priority', 'approvalStatus', 'assignedTo'],
  },
  {
    name: 'itsm_services',
    label: 'Services',
    endpoint: '/grc/itsm/services',
    keyFields: ['name', 'status', 'tier', 'criticality', 'owner', 'supportGroup'],
  },
  {
    name: 'itsm_business_rules',
    label: 'Business Rules',
    endpoint: '/grc/itsm/business-rules',
    keyFields: ['name', 'tableName', 'trigger', 'conditions', 'actions', 'isActive', 'order'],
  },
  {
    name: 'itsm_ui_policies',
    label: 'UI Policies',
    endpoint: '/grc/itsm/ui-policies',
    keyFields: ['name', 'tableName', 'conditions', 'fieldEffects', 'isActive', 'order'],
  },
  {
    name: 'itsm_ui_actions',
    label: 'UI Actions',
    endpoint: '/grc/itsm/ui-policies/actions',
    keyFields: ['name', 'label', 'tableName', 'workflowTransition', 'requiredRoles', 'style'],
  },
  {
    name: 'itsm_workflow_definitions',
    label: 'Workflow Definitions',
    endpoint: '/grc/itsm/workflows',
    keyFields: ['name', 'tableName', 'states', 'transitions', 'isActive'],
  },
  {
    name: 'itsm_sla_definitions',
    label: 'SLA Definitions',
    endpoint: '/grc/itsm/sla/definitions',
    keyFields: ['name', 'metric', 'targetSeconds', 'schedule', 'priorityFilter', 'stopOnStates'],
  },
  {
    name: 'sys_choice',
    label: 'Choices',
    endpoint: '/grc/itsm/choices',
    keyFields: ['tableName', 'fieldName', 'value', 'label', 'sortOrder', 'isActive'],
  },
];

export const ItsmStudioTables: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        ITSM Tables &amp; Dictionary
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Read-only view of ITSM tables, their key fields, and API endpoints.
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Table Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Label</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>API Endpoint</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Key Fields</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ITSM_TABLES.map((table) => (
              <TableRow key={table.name} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {table.name}
                  </Typography>
                </TableCell>
                <TableCell>{table.label}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                    /api{table.endpoint}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {table.keyFields.map((field) => (
                      <Chip
                        key={field}
                        label={field}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ItsmStudioTables;
