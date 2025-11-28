import { ApiProperty } from '@nestjs/swagger';

export class DashboardOverviewDto {
  @ApiProperty({ example: '217492b2-f814-4ba0-ae50-4e4f8ecf6216' })
  tenantId!: string;

  @ApiProperty({
    example: {
      standards: 3,
      clauses: 400,
      controls: 150,
      risks: 300,
      mappings: 200,
      policies: 5,
      requirements: 10,
      riskCatalog: 50,
      riskInstances: 20,
      entityTypes: 8,
    },
  })
  dataFoundations!: {
    standards: number;
    clauses: number;
    clausesSynthetic?: number;
    controls: number;
    risks: number;
    mappings: number;
    mappingsSynthetic?: number;
    policies?: number;
    requirements?: number;
    riskCatalog?: number;
    riskInstances?: number;
    entityTypes?: number;
  };

  @ApiProperty({ example: { status: 'ok', time: '2024-01-01T00:00:00.000Z' } })
  health!: {
    status: 'ok' | 'degraded';
    time: string;
  };
}
