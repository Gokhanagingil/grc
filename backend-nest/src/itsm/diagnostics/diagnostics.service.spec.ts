import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DiagnosticsService } from './diagnostics.service';
import { BusinessRule } from '../business-rule/business-rule.entity';
import { UiPolicy } from '../ui-policy/ui-policy.entity';
import { UiAction } from '../ui-policy/ui-action.entity';
import { WorkflowDefinition } from '../workflow/workflow-definition.entity';
import { SlaDefinition } from '../sla/sla-definition.entity';
import { SlaInstance } from '../sla/sla-instance.entity';
import { SysChoice } from '../choice/sys-choice.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function mockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  };
}

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;
  let businessRuleRepo: ReturnType<typeof mockRepo>;
  let uiPolicyRepo: ReturnType<typeof mockRepo>;
  let uiActionRepo: ReturnType<typeof mockRepo>;
  let workflowRepo: ReturnType<typeof mockRepo>;
  let slaDefRepo: ReturnType<typeof mockRepo>;
  let slaInstanceRepo: ReturnType<typeof mockRepo>;
  let choiceRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    businessRuleRepo = mockRepo();
    uiPolicyRepo = mockRepo();
    uiActionRepo = mockRepo();
    workflowRepo = mockRepo();
    slaDefRepo = mockRepo();
    slaInstanceRepo = mockRepo();
    choiceRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosticsService,
        { provide: getRepositoryToken(BusinessRule), useValue: businessRuleRepo },
        { provide: getRepositoryToken(UiPolicy), useValue: uiPolicyRepo },
        { provide: getRepositoryToken(UiAction), useValue: uiActionRepo },
        { provide: getRepositoryToken(WorkflowDefinition), useValue: workflowRepo },
        { provide: getRepositoryToken(SlaDefinition), useValue: slaDefRepo },
        { provide: getRepositoryToken(SlaInstance), useValue: slaInstanceRepo },
        { provide: getRepositoryToken(SysChoice), useValue: choiceRepo },
      ],
    }).compile();

    service = module.get<DiagnosticsService>(DiagnosticsService);
  });

  describe('getHealth', () => {
    it('should return health info with tenant ID', () => {
      const result = service.getHealth(TENANT_ID);
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.nodeEnv).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('getCounts', () => {
    it('should return counts for all ITSM tables', async () => {
      businessRuleRepo.count.mockResolvedValue(3);
      uiPolicyRepo.count.mockResolvedValue(2);
      uiActionRepo.count.mockResolvedValue(5);
      workflowRepo.count.mockResolvedValue(1);
      slaDefRepo.count.mockResolvedValue(4);

      const results = await service.getCounts(TENANT_ID);
      expect(results).toHaveLength(3);
      expect(results[0].tableName).toBe('itsm_incidents');
      expect(results[0].businessRules).toBe(3);
      expect(results[0].uiPolicies).toBe(2);
    });

    it('should scope queries to tenant', async () => {
      await service.getCounts(TENANT_ID);
      expect(businessRuleRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
    });
  });

  describe('validateBaseline', () => {
    it('should report missing choices', async () => {
      choiceRepo.count.mockResolvedValue(0);
      workflowRepo.find.mockResolvedValue([]);
      slaDefRepo.count.mockResolvedValue(0);

      const result = await service.validateBaseline(TENANT_ID);
      expect(result.valid).toBe(false);
      const choiceErrors = result.errors.filter((e) => e.type === 'MISSING_CHOICES');
      expect(choiceErrors.length).toBeGreaterThan(0);
    });

    it('should report missing workflows', async () => {
      choiceRepo.count.mockResolvedValue(5);
      workflowRepo.find.mockResolvedValue([]);
      slaDefRepo.count.mockResolvedValue(1);

      const result = await service.validateBaseline(TENANT_ID);
      const wfErrors = result.errors.filter((e) => e.type === 'MISSING_WORKFLOW');
      expect(wfErrors.length).toBe(3);
    });

    it('should detect malformed workflows (no initial state)', async () => {
      choiceRepo.count.mockResolvedValue(5);
      slaDefRepo.count.mockResolvedValue(1);
      workflowRepo.find.mockResolvedValue([
        {
          name: 'Bad Workflow',
          states: [{ name: 'open', label: 'Open' }],
          transitions: [],
        },
      ]);

      const result = await service.validateBaseline(TENANT_ID);
      const malformed = result.errors.filter((e) => e.type === 'MALFORMED_WORKFLOW');
      expect(malformed.length).toBeGreaterThan(0);
      expect(malformed.some((e) => e.detail.includes('no initial state'))).toBe(true);
    });

    it('should detect malformed workflows (invalid transition reference)', async () => {
      choiceRepo.count.mockResolvedValue(5);
      slaDefRepo.count.mockResolvedValue(1);
      workflowRepo.find.mockResolvedValue([
        {
          name: 'Bad Refs',
          states: [
            { name: 'open', label: 'Open', isInitial: true },
            { name: 'closed', label: 'Closed', isFinal: true },
          ],
          transitions: [
            { name: 't1', from: 'open', to: 'nonexistent' },
          ],
        },
      ]);

      const result = await service.validateBaseline(TENANT_ID);
      const malformed = result.errors.filter((e) => e.type === 'MALFORMED_WORKFLOW');
      expect(malformed.some((e) => e.detail.includes("unknown 'to' state"))).toBe(true);
    });

    it('should return valid when all baselines exist', async () => {
      choiceRepo.count.mockResolvedValue(5);
      slaDefRepo.count.mockResolvedValue(2);
      workflowRepo.find.mockResolvedValue([
        {
          name: 'Incident WF',
          states: [
            { name: 'open', label: 'Open', isInitial: true },
            { name: 'closed', label: 'Closed', isFinal: true },
          ],
          transitions: [
            { name: 'close', from: 'open', to: 'closed' },
          ],
        },
      ]);

      const result = await service.validateBaseline(TENANT_ID);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing SLA definitions', async () => {
      choiceRepo.count.mockResolvedValue(5);
      workflowRepo.find.mockResolvedValue([
        {
          name: 'WF',
          states: [
            { name: 'open', label: 'Open', isInitial: true },
            { name: 'closed', label: 'Closed', isFinal: true },
          ],
          transitions: [],
        },
      ]);
      slaDefRepo.count.mockResolvedValue(0);

      const result = await service.validateBaseline(TENANT_ID);
      const slaErrors = result.errors.filter((e) => e.type === 'MISSING_SLA');
      expect(slaErrors).toHaveLength(1);
    });
  });

  describe('getActiveSlaInstanceSummary', () => {
    it('should return summary grouped by status', async () => {
      const qb = slaInstanceRepo.createQueryBuilder();
      qb.getRawMany.mockResolvedValue([
        { status: 'IN_PROGRESS', count: '5' },
        { status: 'BREACHED', count: '2' },
        { status: 'MET', count: '10' },
        { status: 'PAUSED', count: '1' },
      ]);

      const result = await service.getActiveSlaInstanceSummary(TENANT_ID);
      expect(result.total).toBe(18);
      expect(result.inProgress).toBe(5);
      expect(result.breached).toBe(2);
      expect(result.met).toBe(10);
      expect(result.paused).toBe(1);
    });
  });
});
