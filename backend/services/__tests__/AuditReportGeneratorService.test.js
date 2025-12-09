const AuditReportGeneratorService = require('../AuditReportGeneratorService');

jest.mock('../../db', () => ({
  isPostgres: jest.fn(() => false),
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
}));

const db = require('../../db');

describe('AuditReportGeneratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('collectReportData', () => {
    it('should collect all audit-related data for report generation', async () => {
      const mockAudit = {
        id: 1,
        name: 'Test Audit',
        description: 'Test Description',
        audit_type: 'internal',
        status: 'in_progress',
        risk_level: 'medium',
        owner_first_name: 'John',
        owner_last_name: 'Doe',
        lead_auditor_first_name: 'Jane',
        lead_auditor_last_name: 'Smith'
      };

      const mockCriteria = [
        { id: 1, title: 'Requirement 1', regulation: 'ISO 27001' }
      ];

      const mockScopeObjects = [
        { id: 1, object_type: 'service', object_id: 'SVC001', object_name: 'Test Service' }
      ];

      const mockFindings = [
        { 
          id: 1, 
          title: 'Finding 1', 
          severity: 'high', 
          status: 'open',
          capas: [{ id: 1, title: 'CAPA 1', status: 'open', validation_status: 'pending' }],
          related_risks: [],
          breached_requirements: [],
          itsm_links: []
        }
      ];

      const mockEvidence = [
        { id: 1, title: 'Evidence 1', type: 'document' }
      ];

      db.get.mockImplementation((query) => {
        if (query.includes('FROM audits')) {
          return Promise.resolve(mockAudit);
        }
        if (query.includes('MAX(version)')) {
          return Promise.resolve({ max_version: 0 });
        }
        return Promise.resolve(null);
      });

      db.all.mockImplementation((query) => {
        if (query.includes('audit_criteria')) {
          return Promise.resolve(mockCriteria);
        }
        if (query.includes('audit_scope_objects')) {
          return Promise.resolve(mockScopeObjects);
        }
        if (query.includes('FROM findings')) {
          return Promise.resolve(mockFindings);
        }
        if (query.includes('FROM evidence')) {
          return Promise.resolve(mockEvidence);
        }
        if (query.includes('FROM capas')) {
          return Promise.resolve([]);
        }
        if (query.includes('finding_risks')) {
          return Promise.resolve([]);
        }
        if (query.includes('finding_requirements')) {
          return Promise.resolve([]);
        }
        if (query.includes('finding_itsm_links')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const user = { id: 1, first_name: 'Test', last_name: 'User' };
      const reportData = await AuditReportGeneratorService.collectReportData(1, user);

      expect(reportData.audit).toEqual(mockAudit);
      expect(reportData.criteria).toEqual(mockCriteria);
      expect(reportData.scopeObjects).toEqual(mockScopeObjects);
      expect(reportData.evidence).toEqual(mockEvidence);
      expect(reportData.reportVersion).toBe(1);
      expect(reportData.reportStatus).toBe('draft');
      expect(reportData.generatedBy).toEqual(user);
    });

    it('should throw error if audit not found', async () => {
      db.get.mockResolvedValue(null);

      await expect(AuditReportGeneratorService.collectReportData(999, {}))
        .rejects.toThrow('Audit not found');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate correct metrics from findings', () => {
      const findings = [
        { severity: 'critical', status: 'open', capas: [{ status: 'open', validation_status: 'pending' }] },
        { severity: 'high', status: 'open', capas: [{ status: 'overdue', validation_status: 'pending' }] },
        { severity: 'medium', status: 'closed', capas: [] },
        { severity: 'low', status: 'open', capas: [{ status: 'implemented', validation_status: 'validated' }] }
      ];

      const metrics = AuditReportGeneratorService.calculateMetrics(findings);

      expect(metrics.totalFindings).toBe(4);
      expect(metrics.findingsBySeverity.critical).toBe(1);
      expect(metrics.findingsBySeverity.high).toBe(1);
      expect(metrics.findingsBySeverity.medium).toBe(1);
      expect(metrics.findingsBySeverity.low).toBe(1);
      expect(metrics.totalCapas).toBe(3);
      expect(metrics.overdueCapas).toBe(1);
      expect(metrics.validatedCapas).toBe(1);
    });

    it('should handle empty findings array', () => {
      const metrics = AuditReportGeneratorService.calculateMetrics([]);

      expect(metrics.totalFindings).toBe(0);
      expect(metrics.totalCapas).toBe(0);
      expect(metrics.findingsBySeverity.critical).toBe(0);
    });
  });

  describe('saveReport', () => {
    it('should save a new report with correct version', async () => {
      db.get.mockResolvedValue({ max_version: 2 });
      db.run.mockResolvedValue({ lastID: 1 });

      const result = await AuditReportGeneratorService.saveReport(1, '<html></html>', 1);

      expect(result.version).toBe(3);
      expect(result.status).toBe('draft');
      expect(result.audit_id).toBe(1);
    });

    it('should start version at 1 for first report', async () => {
      db.get.mockResolvedValue({ max_version: null });
      db.run.mockResolvedValue({ lastID: 1 });

      const result = await AuditReportGeneratorService.saveReport(1, '<html></html>', 1);

      expect(result.version).toBe(1);
    });
  });

  describe('regenerateReport', () => {
    it('should regenerate draft report', async () => {
      const mockReport = { id: 1, audit_id: 1, status: 'draft' };
      const mockAudit = { id: 1, name: 'Test Audit' };

      db.get.mockImplementation((query) => {
        if (query.includes('FROM audit_reports')) {
          return Promise.resolve(mockReport);
        }
        if (query.includes('FROM audits')) {
          return Promise.resolve(mockAudit);
        }
        if (query.includes('MAX(version)')) {
          return Promise.resolve({ max_version: 1 });
        }
        return Promise.resolve(null);
      });

      db.all.mockResolvedValue([]);
      db.run.mockResolvedValue({});

      const user = { id: 1, first_name: 'Test', last_name: 'User' };
      const result = await AuditReportGeneratorService.regenerateReport(1, user);

      expect(result.regenerated).toBe(true);
    });

    it('should throw error when regenerating final report', async () => {
      db.get.mockResolvedValue({ id: 1, audit_id: 1, status: 'final' });

      await expect(AuditReportGeneratorService.regenerateReport(1, {}))
        .rejects.toThrow('Cannot regenerate a finalized or archived report');
    });

    it('should throw error when regenerating archived report', async () => {
      db.get.mockResolvedValue({ id: 1, audit_id: 1, status: 'archived' });

      await expect(AuditReportGeneratorService.regenerateReport(1, {}))
        .rejects.toThrow('Cannot regenerate a finalized or archived report');
    });

    it('should throw error when report not found', async () => {
      db.get.mockResolvedValue(null);

      await expect(AuditReportGeneratorService.regenerateReport(999, {}))
        .rejects.toThrow('Report not found');
    });
  });
});
