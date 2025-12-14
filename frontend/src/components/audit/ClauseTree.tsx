import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Article as ClauseIcon,
  CheckCircle as AuditableIcon,
} from '@mui/icons-material';
import { ClauseTreeNode } from '../../services/grcClient';

interface ClauseTreeProps {
  clauses: ClauseTreeNode[];
  selectedClauseId?: string | null;
  onClauseSelect?: (clause: ClauseTreeNode) => void;
  selectable?: boolean;
  selectedClauseIds?: string[];
  onClauseToggle?: (clauseId: string, selected: boolean) => void;
  disabled?: boolean;
}

interface ClauseTreeItemProps {
  clause: ClauseTreeNode;
  level: number;
  selectedClauseId?: string | null;
  onClauseSelect?: (clause: ClauseTreeNode) => void;
  selectable?: boolean;
  selectedClauseIds?: string[];
  onClauseToggle?: (clauseId: string, selected: boolean) => void;
  disabled?: boolean;
}

const ClauseTreeItem: React.FC<ClauseTreeItemProps> = ({
  clause,
  level,
  selectedClauseId,
  onClauseSelect,
  selectable,
  selectedClauseIds = [],
  onClauseToggle,
  disabled,
}) => {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = clause.children && clause.children.length > 0;
  const isSelected = selectedClauseId === clause.id;
  const isChecked = selectedClauseIds.includes(clause.id);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = () => {
    if (onClauseSelect) {
      onClauseSelect(clause);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onClauseToggle) {
      onClauseToggle(clause.id, e.target.checked);
    }
  };

  return (
    <>
      <ListItem
        disablePadding
        sx={{
          pl: level * 2,
          bgcolor: isSelected ? 'action.selected' : 'transparent',
        }}
      >
        <ListItemButton
          onClick={handleClick}
          disabled={disabled}
          sx={{ py: 0.5 }}
        >
          {selectable && (
            <Checkbox
              checked={isChecked}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              disabled={disabled}
              size="small"
              sx={{ mr: 1 }}
            />
          )}
          <ListItemIcon sx={{ minWidth: 32 }}>
            {hasChildren ? (
              <IconButton size="small" onClick={handleToggleExpand}>
                {expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
            ) : (
              <ClauseIcon fontSize="small" color="action" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="body2"
                  fontWeight={hasChildren ? 'medium' : 'normal'}
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {clause.code} - {clause.title}
                </Typography>
                {clause.isAuditable && (
                  <AuditableIcon
                    fontSize="small"
                    color="success"
                    titleAccess="Auditable"
                  />
                )}
              </Box>
            }
            secondary={
              clause.description && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    maxWidth: 300,
                  }}
                >
                  {clause.description}
                </Typography>
              )
            }
          />
        </ListItemButton>
      </ListItem>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {clause.children.map((child) => (
              <ClauseTreeItem
                key={child.id}
                clause={child}
                level={level + 1}
                selectedClauseId={selectedClauseId}
                onClauseSelect={onClauseSelect}
                selectable={selectable}
                selectedClauseIds={selectedClauseIds}
                onClauseToggle={onClauseToggle}
                disabled={disabled}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export const ClauseTree: React.FC<ClauseTreeProps> = ({
  clauses,
  selectedClauseId,
  onClauseSelect,
  selectable = false,
  selectedClauseIds = [],
  onClauseToggle,
  disabled = false,
}) => {
  if (!clauses || clauses.length === 0) {
    return (
      <Box p={2}>
        <Typography color="textSecondary" variant="body2">
          No clauses available for this standard.
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {clauses.map((clause) => (
        <ClauseTreeItem
          key={clause.id}
          clause={clause}
          level={0}
          selectedClauseId={selectedClauseId}
          onClauseSelect={onClauseSelect}
          selectable={selectable}
          selectedClauseIds={selectedClauseIds}
          onClauseToggle={onClauseToggle}
          disabled={disabled}
        />
      ))}
    </List>
  );
};

export default ClauseTree;
