import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// Risk Theme Enum
// ============================================================================

export enum RiskTheme {
  PATCHING = 'PATCHING',
  ACCESS = 'ACCESS',
  BACKUP = 'BACKUP',
  END_OF_SUPPORT = 'END_OF_SUPPORT',
  VULNERABILITY = 'VULNERABILITY',
  CERTIFICATE = 'CERTIFICATE',
  NETWORK_EXPOSURE = 'NETWORK_EXPOSURE',
  CONFIGURATION = 'CONFIGURATION',
  COMPLIANCE = 'COMPLIANCE',
  AVAILABILITY = 'AVAILABILITY',
  DATA_PROTECTION = 'DATA_PROTECTION',
  GENERAL = 'GENERAL',
}

// ============================================================================
// Suggested Record Types
// ============================================================================

export enum SuggestedRecordType {
  CHANGE = 'CHANGE',
  CAPA = 'CAPA',
  CONTROL_TEST = 'CONTROL_TEST',
  TASK = 'TASK',
}

export enum MitigationTimeframe {
  IMMEDIATE = 'IMMEDIATE',
  SHORT_TERM = 'SHORT_TERM',
  PERMANENT = 'PERMANENT',
  VERIFICATION = 'VERIFICATION',
}

// ============================================================================
// Advisory Result Shape (Response DTOs)
// ============================================================================

export interface AffectedServiceInfo {
  id: string;
  name: string;
  type: 'service' | 'ci';
  className?: string;
  lifecycle?: string;
  environment?: string;
  criticality?: string;
}

export interface TopologyImpactSummary {
  totalDependencies: number;
  upstreamCount: number;
  downstreamCount: number;
  serviceCount: number;
  criticalPathNodes: string[];
  summary: string;
}

export interface MitigationAction {
  id: string;
  title: string;
  description: string;
  timeframe: MitigationTimeframe;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedRecordType: SuggestedRecordType;
  templateData: Record<string, unknown>;
}

export interface ExplainabilityEntry {
  signal: string;
  source: string;
  contribution: string;
  detail?: string;
}

export interface SuggestedRecord {
  id: string;
  type: SuggestedRecordType;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timeframe: MitigationTimeframe;
  templateData: Record<string, unknown>;
}

export interface AdvisoryResult {
  id: string;
  riskId: string;
  analyzedAt: string;
  summary: string;
  riskTheme: RiskTheme;
  confidence: number;
  affectedServices: AffectedServiceInfo[];
  affectedCis: AffectedServiceInfo[];
  topologyImpactSummary: TopologyImpactSummary | null;
  mitigationPlan: {
    immediateActions: MitigationAction[];
    shortTermActions: MitigationAction[];
    permanentActions: MitigationAction[];
    verificationSteps: MitigationAction[];
  };
  suggestedRecords: SuggestedRecord[];
  explainability: ExplainabilityEntry[];
  warnings: string[];
  assumptions: string[];
}

// ============================================================================
// Request DTOs
// ============================================================================

export class AnalyzeRiskAdvisoryDto {
  @IsOptional()
  @IsBoolean()
  includeCmdbTopology?: boolean;

  @IsOptional()
  @IsBoolean()
  includeLinkedEntities?: boolean;
}

export class CreateDraftItem {
  @IsString()
  suggestedRecordId: string;

  @IsEnum(SuggestedRecordType)
  type: SuggestedRecordType;

  @IsOptional()
  @IsString()
  titleOverride?: string;

  @IsOptional()
  @IsString()
  descriptionOverride?: string;
}

export class CreateDraftsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDraftItem)
  selectedItems: CreateDraftItem[];

  @IsOptional()
  @IsUUID()
  advisoryId?: string;
}

// ============================================================================
// Draft Creation Result
// ============================================================================

export type DraftCreationStatus = 'created' | 'failed' | 'skipped';

export interface DraftCreationResultItem {
  suggestedRecordId: string;
  /** The type as requested by the frontend (e.g. TASK, CAPA) */
  requestedType: SuggestedRecordType;
  /** The actual target type used for creation (e.g. TASK -> CAPA) */
  resolvedTargetType: SuggestedRecordType;
  status: DraftCreationStatus;
  createdRecordId?: string;
  createdRecordCode?: string;
  /** User-safe error message suitable for display in UI */
  userSafeMessage?: string;
  /** Technical error detail (for logs / collapsible UI) */
  technicalMessage?: string;
  /** Error code for programmatic handling */
  errorCode?: string;
  linkToRisk: boolean;

  // Legacy compat fields — kept for backward compatibility with existing frontend
  /** @deprecated Use requestedType instead */
  type: SuggestedRecordType;
  /** @deprecated Use status === 'created' instead */
  success: boolean;
  /** @deprecated Use userSafeMessage instead */
  error?: string;
}

export interface CreateDraftsResult {
  totalRequested: number;
  totalCreated: number;
  totalFailed: number;
  totalSkipped: number;
  results: DraftCreationResultItem[];
}
