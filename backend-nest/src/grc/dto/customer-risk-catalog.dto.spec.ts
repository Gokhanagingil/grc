import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateCustomerRiskCatalogDto,
  UpdateCustomerRiskCatalogDto,
  CreateCustomerRiskBindingDto,
  CustomerRiskCatalogFilterDto,
  CustomerRiskBindingFilterDto,
  CustomerRiskObservationFilterDto,
} from './customer-risk-catalog.dto';

describe('CreateCustomerRiskCatalogDto', () => {
  const validPayload = {
    title: 'OS End-of-Support',
    category: 'OS_LIFECYCLE',
    signalType: 'STATIC_FLAG',
    severity: 'CRITICAL',
  };

  it('should pass with valid minimal payload', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with all optional fields', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      description: 'OS no longer receives patches',
      likelihoodWeight: 80,
      impactWeight: 90,
      scoreContributionModel: 'FLAT_POINTS',
      scoreValue: 25,
      status: 'ACTIVE',
      ownerGroup: 'IT Security',
      owner: 'John Doe',
      validFrom: '2025-01-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
      tags: ['os', 'lifecycle'],
      source: 'SYSTEM',
      sourceRef: 'vendor-feed-001',
      rationale: 'EOS creates unpatched vuln risk',
      remediationGuidance: 'Upgrade OS to supported version',
      metadata: { vendor: 'Microsoft' },
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when title is missing', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      category: 'OS_LIFECYCLE',
      signalType: 'STATIC_FLAG',
      severity: 'CRITICAL',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('should fail when category is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      category: 'INVALID_CATEGORY',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'category')).toBe(true);
  });

  it('should fail when severity is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      severity: 'EXTREME',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'severity')).toBe(true);
  });

  it('should fail when signalType is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      signalType: 'MAGIC_SIGNAL',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'signalType')).toBe(true);
  });

  it('should fail when likelihoodWeight exceeds 100', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      likelihoodWeight: 150,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'likelihoodWeight')).toBe(true);
  });

  it('should fail when likelihoodWeight is negative', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      likelihoodWeight: -5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'likelihoodWeight')).toBe(true);
  });

  it('should fail when scoreContributionModel is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      scoreContributionModel: 'MAGIC_MODEL',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'scoreContributionModel')).toBe(
      true,
    );
  });

  it('should fail when status is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      status: 'DELETED',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('should fail when source is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      source: 'UNKNOWN_SOURCE',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it('should fail when title exceeds max length', async () => {
    const dto = plainToInstance(CreateCustomerRiskCatalogDto, {
      ...validPayload,
      title: 'x'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });
});

describe('UpdateCustomerRiskCatalogDto', () => {
  it('should pass with empty payload (all optional)', async () => {
    const dto = plainToInstance(UpdateCustomerRiskCatalogDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with partial update', async () => {
    const dto = plainToInstance(UpdateCustomerRiskCatalogDto, {
      title: 'Updated Title',
      severity: 'HIGH',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with invalid category', async () => {
    const dto = plainToInstance(UpdateCustomerRiskCatalogDto, {
      category: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateCustomerRiskBindingDto', () => {
  const validBinding = {
    targetType: 'CI',
    targetId: '22222222-2222-2222-2222-222222222222',
  };

  it('should pass with valid payload', async () => {
    const dto = plainToInstance(CreateCustomerRiskBindingDto, validBinding);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with optional fields', async () => {
    const dto = plainToInstance(CreateCustomerRiskBindingDto, {
      ...validBinding,
      scopeMode: 'INHERITED',
      enabled: false,
      notes: 'Applied via class binding',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when targetType is invalid', async () => {
    const dto = plainToInstance(CreateCustomerRiskBindingDto, {
      ...validBinding,
      targetType: 'INVALID_TYPE',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'targetType')).toBe(true);
  });

  it('should fail when targetId is empty', async () => {
    const dto = plainToInstance(CreateCustomerRiskBindingDto, {
      ...validBinding,
      targetId: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'targetId')).toBe(true);
  });

  it('should accept all valid target types', async () => {
    const targetTypes = [
      'CI',
      'CI_CLASS',
      'CMDB_SERVICE',
      'CMDB_OFFERING',
      'ITSM_SERVICE',
    ];
    for (const targetType of targetTypes) {
      const dto = plainToInstance(CreateCustomerRiskBindingDto, {
        ...validBinding,
        targetType,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });

  it('should accept all valid scope modes', async () => {
    const scopeModes = ['DIRECT', 'INHERITED'];
    for (const scopeMode of scopeModes) {
      const dto = plainToInstance(CreateCustomerRiskBindingDto, {
        ...validBinding,
        scopeMode,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });
});

describe('CustomerRiskCatalogFilterDto', () => {
  it('should pass with empty filters', async () => {
    const dto = plainToInstance(CustomerRiskCatalogFilterDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid filters', async () => {
    const dto = plainToInstance(CustomerRiskCatalogFilterDto, {
      status: 'ACTIVE',
      category: 'OS_LIFECYCLE',
      severity: 'CRITICAL',
      signalType: 'STATIC_FLAG',
      source: 'SYSTEM',
      search: 'end-of-support',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with invalid status filter', async () => {
    const dto = plainToInstance(CustomerRiskCatalogFilterDto, {
      status: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CustomerRiskBindingFilterDto', () => {
  it('should pass with empty filters', async () => {
    const dto = plainToInstance(CustomerRiskBindingFilterDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid target type filter', async () => {
    const dto = plainToInstance(CustomerRiskBindingFilterDto, {
      targetType: 'CMDB_SERVICE',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('CustomerRiskObservationFilterDto', () => {
  it('should pass with empty filters', async () => {
    const dto = plainToInstance(CustomerRiskObservationFilterDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with valid filters', async () => {
    const dto = plainToInstance(CustomerRiskObservationFilterDto, {
      status: 'OPEN',
      evidenceType: 'MANUAL',
      targetType: 'CI',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with invalid observation status', async () => {
    const dto = plainToInstance(CustomerRiskObservationFilterDto, {
      status: 'INVALID_STATUS',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
