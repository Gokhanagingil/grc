/**
 * ACL Routes - Access Control List API
 * 
 * Provides endpoints for:
 * - Permission management
 * - ACL rule management
 * - ACL evaluation
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const aclService = require('../../services/AclService');

const router = express.Router();

/**
 * GET /api/platform/acl/permissions
 * Get all permissions
 */
router.get('/permissions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const permissions = await aclService.getAllPermissions();
    res.json({ permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions' });
  }
});

/**
 * GET /api/platform/acl/permissions/role/:role
 * Get permissions for a specific role
 */
router.get('/permissions/role/:role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.params;
    const permissions = await aclService.getPermissionsForRole(role);
    res.json({ role, permissions });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ message: 'Failed to fetch role permissions' });
  }
});

/**
 * POST /api/platform/acl/permissions/role/:role
 * Assign permission to role
 */
router.post('/permissions/role/:role', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role } = req.params;
    const { permissionKey } = req.body;

    if (!permissionKey) {
      return res.status(400).json({ message: 'Permission key is required' });
    }

    const success = await aclService.assignPermissionToRole(role, permissionKey);
    if (success) {
      res.json({ message: 'Permission assigned successfully' });
    } else {
      res.status(404).json({ message: 'Permission not found' });
    }
  } catch (error) {
    console.error('Error assigning permission:', error);
    res.status(500).json({ message: 'Failed to assign permission' });
  }
});

/**
 * DELETE /api/platform/acl/permissions/role/:role/:permissionKey
 * Remove permission from role
 */
router.delete('/permissions/role/:role/:permissionKey', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role, permissionKey } = req.params;

    const success = await aclService.removePermissionFromRole(role, permissionKey);
    if (success) {
      res.json({ message: 'Permission removed successfully' });
    } else {
      res.status(404).json({ message: 'Permission or role assignment not found' });
    }
  } catch (error) {
    console.error('Error removing permission:', error);
    res.status(500).json({ message: 'Failed to remove permission' });
  }
});

/**
 * GET /api/platform/acl/rules
 * Get all ACL rules
 */
router.get('/rules', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const rules = await aclService.getAllAclRules();
    res.json({ rules });
  } catch (error) {
    console.error('Error fetching ACL rules:', error);
    res.status(500).json({ message: 'Failed to fetch ACL rules' });
  }
});

/**
 * GET /api/platform/acl/rules/table/:tableName
 * Get ACL rules for a specific table
 */
router.get('/rules/table/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const rules = await aclService.getAclRulesForTable(tableName);
    res.json({ tableName, rules });
  } catch (error) {
    console.error('Error fetching table ACL rules:', error);
    res.status(500).json({ message: 'Failed to fetch table ACL rules' });
  }
});

/**
 * POST /api/platform/acl/rules
 * Create a new ACL rule
 */
router.post('/rules', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, table_name, effect, conditions, fields, actions, priority } = req.body;

    if (!name || !table_name || !effect || !actions) {
      return res.status(400).json({ 
        message: 'Name, table_name, effect, and actions are required' 
      });
    }

    if (!['allow', 'deny'].includes(effect)) {
      return res.status(400).json({ message: 'Effect must be "allow" or "deny"' });
    }

    const rule = await aclService.createAclRule({
      name, table_name, effect, conditions, fields, actions, priority
    });

    res.status(201).json({ message: 'ACL rule created successfully', rule });
  } catch (error) {
    console.error('Error creating ACL rule:', error);
    res.status(500).json({ message: 'Failed to create ACL rule' });
  }
});

/**
 * PUT /api/platform/acl/rules/:id
 * Update an ACL rule
 */
router.put('/rules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.effect && !['allow', 'deny'].includes(updates.effect)) {
      return res.status(400).json({ message: 'Effect must be "allow" or "deny"' });
    }

    const success = await aclService.updateAclRule(parseInt(id), updates);
    if (success) {
      res.json({ message: 'ACL rule updated successfully' });
    } else {
      res.status(404).json({ message: 'ACL rule not found' });
    }
  } catch (error) {
    console.error('Error updating ACL rule:', error);
    res.status(500).json({ message: 'Failed to update ACL rule' });
  }
});

/**
 * DELETE /api/platform/acl/rules/:id
 * Delete an ACL rule
 */
router.delete('/rules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const success = await aclService.deleteAclRule(parseInt(id));
    if (success) {
      res.json({ message: 'ACL rule deleted successfully' });
    } else {
      res.status(404).json({ message: 'ACL rule not found' });
    }
  } catch (error) {
    console.error('Error deleting ACL rule:', error);
    res.status(500).json({ message: 'Failed to delete ACL rule' });
  }
});

/**
 * POST /api/platform/acl/evaluate
 * Evaluate ACL for a specific action
 */
router.post('/evaluate', authenticateToken, async (req, res) => {
  try {
    const { action, tableName, record, fieldName } = req.body;

    if (!action || !tableName) {
      return res.status(400).json({ message: 'Action and tableName are required' });
    }

    const result = await aclService.can(req.user, action, tableName, record, fieldName);
    res.json(result);
  } catch (error) {
    console.error('Error evaluating ACL:', error);
    res.status(500).json({ message: 'Failed to evaluate ACL' });
  }
});

/**
 * GET /api/platform/acl/my-permissions
 * Get current user's permissions
 */
router.get('/my-permissions', authenticateToken, async (req, res) => {
  try {
    const permissions = await aclService.getPermissionsForRole(req.user.role);
    res.json({ 
      role: req.user.role,
      permissions 
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ message: 'Failed to fetch user permissions' });
  }
});

module.exports = router;
