/**
 * Module Routes - Module Visibility and Licensing API
 * 
 * Provides endpoints for:
 * - Module status management per tenant
 * - Module configuration
 * - Menu items based on enabled modules
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const moduleService = require('../../services/ModuleService');

const router = express.Router();

/**
 * GET /api/platform/modules/available
 * Get all available module definitions
 */
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const modules = moduleService.getAvailableModules();
    res.json({ modules });
  } catch (error) {
    console.error('Error fetching available modules:', error);
    res.status(500).json({ message: 'Failed to fetch available modules' });
  }
});

/**
 * GET /api/platform/modules/enabled
 * Get enabled modules for current tenant
 */
router.get('/enabled', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const enabledModules = await moduleService.getEnabledModules(tenantId);
    res.json({ tenantId, enabledModules });
  } catch (error) {
    console.error('Error fetching enabled modules:', error);
    res.status(500).json({ message: 'Failed to fetch enabled modules' });
  }
});

/**
 * GET /api/platform/modules/status
 * Get all module statuses for current tenant
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const statuses = await moduleService.getModuleStatuses(tenantId);
    res.json({ tenantId, modules: statuses });
  } catch (error) {
    console.error('Error fetching module statuses:', error);
    res.status(500).json({ message: 'Failed to fetch module statuses' });
  }
});

/**
 * GET /api/platform/modules/check/:moduleKey
 * Check if a specific module is enabled
 */
router.get('/check/:moduleKey', authenticateToken, async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    if (!moduleService.isValidModuleKey(moduleKey)) {
      return res.status(400).json({ message: 'Invalid module key' });
    }

    const isEnabled = await moduleService.isEnabled(tenantId, moduleKey);
    const definition = moduleService.getModuleDefinition(moduleKey);

    res.json({ 
      tenantId, 
      moduleKey, 
      isEnabled,
      module: definition
    });
  } catch (error) {
    console.error('Error checking module status:', error);
    res.status(500).json({ message: 'Failed to check module status' });
  }
});

/**
 * GET /api/platform/modules/menu
 * Get menu items for enabled modules
 */
router.get('/menu', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const menuItems = await moduleService.getMenuItems(tenantId);
    res.json({ tenantId, menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Failed to fetch menu items' });
  }
});

/**
 * GET /api/platform/modules/category/:category
 * Get modules by category
 */
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const { category } = req.params;
    const modules = moduleService.getModulesByCategory(category);
    res.json({ category, modules });
  } catch (error) {
    console.error('Error fetching modules by category:', error);
    res.status(500).json({ message: 'Failed to fetch modules by category' });
  }
});

/**
 * POST /api/platform/modules/:moduleKey/enable
 * Enable a module for current tenant
 */
router.post('/:moduleKey/enable', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { config } = req.body;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    if (!moduleService.isValidModuleKey(moduleKey)) {
      return res.status(400).json({ message: 'Invalid module key' });
    }

    await moduleService.enableModule(tenantId, moduleKey, config);
    res.json({ 
      message: 'Module enabled successfully',
      tenantId,
      moduleKey,
      status: 'enabled'
    });
  } catch (error) {
    console.error('Error enabling module:', error);
    res.status(500).json({ message: 'Failed to enable module' });
  }
});

/**
 * POST /api/platform/modules/:moduleKey/disable
 * Disable a module for current tenant
 */
router.post('/:moduleKey/disable', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    if (!moduleService.isValidModuleKey(moduleKey)) {
      return res.status(400).json({ message: 'Invalid module key' });
    }

    await moduleService.disableModule(tenantId, moduleKey);
    res.json({ 
      message: 'Module disabled successfully',
      tenantId,
      moduleKey,
      status: 'disabled'
    });
  } catch (error) {
    console.error('Error disabling module:', error);
    res.status(500).json({ message: 'Failed to disable module' });
  }
});

/**
 * PUT /api/platform/modules/:moduleKey/config
 * Update module configuration
 */
router.put('/:moduleKey/config', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { config } = req.body;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    if (!moduleService.isValidModuleKey(moduleKey)) {
      return res.status(400).json({ message: 'Invalid module key' });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ message: 'Config must be an object' });
    }

    const success = await moduleService.updateModuleConfig(tenantId, moduleKey, config);
    if (success) {
      res.json({ message: 'Module configuration updated successfully' });
    } else {
      res.status(404).json({ message: 'Module not found for this tenant' });
    }
  } catch (error) {
    console.error('Error updating module config:', error);
    res.status(500).json({ message: 'Failed to update module configuration' });
  }
});

/**
 * GET /api/platform/modules/:moduleKey/config
 * Get module configuration
 */
router.get('/:moduleKey/config', authenticateToken, async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    if (!moduleService.isValidModuleKey(moduleKey)) {
      return res.status(400).json({ message: 'Invalid module key' });
    }

    const config = await moduleService.getModuleConfig(tenantId, moduleKey);
    res.json({ tenantId, moduleKey, config });
  } catch (error) {
    console.error('Error fetching module config:', error);
    res.status(500).json({ message: 'Failed to fetch module configuration' });
  }
});

/**
 * POST /api/platform/modules/initialize
 * Initialize modules for a new tenant (admin only)
 */
router.post('/initialize', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { tenantId, enabledModules } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' });
    }

    await moduleService.initializeTenantModules(tenantId, enabledModules);
    res.json({ 
      message: 'Tenant modules initialized successfully',
      tenantId,
      enabledModules: enabledModules || ['risk', 'policy', 'compliance', 'audit']
    });
  } catch (error) {
    console.error('Error initializing tenant modules:', error);
    res.status(500).json({ message: 'Failed to initialize tenant modules' });
  }
});

module.exports = router;
