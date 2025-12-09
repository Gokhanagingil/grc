/**
 * Module Service - Module Visibility and Licensing Layer
 * 
 * Manages module availability per tenant for product packaging:
 * - risk, policy, audit, itsm.incident, itsm.cmdb, etc.
 * - Enable/disable modules per tenant
 * - Support for future licensing features
 */

const db = require('../db');

class ModuleService {
  constructor() {
    this.moduleCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    
    // Define available modules
    this.availableModules = [
      { key: 'risk', name: 'Risk Management', description: 'Risk identification, assessment, and mitigation', category: 'grc' },
      { key: 'policy', name: 'Policy Management', description: 'Policy lifecycle management', category: 'grc' },
      { key: 'compliance', name: 'Compliance Management', description: 'Compliance requirements tracking', category: 'grc' },
      { key: 'audit', name: 'Audit Management', description: 'Audit logs and trails', category: 'grc' },
      { key: 'itsm.incident', name: 'Incident Management', description: 'IT incident tracking and resolution', category: 'itsm' },
      { key: 'itsm.cmdb', name: 'CMDB', description: 'Configuration Management Database', category: 'itsm' },
      { key: 'itsm.change', name: 'Change Management', description: 'IT change request management', category: 'itsm' },
      { key: 'itsm.problem', name: 'Problem Management', description: 'IT problem tracking and root cause analysis', category: 'itsm' },
      { key: 'assessment', name: 'Assessment Engine', description: 'Assessment-driven implementation', category: 'platform' },
      { key: 'workflow', name: 'Workflow Engine', description: 'Approval workflows and automation', category: 'platform' },
      { key: 'reporting', name: 'Advanced Reporting', description: 'Custom reports and dashboards', category: 'platform' },
      { key: 'ai', name: 'AI Governance', description: 'AI-assisted governance features', category: 'platform' }
    ];
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.moduleCache.clear();
  }

  /**
   * Get available module definitions
   * @returns {Object[]} Array of module definitions
   */
  getAvailableModules() {
    return this.availableModules;
  }

  /**
   * Check if a module is enabled for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} moduleKey - Module key
   * @returns {Promise<boolean>}
   */
  async isEnabled(tenantId, moduleKey) {
    const cacheKey = `${tenantId}:${moduleKey}`;
    const cached = this.moduleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.get(
      `SELECT status FROM tenant_modules 
       WHERE tenant_id = ${placeholder[0]} AND module_key = ${placeholder[1]}`,
      [tenantId, moduleKey]
    );

    // Default to enabled if no record exists (for backward compatibility)
    const isEnabled = result ? result.status === 'enabled' : true;
    
    this.moduleCache.set(cacheKey, { data: isEnabled, timestamp: Date.now() });
    return isEnabled;
  }

  /**
   * Get all enabled modules for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<string[]>} Array of enabled module keys
   */
  async getEnabledModules(tenantId) {
    const cacheKey = `enabled:${tenantId}`;
    const cached = this.moduleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const placeholder = db.isPostgres() ? '$1' : '?';
    const results = await db.all(
      `SELECT module_key FROM tenant_modules 
       WHERE tenant_id = ${placeholder} AND status = 'enabled'`,
      [tenantId]
    );

    const enabledModules = results.map(r => r.module_key);
    
    // Add default modules if no records exist
    if (enabledModules.length === 0) {
      const defaultModules = ['risk', 'policy', 'compliance', 'audit'];
      this.moduleCache.set(cacheKey, { data: defaultModules, timestamp: Date.now() });
      return defaultModules;
    }

    this.moduleCache.set(cacheKey, { data: enabledModules, timestamp: Date.now() });
    return enabledModules;
  }

  /**
   * Get all module statuses for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object[]>} Array of module status objects
   */
  async getModuleStatuses(tenantId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const results = await db.all(
      `SELECT * FROM tenant_modules WHERE tenant_id = ${placeholder}`,
      [tenantId]
    );

    // Merge with available modules to show all modules
    const statusMap = new Map(results.map(r => [r.module_key, r]));
    
    return this.availableModules.map(mod => {
      const status = statusMap.get(mod.key);
      return {
        ...mod,
        status: status ? status.status : 'not_configured',
        config: status ? this.parseJson(status.config) : null,
        tenant_id: tenantId
      };
    });
  }

