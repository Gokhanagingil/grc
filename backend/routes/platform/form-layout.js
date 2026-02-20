/**
 * Form Layout Routes - Dynamic Forms per Role API
 * 
 * Provides endpoints for:
 * - Form layout management
 * - Layout retrieval per role
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const formLayoutService = require('../../services/FormLayoutService');

const router = express.Router();

/**
 * GET /api/platform/form-layouts
 * Get all form layouts
 */
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const layouts = await formLayoutService.getAllLayouts();
    res.json({ layouts });
  } catch (error) {
    console.error('Error fetching form layouts:', error);
    res.status(500).json({ message: 'Failed to fetch form layouts' });
  }
});

/**
 * GET /api/platform/form-layouts/tables
 * Get list of tables with layouts
 */
router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await formLayoutService.getTablesWithLayouts();
    res.json({ tables });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ message: 'Failed to fetch tables' });
  }
});

/**
 * GET /api/platform/form-layouts/table/:tableName
 * Get all layouts for a specific table
 */
router.get('/table/:tableName', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { tableName } = req.params;
    const layouts = await formLayoutService.getLayoutsForTable(tableName);
    res.json({ tableName, layouts });
  } catch (error) {
    console.error('Error fetching table layouts:', error);
    res.status(500).json({ message: 'Failed to fetch table layouts' });
  }
});

/**
 * GET /api/platform/form-layouts/resolve/:tableName
 * Get the resolved layout for current user's role
 */
router.get('/resolve/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userRole = req.user.role;
    
    const layout = await formLayoutService.getLayout(tableName, userRole);
    
    if (!layout) {
      // Return default layout structure if no custom layout exists
      const defaultLayout = formLayoutService.getDefaultLayoutStructure(tableName);
      return res.json({ 
        tableName, 
        role: userRole, 
        layout: defaultLayout,
        isDefault: true 
      });
    }

    res.json({ 
      tableName, 
      role: userRole, 
      layout: layout.layout_json,
      isDefault: false 
    });
  } catch (error) {
    console.error('Error resolving form layout:', error);
    res.status(500).json({ message: 'Failed to resolve form layout' });
  }
});

/**
 * GET /api/platform/form-layouts/default/:tableName
 * Get default layout structure for a table
 */
router.get('/default/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const defaultLayout = formLayoutService.getDefaultLayoutStructure(tableName);
    res.json({ tableName, layout: defaultLayout });
  } catch (error) {
    console.error('Error fetching default layout:', error);
    res.status(500).json({ message: 'Failed to fetch default layout' });
  }
});

/**
 * POST /api/platform/form-layouts
 * Create a new form layout
 */
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { table_name, role, layout_json } = req.body;

    if (!table_name || !role || !layout_json) {
      return res.status(400).json({ 
        message: 'table_name, role, and layout_json are required' 
      });
    }

    const layout = await formLayoutService.createLayout({
      table_name, role, layout_json
    });

    res.status(201).json({ message: 'Form layout created successfully', layout });
  } catch (error) {
    console.error('Error creating form layout:', error);
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ 
        message: 'A layout already exists for this table and role combination' 
      });
    }
    res.status(500).json({ message: 'Failed to create form layout' });
  }
});

/**
 * PUT /api/platform/form-layouts/:id
 * Update a form layout
 */
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const success = await formLayoutService.updateLayout(parseInt(id), updates);
    if (success) {
      res.json({ message: 'Form layout updated successfully' });
    } else {
      res.status(404).json({ message: 'Form layout not found' });
    }
  } catch (error) {
    console.error('Error updating form layout:', error);
    res.status(500).json({ message: 'Failed to update form layout' });
  }
});

/**
 * DELETE /api/platform/form-layouts/:id
 * Delete a form layout
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const success = await formLayoutService.deleteLayout(parseInt(id));
    if (success) {
      res.json({ message: 'Form layout deleted successfully' });
    } else {
      res.status(404).json({ message: 'Form layout not found' });
    }
  } catch (error) {
    console.error('Error deleting form layout:', error);
    res.status(500).json({ message: 'Failed to delete form layout' });
  }
});

/**
 * POST /api/platform/form-layouts/apply
 * Apply layout to form data (for preview/testing)
 */
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { tableName, formData, mode = 'view' } = req.body;

    if (!tableName) {
      return res.status(400).json({ message: 'tableName is required' });
    }

    const layout = await formLayoutService.getLayout(tableName, req.user.role);
    const result = formLayoutService.applyLayout(layout, formData, mode);

    res.json(result);
  } catch (error) {
    console.error('Error applying form layout:', error);
    res.status(500).json({ message: 'Failed to apply form layout' });
  }
});

module.exports = router;
