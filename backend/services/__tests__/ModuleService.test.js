/**
 * ModuleService Unit Tests
 * 
 * Tests for Module Visibility and Licensing functionality including:
 * - Module status checking
 * - Module enabling/disabling
 * - Menu item generation
 */

const ModuleService = require('../ModuleService');

describe('ModuleService', () => {
  describe('availableModules', () => {
    it('should have defined available modules', () => {
      expect(ModuleService.availableModules).toBeDefined();
      expect(Array.isArray(ModuleService.availableModules)).toBe(true);
      expect(ModuleService.availableModules.length).toBeGreaterThan(0);
    });

    it('should include core GRC modules', () => {
      const moduleKeys = ModuleService.availableModules.map(m => m.key);
      expect(moduleKeys).toContain('risk');
      expect(moduleKeys).toContain('policy');
      expect(moduleKeys).toContain('compliance');
      expect(moduleKeys).toContain('audit');
    });

    it('should include ITSM modules', () => {
      const moduleKeys = ModuleService.availableModules.map(m => m.key);
      expect(moduleKeys).toContain('itsm.incident');
      expect(moduleKeys).toContain('itsm.cmdb');
    });

    it('should include platform modules', () => {
      const moduleKeys = ModuleService.availableModules.map(m => m.key);
      expect(moduleKeys).toContain('platform.admin');
      expect(moduleKeys).toContain('platform.reporting');
    });

    it('should have required properties for each module', () => {
      ModuleService.availableModules.forEach(module => {
        expect(module).toHaveProperty('key');
        expect(module).toHaveProperty('name');
        expect(module).toHaveProperty('description');
        expect(module).toHaveProperty('category');
      });
    });
  });

  describe('isEnabled', () => {
    it('should return boolean for module status', async () => {
      const result = await ModuleService.isEnabled('default', 'risk');
      expect(typeof result).toBe('boolean');
    });

    it('should handle non-existent tenant gracefully', async () => {
      const result = await ModuleService.isEnabled('non_existent_tenant', 'risk');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getEnabledModules', () => {
    it('should return array of enabled module keys', async () => {
      const result = await ModuleService.getEnabledModules('default');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getModuleStatuses', () => {
    it('should return array of module statuses', async () => {
      const result = await ModuleService.getModuleStatuses('default');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include status property for each module', async () => {
      const result = await ModuleService.getModuleStatuses('default');
      result.forEach(module => {
        expect(module).toHaveProperty('status');
        expect(['enabled', 'disabled', 'not_configured']).toContain(module.status);
      });
    });
  });

  describe('getMenuItems', () => {
    it('should return array of menu items', async () => {
      const result = await ModuleService.getMenuItems('default');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should have required properties for each menu item', async () => {
      const result = await ModuleService.getMenuItems('default');
      result.forEach(item => {
        expect(item).toHaveProperty('moduleKey');
        expect(item).toHaveProperty('path');
        expect(item).toHaveProperty('icon');
        expect(item).toHaveProperty('label');
      });
    });
  });

  describe('enableModule', () => {
    it('should enable a module for a tenant', async () => {
      const result = await ModuleService.enableModule('test_tenant', 'risk');
      expect(result).toBeDefined();
    });
  });

  describe('disableModule', () => {
    it('should disable a module for a tenant', async () => {
      const result = await ModuleService.disableModule('test_tenant', 'risk');
      expect(result).toBeDefined();
    });
  });

  describe('initializeTenantModules', () => {
    it('should initialize modules for a new tenant', async () => {
      const result = await ModuleService.initializeTenantModules('new_tenant', ['risk', 'policy']);
      expect(result).toBeDefined();
    });

    it('should use default modules if none specified', async () => {
      const result = await ModuleService.initializeTenantModules('another_tenant');
      expect(result).toBeDefined();
    });
  });
});