  /**
   * Parse JSON safely
   * @param {string|Object} value - JSON string or object
   * @returns {Object|null}
   */
  parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Enable a module for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} moduleKey - Module key
   * @param {Object} config - Optional configuration
   * @returns {Promise<boolean>}
   */
  async enableModule(tenantId, moduleKey, config = null) {
    const configJson = config ? JSON.stringify(config) : null;

    if (db.isPostgres()) {
      await db.run(
        `INSERT INTO tenant_modules (tenant_id, module_key, status, config)
         VALUES ($1, $2, 'enabled', $3)
         ON CONFLICT (tenant_id, module_key) 
         DO UPDATE SET status = 'enabled', config = $3, updated_at = CURRENT_TIMESTAMP`,
        [tenantId, moduleKey, configJson]
      );
    } else {
      // Check if exists
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM tenant_modules WHERE tenant_id = ${placeholder[0]} AND module_key = ${placeholder[1]}`,
        [tenantId, moduleKey]
      );

      if (existing) {
        await db.run(
          `UPDATE tenant_modules SET status = 'enabled', config = ?, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND module_key = ?`,
          [configJson, tenantId, moduleKey]
        );
      } else {
        await db.run(
          `INSERT INTO tenant_modules (tenant_id, module_key, status, config)
           VALUES (?, ?, 'enabled', ?)`,
          [tenantId, moduleKey, configJson]
        );
      }
    }

    this.clearCache();
    return true;
  }

  /**
   * Disable a module for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} moduleKey - Module key
   * @returns {Promise<boolean>}
   */
  async disableModule(tenantId, moduleKey) {
    if (db.isPostgres()) {
      await db.run(
        `INSERT INTO tenant_modules (tenant_id, module_key, status)
         VALUES ($1, $2, 'disabled')
         ON CONFLICT (tenant_id, module_key) 
         DO UPDATE SET status = 'disabled', updated_at = CURRENT_TIMESTAMP`,
        [tenantId, moduleKey]
      );
    } else {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM tenant_modules WHERE tenant_id = ${placeholder[0]} AND module_key = ${placeholder[1]}`,
        [tenantId, moduleKey]
      );

      if (existing) {
        await db.run(
          `UPDATE tenant_modules SET status = 'disabled', updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND module_key = ?`,
          [tenantId, moduleKey]
        );
      } else {
        await db.run(
          `INSERT INTO tenant_modules (tenant_id, module_key, status)
           VALUES (?, ?, 'disabled')`,
          [tenantId, moduleKey]
        );
      }
    }

    this.clearCache();
    return true;
  }

  /**
   * Update module configuration
   * @param {string} tenantId - Tenant ID
   * @param {string} moduleKey - Module key
   * @param {Object} config - Configuration object
   * @returns {Promise<boolean>}
   */
  async updateModuleConfig(tenantId, moduleKey, config) {
    const configJson = JSON.stringify(config);
    const placeholder = db.isPostgres() ? ['$1', '$2', '$3'] : ['?', '?', '?'];

    const result = await db.run(
      `UPDATE tenant_modules SET config = ${placeholder[0]}, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ${placeholder[1]} AND module_key = ${placeholder[2]}`,
      [configJson, tenantId, moduleKey]
    );

    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Get module configuration
   * @param {string} tenantId - Tenant ID
   * @param {string} moduleKey - Module key
   * @returns {Promise<Object|null>}
   */
  async getModuleConfig(tenantId, moduleKey) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.get(
      `SELECT config FROM tenant_modules 
       WHERE tenant_id = ${placeholder[0]} AND module_key = ${placeholder[1]}`,
      [tenantId, moduleKey]
    );

    return result ? this.parseJson(result.config) : null;
  }

  /**
   * Initialize default modules for a new tenant
   * @param {string} tenantId - Tenant ID
   * @param {string[]} enabledModules - Array of module keys to enable
   * @returns {Promise<void>}
   */
  async initializeTenantModules(tenantId, enabledModules = ['risk', 'policy', 'compliance', 'audit']) {
    for (const moduleKey of enabledModules) {
      await this.enableModule(tenantId, moduleKey);
    }
    
    // Disable other modules
    const disabledModules = this.availableModules
      .map(m => m.key)
      .filter(k => !enabledModules.includes(k));
    
    for (const moduleKey of disabledModules) {
      await this.disableModule(tenantId, moduleKey);
    }
  }

  /**
   * Get modules by category
   * @param {string} category - Category (grc, itsm, platform)
   * @returns {Object[]} Array of module definitions
   */
  getModulesByCategory(category) {
    return this.availableModules.filter(m => m.category === category);
  }

  /**
   * Check if module key is valid
   * @param {string} moduleKey - Module key
   * @returns {boolean}
   */
  isValidModuleKey(moduleKey) {
    return this.availableModules.some(m => m.key === moduleKey);
  }

  /**
   * Get module definition by key
   * @param {string} moduleKey - Module key
   * @returns {Object|null}
   */
  getModuleDefinition(moduleKey) {
    return this.availableModules.find(m => m.key === moduleKey) || null;
  }

  /**
   * Get menu items for enabled modules
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object[]>} Array of menu items
   */
  async getMenuItems(tenantId) {
    const enabledModules = await this.getEnabledModules(tenantId);
    
    const menuConfig = {
      risk: { path: '/risk', icon: 'Warning', label: 'Risk Management' },
      policy: { path: '/governance', icon: 'Policy', label: 'Governance' },
      compliance: { path: '/compliance', icon: 'CheckCircle', label: 'Compliance' },
      audit: { path: '/audit', icon: 'History', label: 'Audit Logs' },
      'itsm.incident': { path: '/incidents', icon: 'BugReport', label: 'Incidents' },
      'itsm.cmdb': { path: '/cmdb', icon: 'Storage', label: 'CMDB' },
      'itsm.change': { path: '/changes', icon: 'SwapHoriz', label: 'Changes' },
      'itsm.problem': { path: '/problems', icon: 'Error', label: 'Problems' }
    };

    return enabledModules
      .filter(key => menuConfig[key])
      .map(key => ({
        moduleKey: key,
        ...menuConfig[key]
      }));
  }
}

// Export singleton instance
const moduleService = new ModuleService();
module.exports = moduleService;
