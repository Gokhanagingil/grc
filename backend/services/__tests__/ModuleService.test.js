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

    it('should include platform category modules', () => {
      const moduleKeys = ModuleService.availableModules.map(m => m.key);
      expect(moduleKeys).toContain('assessment');
      expect(moduleKeys).toContain('workflow');
      expect(moduleKeys).toContain('reporting');
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

  describe('getModuleDefinition', () => {
    it('should return module definition for valid key', () => {
      const result = ModuleService.getModuleDefinition('risk');
      expect(result).toBeDefined();
      expect(result.key).toBe('risk');
    });

    it('should return null for invalid key', () => {
      const result = ModuleService.getModuleDefinition('invalid_module');
      expect(result).toBeNull();
    });
  });

  describe('isValidModuleKey', () => {
    it('should return true for valid module key', () => {
      const result = ModuleService.isValidModuleKey('risk');
      expect(result).toBe(true);
    });

    it('should return false for invalid module key', () => {
      const result = ModuleService.isValidModuleKey('invalid_module');
      expect(result).toBe(false);
    });
  });

  describe('getAvailableModules', () => {
    it('should return all available modules', () => {
      const result = ModuleService.getAvailableModules();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getModulesByCategory', () => {
    it('should return modules for valid category', () => {
      const result = ModuleService.getModulesByCategory('grc');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid category', () => {
      const result = ModuleService.getModulesByCategory('invalid_category');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
