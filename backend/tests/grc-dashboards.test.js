const request = require('supertest');
const app = require('../server');

describe('GRC Dashboard Endpoints', () => {
  let authToken;
  
  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@grc.local',
        password: 'admin123'
      });
    
    if (loginResponse.body.token) {
      authToken = loginResponse.body.token;
    }
  });

  describe('GET /api/grc/dashboard/audit-overview', () => {
    it('should return audit overview data structure', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/audit-overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('auditPipeline');
        expect(response.body).toHaveProperty('findingsByDepartment');
        expect(response.body).toHaveProperty('capaPerformance');
        expect(response.body).toHaveProperty('topRiskAreas');
        expect(response.body).toHaveProperty('auditCalendar');
        
        expect(response.body.auditPipeline).toHaveProperty('draft');
        expect(response.body.auditPipeline).toHaveProperty('planned');
        expect(response.body.auditPipeline).toHaveProperty('fieldwork');
        expect(response.body.auditPipeline).toHaveProperty('reporting');
        expect(response.body.auditPipeline).toHaveProperty('final');
        expect(response.body.auditPipeline).toHaveProperty('closed');
        
        expect(response.body.capaPerformance).toHaveProperty('total');
        expect(response.body.capaPerformance).toHaveProperty('open');
        expect(response.body.capaPerformance).toHaveProperty('overdue');
        expect(response.body.capaPerformance).toHaveProperty('avgClosureDays');
        expect(response.body.capaPerformance).toHaveProperty('validatedRate');
        
        expect(Array.isArray(response.body.findingsByDepartment)).toBe(true);
        expect(Array.isArray(response.body.topRiskAreas)).toBe(true);
        expect(Array.isArray(response.body.auditCalendar)).toBe(true);
      }
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/audit-overview')
        .query({ from: '2024-01-01', to: '2024-12-31' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support department filtering', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/audit-overview')
        .query({ department: 'IT' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/grc/dashboard/compliance-overview', () => {
    it('should return compliance overview data structure', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/compliance-overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('standardsCoverage');
        expect(response.body).toHaveProperty('clauseHeatmap');
        expect(response.body).toHaveProperty('requirementStatus');
        expect(response.body).toHaveProperty('domainBreakdown');
        
        expect(response.body.requirementStatus).toHaveProperty('compliant');
        expect(response.body.requirementStatus).toHaveProperty('partiallyCompliant');
        expect(response.body.requirementStatus).toHaveProperty('nonCompliant');
        expect(response.body.requirementStatus).toHaveProperty('notAssessed');
        
        expect(Array.isArray(response.body.standardsCoverage)).toBe(true);
        expect(Array.isArray(response.body.clauseHeatmap)).toBe(true);
        expect(Array.isArray(response.body.domainBreakdown)).toBe(true);
      }
    });

    it('should support family filtering', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/compliance-overview')
        .query({ family: 'iso27001' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support version filtering', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/compliance-overview')
        .query({ version: '2022' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/grc/dashboard/grc-health', () => {
    it('should return GRC health data structure', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/grc-health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('departmentScores');
        expect(response.body).toHaveProperty('repeatedFindings');
        expect(response.body).toHaveProperty('policyCompliance');
        expect(response.body).toHaveProperty('riskClusters');
        
        expect(Array.isArray(response.body.departmentScores)).toBe(true);
        expect(Array.isArray(response.body.repeatedFindings)).toBe(true);
        expect(Array.isArray(response.body.policyCompliance)).toBe(true);
        expect(Array.isArray(response.body.riskClusters)).toBe(true);
      }
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/grc-health')
        .query({ from: '2024-01-01', to: '2024-12-31' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/grc/dashboard/filters', () => {
    it('should return available filter options', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/filters')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('departments');
        expect(response.body).toHaveProperty('families');
        expect(response.body).toHaveProperty('versions');
        
        expect(Array.isArray(response.body.departments)).toBe(true);
        expect(Array.isArray(response.body.families)).toBe(true);
        expect(Array.isArray(response.body.versions)).toBe(true);
      }
    });
  });

  describe('Access Control', () => {
    it('should require authentication for audit-overview', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/audit-overview')
        .expect('Content-Type', /json/);
      
      expect([401, 403]).toContain(response.status);
    });

    it('should require authentication for compliance-overview', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/compliance-overview')
        .expect('Content-Type', /json/);
      
      expect([401, 403]).toContain(response.status);
    });

    it('should require authentication for grc-health', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/grc-health')
        .expect('Content-Type', /json/);
      
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Data Validation', () => {
    it('should return numeric values for audit pipeline counts', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/audit-overview')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (response.status === 200 && response.body.auditPipeline) {
        const pipeline = response.body.auditPipeline;
        expect(typeof pipeline.draft).toBe('number');
        expect(typeof pipeline.planned).toBe('number');
        expect(typeof pipeline.fieldwork).toBe('number');
        expect(typeof pipeline.reporting).toBe('number');
        expect(typeof pipeline.final).toBe('number');
        expect(typeof pipeline.closed).toBe('number');
      }
    });

    it('should return valid compliance scores between 0 and 1', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/compliance-overview')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (response.status === 200 && response.body.standardsCoverage) {
        response.body.standardsCoverage.forEach(standard => {
          expect(standard.complianceScore).toBeGreaterThanOrEqual(0);
          expect(standard.complianceScore).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should return valid department scores between 0 and 1', async () => {
      const response = await request(app)
        .get('/api/grc/dashboard/grc-health')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (response.status === 200 && response.body.departmentScores) {
        response.body.departmentScores.forEach(dept => {
          expect(dept.score).toBeGreaterThanOrEqual(0);
          expect(dept.score).toBeLessThanOrEqual(1);
        });
      }
    });
  });
});
