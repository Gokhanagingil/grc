/**
 * UI Policy Routes - No-code Conditional Rules API
 * 
 * Provides endpoints for:
 * - UI policy management
 * - Policy retrieval per table
 * - Policy evaluation
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const uiPolicyService = require('../../services/UiPolicyService');

const router = express.Router();

/**
 * GET /api/platform/ui-policies
 * Get all UI policies
 */
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const policies = await uiPolicyService.getAllPolicies();
    res.json({ policies });
  } catch (error) {
    console.error('Error fetching UI policies:', error);
    res.status(500).json({ message: 'Failed to fetch UI policies' });
  }
});

/**
 * GET /api/platform/ui-policies/tables
 * Get list of tables with policies
 */
router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await uiPolicyService.getTablesWithPolicies();
    res.json({ tables });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ message: 'Failed to fetch tables' });
  }
});

/**
 * GET /api/platform/ui-policies/table/:tableName
 * Get UI policies for a specific table
 */
router.get('/table/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const policies = await uiPolicyService.getPolicies(tableName);
    res.json({ tableName, policies });
  } catch (error) {
    console.error('Error fetching table policies:', error);
    res.status(500).json({ message: 'Failed to fetch table policies' });
  }
});

/**
 * GET /api/platform/ui-policies/:id
 * Get a specific UI policy by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await uiPolicyService.getPolicyById(parseInt(id));
    
    if (!policy) {
      return res.status(404).json({ message: 'UI policy not found' });
    }

    res.json({ policy });
  } catch (error) {
    console.error('Error fetching UI policy:', error);
    res.status(500).json({ message: 'Failed to fetch UI policy' });
  }
});

/**
 * POST /api/platform/ui-policies
 * Create a new UI policy
 */
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, table_name, condition, actions, priority } = req.body;

    // Validate policy structure
    const validation = uiPolicyService.validatePolicy({
      name, table_name, condition, actions
    });

    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Invalid policy structure',
        errors: validation.errors 
      });
    }

    const policy = await uiPolicyService.createPolicy({
      name, table_name, condition, actions, priority
    });

    res.status(201).json({ message: 'UI policy created successfully', policy });
  } catch (error) {
    console.error('Error creating UI policy:', error);
    res.status(500).json({ message: 'Failed to create UI policy' });
  }
});

/**
 * PUT /api/platform/ui-policies/:id
 * Update a UI policy
 */
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate if condition or actions are being updated
    if (updates.condition || updates.actions) {
      const currentPolicy = await uiPolicyService.getPolicyById(parseInt(id));
      if (!currentPolicy) {
        return res.status(404).json({ message: 'UI policy not found' });
      }

      const validation = uiPolicyService.validatePolicy({
        name: updates.name || currentPolicy.name,
        table_name: updates.table_name || currentPolicy.table_name,
        condition: updates.condition || currentPolicy.condition,
        actions: updates.actions || currentPolicy.actions
      });

      if (!validation.valid) {
        return res.status(400).json({ 
          message: 'Invalid policy structure',
          errors: validation.errors 
        });
      }
    }

    const success = await uiPolicyService.updatePolicy(parseInt(id), updates);
    if (success) {
      res.json({ message: 'UI policy updated successfully' });
    } else {
      res.status(404).json({ message: 'UI policy not found' });
    }
  } catch (error) {
    console.error('Error updating UI policy:', error);
    res.status(500).json({ message: 'Failed to update UI policy' });
  }
});

/**
 * DELETE /api/platform/ui-policies/:id
 * Delete a UI policy
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const success = await uiPolicyService.deletePolicy(parseInt(id));
    if (success) {
      res.json({ message: 'UI policy deleted successfully' });
    } else {
      res.status(404).json({ message: 'UI policy not found' });
    }
  } catch (error) {
    console.error('Error deleting UI policy:', error);
    res.status(500).json({ message: 'Failed to delete UI policy' });
  }
});

/**
 * POST /api/platform/ui-policies/evaluate
 * Evaluate UI policies for form data
 */
router.post('/evaluate', authenticateToken, async (req, res) => {
  try {
    const { tableName, formData } = req.body;

    if (!tableName) {
      return res.status(400).json({ message: 'tableName is required' });
    }

    const context = { user: req.user };
    const actions = await uiPolicyService.getApplicableActions(tableName, formData || {}, context);

    res.json({ tableName, actions });
  } catch (error) {
    console.error('Error evaluating UI policies:', error);
    res.status(500).json({ message: 'Failed to evaluate UI policies' });
  }
});

/**
 * POST /api/platform/ui-policies/test
 * Test a policy condition without saving
 */
router.post('/test', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { condition, formData } = req.body;

    if (!condition) {
      return res.status(400).json({ message: 'condition is required' });
    }

    const context = { user: req.user };
    const result = uiPolicyService.evaluateCondition(condition, formData || {}, context);

    res.json({ 
      condition, 
      formData: formData || {}, 
      result,
      message: result ? 'Condition evaluates to TRUE' : 'Condition evaluates to FALSE'
    });
  } catch (error) {
    console.error('Error testing condition:', error);
    res.status(500).json({ message: 'Failed to test condition' });
  }
});

module.exports = router;
