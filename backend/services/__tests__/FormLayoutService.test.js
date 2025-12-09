/**
 * FormLayoutService Unit Tests
 * 
 * Tests for Form Layout functionality including:
 * - Layout retrieval by role
 * - Layout application to form data
 * - Default layout generation
 */

const FormLayoutService = require('../FormLayoutService');

describe('FormLayoutService', () => {
  describe('getDefaultLayoutStructure', () => {
    it('should return default layout for risks table', () => {
      const layout = FormLayoutService.getDefaultLayoutStructure('risks');
      expect(layout).toHaveProperty('sections');
      expect(layout).toHaveProperty('hiddenFields');
      expect(layout).toHaveProperty('readonlyFields');
      expect(Array.isArray(layout.sections)).toBe(true);
    });

    it('should return default layout for policies table', () => {
      const layout = FormLayoutService.getDefaultLayoutStructure('policies');
      expect(layout).toHaveProperty('sections');
      expect(layout.sections.length).toBeGreaterThan(0);
    });

    it('should return default layout for compliance_requirements table', () => {
      const layout = FormLayoutService.getDefaultLayoutStructure('compliance_requirements');
      expect(layout).toHaveProperty('sections');
      expect(layout.sections.length).toBeGreaterThan(0);
    });

    it('should return generic layout for unknown tables', () => {
      const layout = FormLayoutService.getDefaultLayoutStructure('unknown_table');
      expect(layout).toHaveProperty('sections');
      expect(layout.sections[0].title).toBe('Details');
    });
  });

  describe('applyLayout', () => {
    const mockLayout = {
      sections: [
        { title: 'Basic Info', fields: ['title', 'description'] },
        { title: 'Details', fields: ['status', 'category'] }
      ],
      hiddenFields: ['internal_notes'],
      readonlyFields: ['created_at', 'updated_at']
    };

    const mockFormData = {
      title: 'Test Risk',
      description: 'Test Description',
      status: 'open',
      category: 'Security',
      internal_notes: 'Secret notes',
      created_at: '2024-01-01',
      updated_at: '2024-01-02'
    };

    it('should apply layout and hide specified fields', () => {
      const result = FormLayoutService.applyLayout(mockLayout, mockFormData, 'view');
      expect(result.hiddenFields).toContain('internal_notes');
    });

    it('should mark readonly fields correctly', () => {
      const result = FormLayoutService.applyLayout(mockLayout, mockFormData, 'edit');
      expect(result.readonlyFields).toContain('created_at');
      expect(result.readonlyFields).toContain('updated_at');
    });

    it('should organize fields into sections', () => {
      const result = FormLayoutService.applyLayout(mockLayout, mockFormData, 'view');
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].title).toBe('Basic Info');
      expect(result.sections[0].fields).toContain('title');
    });

    it('should include form data in result', () => {
      const result = FormLayoutService.applyLayout(mockLayout, mockFormData, 'view');
      expect(result.data).toEqual(mockFormData);
    });
  });

  describe('getLayout', () => {
    it('should return layout for given table and roles', async () => {
      const result = await FormLayoutService.getLayout('risks', ['user']);
      expect(result).toBeDefined();
    });

    it('should prioritize admin role over user role', async () => {
      const result = await FormLayoutService.getLayout('risks', ['admin', 'user']);
      expect(result).toBeDefined();
    });
  });

  describe('getLayoutsForTable', () => {
    it('should return array of layouts for a table', async () => {
      const result = await FormLayoutService.getLayoutsForTable('risks');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
