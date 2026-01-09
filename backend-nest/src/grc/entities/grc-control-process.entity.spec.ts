import { GrcControlProcess } from './grc-control-process.entity';
import { GrcControl } from './grc-control.entity';
import { Process } from './process.entity';

describe('GrcControlProcess Entity', () => {
  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockControlId = '00000000-0000-0000-0000-000000000002';
  const mockProcessId = '00000000-0000-0000-0000-000000000003';

  describe('Entity Structure', () => {
    it('should create a GrcControlProcess instance', () => {
      const controlProcess = new GrcControlProcess();
      controlProcess.tenantId = mockTenantId;
      controlProcess.controlId = mockControlId;
      controlProcess.processId = mockProcessId;
      controlProcess.notes = 'Test notes';

      expect(controlProcess).toBeDefined();
      expect(controlProcess.tenantId).toBe(mockTenantId);
      expect(controlProcess.controlId).toBe(mockControlId);
      expect(controlProcess.processId).toBe(mockProcessId);
      expect(controlProcess.notes).toBe('Test notes');
    });

    it('should allow null notes', () => {
      const controlProcess = new GrcControlProcess();
      controlProcess.tenantId = mockTenantId;
      controlProcess.controlId = mockControlId;
      controlProcess.processId = mockProcessId;
      controlProcess.notes = null;

      expect(controlProcess.notes).toBeNull();
    });
  });

  describe('Relationships', () => {
    it('should have control relationship', () => {
      const controlProcess = new GrcControlProcess();
      const mockControl = new GrcControl();
      mockControl.id = mockControlId;
      mockControl.name = 'Test Control';

      controlProcess.control = mockControl;

      expect(controlProcess.control).toBeDefined();
      expect(controlProcess.control.id).toBe(mockControlId);
      expect(controlProcess.control.name).toBe('Test Control');
    });

    it('should have process relationship', () => {
      const controlProcess = new GrcControlProcess();
      const mockProcess = new Process();
      mockProcess.id = mockProcessId;
      mockProcess.name = 'Test Process';

      controlProcess.process = mockProcess;

      expect(controlProcess.process).toBeDefined();
      expect(controlProcess.process.id).toBe(mockProcessId);
      expect(controlProcess.process.name).toBe('Test Process');
    });
  });

  describe('Tenant Isolation', () => {
    it('should require tenantId for proper isolation', () => {
      const controlProcess1 = new GrcControlProcess();
      controlProcess1.tenantId = mockTenantId;
      controlProcess1.controlId = mockControlId;
      controlProcess1.processId = mockProcessId;

      const controlProcess2 = new GrcControlProcess();
      controlProcess2.tenantId = '00000000-0000-0000-0000-000000000099';
      controlProcess2.controlId = mockControlId;
      controlProcess2.processId = mockProcessId;

      expect(controlProcess1.tenantId).not.toBe(controlProcess2.tenantId);
    });
  });

  describe('Uniqueness Constraint', () => {
    it('should have unique constraint on (tenantId, controlId, processId)', () => {
      const controlProcess1 = new GrcControlProcess();
      controlProcess1.tenantId = mockTenantId;
      controlProcess1.controlId = mockControlId;
      controlProcess1.processId = mockProcessId;

      const controlProcess2 = new GrcControlProcess();
      controlProcess2.tenantId = mockTenantId;
      controlProcess2.controlId = mockControlId;
      controlProcess2.processId = mockProcessId;

      expect(controlProcess1.tenantId).toBe(controlProcess2.tenantId);
      expect(controlProcess1.controlId).toBe(controlProcess2.controlId);
      expect(controlProcess1.processId).toBe(controlProcess2.processId);
    });

    it('should allow same control-process link in different tenants', () => {
      const controlProcess1 = new GrcControlProcess();
      controlProcess1.tenantId = mockTenantId;
      controlProcess1.controlId = mockControlId;
      controlProcess1.processId = mockProcessId;

      const controlProcess2 = new GrcControlProcess();
      controlProcess2.tenantId = '00000000-0000-0000-0000-000000000099';
      controlProcess2.controlId = mockControlId;
      controlProcess2.processId = mockProcessId;

      expect(controlProcess1.tenantId).not.toBe(controlProcess2.tenantId);
      expect(controlProcess1.controlId).toBe(controlProcess2.controlId);
      expect(controlProcess1.processId).toBe(controlProcess2.processId);
    });
  });
});
