import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  IncidentAiAnalysis,
  AnalysisStatus,
  ConfidenceLevel,
} from './incident-ai-analysis.entity';
import { ItsmIncident } from './incident.entity';
import { AiAdminService } from '../../ai-admin/ai-admin.service';
import { ToolGatewayService } from '../../tool-gateway/tool-gateway.service';
import { AiActionType, AiAuditStatus } from '../../ai-admin/entities';
import { AiFeatureKey } from '../../ai-admin/entities/ai-feature-policy.entity';
import { IncidentPriority, IncidentStatus, IncidentImpact } from '../enums';
import { AnalyzeIncidentDto } from './dto/analyze-incident.dto';

/** Maximum lengths for bounded content */
const MAX_SUMMARY_LENGTH = 2000;
const MAX_CUSTOMER_DRAFT_LENGTH = 2000;
const MAX_IMPACT_LENGTH = 1000;
const MAX_ACTIONS = 20;
const MAX_TASKS = 15;
const MAX_SN_RECORD_CHARS = 3000;

/**
 * Structured analysis result returned to the API/UI layer
 */
export interface CopilotAnalysisResult {
  analysisId: string;
  incidentId: string;
  status: AnalysisStatus;
  providerType: string;
  modelName: string | null;
  confidence: ConfidenceLevel;
  summary: string | null;
  recommendedActions: Array<{
    action: string;
    severity?: string;
    category?: string;
    isDraft?: boolean;
  }> | null;
  customerUpdateDraft: string | null;
  proposedTasks: Array<{
    title: string;
    description?: string;
    assignmentGroup?: string;
    priority?: string;
  }> | null;
  similarIncidents: Array<{
    id?: string;
    number?: string;
    shortDescription?: string;
    resolutionSummary?: string;
    similarity?: number;
  }> | null;
  impactAssessment: string | null;
  explainability: {
    dataSources: string[];
    assumptions: string[];
    confidence: ConfidenceLevel;
    toolCallCount: number;
    toolKeysUsed: string[];
  };
  createdAt: Date;
  error?: string;
}

@Injectable()
export class IncidentCopilotService {
  private readonly logger = new Logger(IncidentCopilotService.name);

  constructor(
    @InjectRepository(IncidentAiAnalysis)
    private readonly analysisRepo: Repository<IncidentAiAnalysis>,
    @InjectRepository(ItsmIncident)
    private readonly incidentRepo: Repository<ItsmIncident>,
    private readonly aiAdminService: AiAdminService,
    private readonly toolGatewayService: ToolGatewayService,
  ) {}

  /**
   * Run AI analysis on an incident.
   * Gated by tenant AI policy + feature policy + tool policy.
   */
  async analyzeIncident(
    tenantId: string,
    incidentId: string,
    userId: string | null,
    dto: AnalyzeIncidentDto,
  ): Promise<CopilotAnalysisResult> {
    const startTime = Date.now();
    const toolKeysUsed: string[] = [];
    let toolCallCount = 0;

    // 1. Load incident from our DB (local source of truth)
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId, tenantId, isDeleted: false },
    });
    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    // 2. Resolve AI policy
    const aiConfig = await this.aiAdminService.resolveEffectiveConfig(
      tenantId,
      AiFeatureKey.INCIDENT_COPILOT,
    );

    if (!aiConfig.isAiEnabled) {
      return this.persistAndReturnError(
        tenantId,
        incidentId,
        userId,
        'AI_DISABLED',
        'AI is disabled for this tenant. Enable it in AI Control Center.',
        startTime,
      );
    }

    if (!aiConfig.isFeatureEnabled) {
      return this.persistAndReturnError(
        tenantId,
        incidentId,
        userId,
        'FEATURE_DISABLED',
        'Incident Copilot feature is not enabled. Enable INCIDENT_COPILOT in AI feature policies.',
        startTime,
      );
    }

    // 3. Resolve tools policy
    const toolStatus = await this.toolGatewayService.getToolStatus(tenantId);

    // 4. Build context gathering plan
    const dataSources: string[] = ['LOCAL_INCIDENT'];
    const assumptions: string[] = [];
    let snIncidentData: Record<string, unknown> | null = null;
    let snChangesData: Array<Record<string, unknown>> | null = null;

    // Always have local incident fields
    const localContext = this.extractLocalContext(incident);

    // Try ServiceNow enrichment if tools are enabled and SN is configured
    const externalSysId = dto.externalSysId || this.extractExternalId(incident);

    if (
      toolStatus.isToolsEnabled &&
      toolStatus.hasServiceNowProvider &&
      externalSysId
    ) {
      // Try to get SN incident record
      if (toolStatus.availableTools.includes('SERVICENOW_GET_RECORD')) {
        try {
          const snResult = await this.toolGatewayService.runTool(
            tenantId,
            userId,
            {
              toolKey: 'SERVICENOW_GET_RECORD',
              input: {
                table: 'incident',
                sys_id: externalSysId,
                fields: [
                  'number',
                  'short_description',
                  'description',
                  'state',
                  'priority',
                  'impact',
                  'urgency',
                  'category',
                  'assignment_group',
                  'assigned_to',
                  'cmdb_ci',
                  'business_service',
                  'resolved_at',
                  'close_notes',
                  'work_notes_list',
                  'sys_created_on',
                  'sys_updated_on',
                ],
              },
            },
          );
          if (snResult.success && snResult.data) {
            const rawData = snResult.data as {
              record?: Record<string, unknown>;
            };
            snIncidentData = this.truncateRecord(
              (rawData.record as Record<string, unknown>) ?? {},
            );
            dataSources.push('SERVICENOW_INCIDENT');
            toolKeysUsed.push('SERVICENOW_GET_RECORD');
            toolCallCount++;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to fetch SN incident record: ${err instanceof Error ? err.message : 'unknown'}`,
          );
          assumptions.push('ServiceNow incident record could not be retrieved');
        }
      }

      // Try to get related changes (using CMDB CI from the SN incident, not the incident sys_id)
      const snCmdbCi = snIncidentData?.['cmdb_ci'] as string | undefined;
      if (
        dto.depth !== 'quick' &&
        toolStatus.availableTools.includes('SERVICENOW_QUERY_CHANGES') &&
        snCmdbCi
      ) {
        try {
          const changesResult = await this.toolGatewayService.runTool(
            tenantId,
            userId,
            {
              toolKey: 'SERVICENOW_QUERY_CHANGES',
              input: {
                query: `cmdb_ci=${snCmdbCi}`,
                limit: 5,
                fields: [
                  'number',
                  'short_description',
                  'state',
                  'type',
                  'risk',
                  'start_date',
                  'end_date',
                ],
              },
            },
          );
          if (changesResult.success && changesResult.data) {
            const raw = changesResult.data as {
              result?: Array<Record<string, unknown>>;
            };
            snChangesData = Array.isArray(raw.result)
              ? raw.result.slice(0, 5)
              : [];
            if (snChangesData.length > 0) {
              dataSources.push('SERVICENOW_CHANGES');
              toolKeysUsed.push('SERVICENOW_QUERY_CHANGES');
            }
            toolCallCount++;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to fetch SN changes: ${err instanceof Error ? err.message : 'unknown'}`,
          );
          assumptions.push('ServiceNow change records could not be retrieved');
        }
      }
    } else if (!toolStatus.isToolsEnabled) {
      assumptions.push(
        'External tools are disabled — analysis based on local data only',
      );
    } else if (!toolStatus.hasServiceNowProvider) {
      assumptions.push(
        'No ServiceNow provider configured — analysis based on local data only',
      );
    } else if (!externalSysId) {
      assumptions.push(
        'No external ServiceNow reference found for this incident',
      );
    }

    // 5. Generate analysis (deterministic template-based for v1, AI provider call for v1.1+)
    const analysis = this.generateAnalysis(
      incident,
      localContext,
      snIncidentData,
      snChangesData,
      dataSources,
      assumptions,
      dto,
    );

    // 6. Compute hashes
    const requestInput = JSON.stringify({
      incidentId,
      tenantId,
      depth: dto.depth,
      tone: dto.tone,
      dataSources,
    });
    const requestHash = createHash('sha256').update(requestInput).digest('hex');
    const responseHash = createHash('sha256')
      .update(JSON.stringify(analysis))
      .digest('hex');

    const latencyMs = Date.now() - startTime;

    // 7. Persist snapshot
    const snapshot = this.analysisRepo.create({
      tenantId,
      incidentId,
      providerType: aiConfig.providerType || 'LOCAL',
      modelName: aiConfig.modelName,
      status: AnalysisStatus.SUCCESS,
      inputsMeta: {
        incidentRef: incident.id,
        incidentNumber: incident.number,
        timeframe: new Date().toISOString(),
        toolKeysUsed,
        toolCallCount,
      },
      evidenceMeta: {
        serviceNowIncidentSysId: externalSysId || undefined,
        similarIncidentCount: analysis.similarIncidents?.length ?? 0,
      },
      summaryText: analysis.summary,
      recommendedActions: analysis.recommendedActions,
      customerUpdateDraft: analysis.customerUpdateDraft,
      proposedTasks: analysis.proposedTasks,
      similarIncidents: analysis.similarIncidents,
      impactAssessment: analysis.impactAssessment,
      confidence: analysis.confidence,
      assumptions: [...assumptions, ...analysis.assumptions],
      usedDataSources: dataSources,
      requestHash,
      responseHash,
      latencyMs,
      userId,
    });

    const saved = await this.analysisRepo.save(snapshot);

    // 8. Log audit event
    await this.aiAdminService.logAuditEvent({
      tenantId,
      userId,
      featureKey: AiFeatureKey.INCIDENT_COPILOT,
      providerType: aiConfig.providerType || 'LOCAL',
      modelName: aiConfig.modelName ?? undefined,
      actionType: AiActionType.ANALYZE,
      status: AiAuditStatus.SUCCESS,
      latencyMs,
      requestHash,
      responseHash,
      details: `Incident ${incident.number} analyzed. Sources: ${dataSources.join(', ')}. Tool calls: ${toolCallCount}.`,
    });

    return this.toResult(saved);
  }

  /**
   * List analysis snapshots for an incident
   */
  async listAnalyses(
    tenantId: string,
    incidentId: string,
    options?: { page?: number; pageSize?: number },
  ): Promise<{ items: CopilotAnalysisResult[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = Math.min(options?.pageSize ?? 10, 50);

    const [items, total] = await this.analysisRepo.findAndCount({
      where: { tenantId, incidentId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((i) => this.toResult(i)),
      total,
    };
  }

  /**
   * Get a single analysis by ID
   */
  async getAnalysis(
    tenantId: string,
    incidentId: string,
    analysisId: string,
  ): Promise<CopilotAnalysisResult> {
    const analysis = await this.analysisRepo.findOne({
      where: { id: analysisId, tenantId, incidentId },
    });
    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }
    return this.toResult(analysis);
  }

  /**
   * Get copilot status for an incident (policy status + last analysis)
   */
  async getCopilotStatus(tenantId: string, incidentId: string) {
    const aiConfig = await this.aiAdminService.resolveEffectiveConfig(
      tenantId,
      AiFeatureKey.INCIDENT_COPILOT,
    );
    const toolStatus = await this.toolGatewayService.getToolStatus(tenantId);

    const lastAnalysis = await this.analysisRepo.findOne({
      where: { tenantId, incidentId },
      order: { createdAt: 'DESC' },
    });

    return {
      isAiEnabled: aiConfig.isAiEnabled,
      isFeatureEnabled: aiConfig.isFeatureEnabled,
      providerType: aiConfig.providerType,
      modelName: aiConfig.modelName,
      humanApprovalRequired: aiConfig.humanApprovalRequired,
      isToolsEnabled: toolStatus.isToolsEnabled,
      hasServiceNowProvider: toolStatus.hasServiceNowProvider,
      availableTools: toolStatus.availableTools,
      lastAnalysis: lastAnalysis
        ? {
            id: lastAnalysis.id,
            status: lastAnalysis.status,
            confidence: lastAnalysis.confidence,
            createdAt: lastAnalysis.createdAt,
          }
        : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════

  private extractLocalContext(incident: ItsmIncident): Record<string, unknown> {
    return {
      id: incident.id,
      number: incident.number,
      shortDescription: incident.shortDescription,
      description: incident.description,
      category: incident.category,
      impact: incident.impact,
      urgency: incident.urgency,
      priority: incident.priority,
      status: incident.status,
      source: incident.source,
      assignmentGroup: incident.assignmentGroup,
      relatedService: incident.relatedService,
      serviceId: incident.serviceId,
      offeringId: incident.offeringId,
      firstResponseAt: incident.firstResponseAt,
      resolvedAt: incident.resolvedAt,
      resolutionNotes: incident.resolutionNotes,
      createdAt: incident.createdAt,
    };
  }

  private extractExternalId(incident: ItsmIncident): string | null {
    const meta = incident.metadata;
    if (meta?.externalId && typeof meta.externalId === 'string') {
      return meta.externalId;
    }
    if (meta?.servicenowSysId && typeof meta.servicenowSysId === 'string') {
      return meta.servicenowSysId;
    }
    return null;
  }

  private truncateRecord(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const truncated: Record<string, unknown> = {};
    let totalChars = 0;
    for (const [key, value] of Object.entries(data)) {
      if (totalChars >= MAX_SN_RECORD_CHARS) break;
      const strVal = typeof value === 'string' ? value : JSON.stringify(value);
      const bounded = strVal.substring(0, 500);
      truncated[key] = bounded;
      totalChars += bounded.length;
    }
    return truncated;
  }

  /**
   * Generate analysis from available context.
   * V1 uses deterministic template-based generation.
   * Future versions will call the AI provider.
   */
  private generateAnalysis(
    incident: ItsmIncident,
    localContext: Record<string, unknown>,
    snData: Record<string, unknown> | null,
    snChanges: Array<Record<string, unknown>> | null,
    dataSources: string[],
    existingAssumptions: string[],
    dto: AnalyzeIncidentDto,
  ): {
    summary: string;
    recommendedActions: Array<{
      action: string;
      severity?: string;
      category?: string;
      isDraft?: boolean;
    }>;
    customerUpdateDraft: string;
    proposedTasks: Array<{
      title: string;
      description?: string;
      assignmentGroup?: string;
      priority?: string;
    }>;
    similarIncidents: Array<{
      id?: string;
      number?: string;
      shortDescription?: string;
      similarity?: number;
    }>;
    impactAssessment: string;
    confidence: ConfidenceLevel;
    assumptions: string[];
  } {
    const tone = dto.tone || 'professional';
    const assumptions: string[] = [];

    // Determine confidence based on available data
    let confidence = ConfidenceLevel.LOW;
    if (snData) {
      confidence = ConfidenceLevel.MEDIUM;
      if (snChanges && snChanges.length > 0) {
        confidence = ConfidenceLevel.HIGH;
      }
    }

    // Executive summary
    const priorityLabel = incident.priority || 'Unknown';
    const statusLabel = incident.status || 'Unknown';
    const categoryLabel = incident.category || 'Uncategorized';
    const snExtra = snData
      ? ` ServiceNow data available for cross-reference.`
      : ' No ServiceNow data available — analysis based on local records only.';

    const summary = this.truncateText(
      `Incident ${incident.number} (${priorityLabel}) — ${incident.shortDescription}.\n\n` +
        `Status: ${statusLabel} | Category: ${categoryLabel} | Impact: ${incident.impact} | Urgency: ${incident.urgency}.\n` +
        `${incident.description ? `Description: ${incident.description.substring(0, 500)}` : 'No detailed description provided.'}\n` +
        `${incident.assignmentGroup ? `Assignment Group: ${incident.assignmentGroup}` : 'Not yet assigned to a group.'}` +
        snExtra,
      MAX_SUMMARY_LENGTH,
    );

    if (!incident.description) {
      assumptions.push(
        'No detailed description provided — recommendations are based on limited information',
      );
    }

    // Triage checklist (recommended actions)
    const recommendedActions = this.buildTriageChecklist(
      incident,
      snData,
      snChanges,
    );

    // Customer update draft
    const customerUpdateDraft = this.truncateText(
      this.buildCustomerDraft(incident, tone),
      MAX_CUSTOMER_DRAFT_LENGTH,
    );

    // Proposed internal tasks
    const proposedTasks = this.buildProposedTasks(incident, snData);

    // Impact assessment
    const impactAssessment = this.truncateText(
      this.buildImpactAssessment(incident, snData, snChanges),
      MAX_IMPACT_LENGTH,
    );

    return {
      summary,
      recommendedActions: recommendedActions.slice(0, MAX_ACTIONS),
      customerUpdateDraft,
      proposedTasks: proposedTasks.slice(0, MAX_TASKS),
      similarIncidents: [], // V1: populated only when SN query_incidents is used
      impactAssessment,
      confidence,
      assumptions,
    };
  }

  private buildTriageChecklist(
    incident: ItsmIncident,
    snData: Record<string, unknown> | null,
    snChanges: Array<Record<string, unknown>> | null,
  ): Array<{
    action: string;
    severity?: string;
    category?: string;
    isDraft?: boolean;
  }> {
    const actions: Array<{
      action: string;
      severity?: string;
      category?: string;
      isDraft?: boolean;
    }> = [];

    // Priority-based actions
    if (
      incident.priority === IncidentPriority.P1 ||
      incident.priority === IncidentPriority.P2
    ) {
      actions.push({
        action:
          'Escalate to incident commander — high priority incident requires immediate attention',
        severity: 'CRITICAL',
        category: 'ESCALATION',
      });
      actions.push({
        action: 'Notify affected stakeholders and management',
        severity: 'HIGH',
        category: 'COMMUNICATION',
      });
    }

    // Assignment check
    if (!incident.assignmentGroup && !incident.assignedTo) {
      actions.push({
        action: 'Assign incident to appropriate support group',
        severity: 'HIGH',
        category: 'ASSIGNMENT',
      });
    }

    // Category-based actions
    actions.push({
      action: `Review ${incident.category || 'general'} troubleshooting runbooks`,
      severity: 'MEDIUM',
      category: 'INVESTIGATION',
    });

    // Service impact check
    if (incident.serviceId || incident.relatedService) {
      actions.push({
        action: 'Verify service health and check for wider service degradation',
        severity: 'MEDIUM',
        category: 'INVESTIGATION',
      });
    }

    // SN-enriched actions
    if (snData) {
      const cmdbCi = snData['cmdb_ci'] as string | undefined;
      if (cmdbCi) {
        actions.push({
          action: `Check CMDB CI (${cmdbCi}) for recent changes and known issues`,
          severity: 'MEDIUM',
          category: 'INVESTIGATION',
        });
      }
    }

    if (snChanges && snChanges.length > 0) {
      actions.push({
        action: `Review ${snChanges.length} recent change(s) that may be related to this incident`,
        severity: 'HIGH',
        category: 'ROOT_CAUSE',
      });
    }

    // Standard checklist items
    actions.push({
      action: 'Document investigation steps and findings in work notes',
      severity: 'LOW',
      category: 'DOCUMENTATION',
    });

    actions.push({
      action: 'Prepare customer communication with current status update',
      severity: 'MEDIUM',
      category: 'COMMUNICATION',
    });

    if (
      incident.status === IncidentStatus.RESOLVED ||
      incident.status === IncidentStatus.CLOSED
    ) {
      actions.push({
        action: 'Consider creating a problem record for root cause analysis',
        severity: 'LOW',
        category: 'FOLLOW_UP',
        isDraft: true,
      });
    }

    return actions;
  }

  private buildCustomerDraft(incident: ItsmIncident, tone: string): string {
    const greeting =
      tone === 'calm'
        ? 'We understand this situation is important to you.'
        : tone === 'transparent'
          ? 'We want to provide you with a clear and honest update.'
          : 'Thank you for reporting this issue.';

    const statusLine = (() => {
      switch (incident.status) {
        case IncidentStatus.OPEN:
          return 'Your incident has been received and is being reviewed by our support team.';
        case IncidentStatus.IN_PROGRESS:
          return 'Our team is actively working on resolving this issue.';
        case IncidentStatus.RESOLVED:
          return 'We believe this issue has been resolved. Please verify on your end.';
        case IncidentStatus.CLOSED:
          return 'This incident has been closed. If you experience further issues, please open a new ticket.';
        default:
          return 'Your incident is being tracked and we will provide updates as progress is made.';
      }
    })();

    return (
      `Subject: Update on ${incident.number} — ${incident.shortDescription}\n\n` +
      `${greeting}\n\n` +
      `${statusLine}\n\n` +
      `Incident: ${incident.number}\n` +
      `Priority: ${incident.priority}\n` +
      `Category: ${incident.category || 'General'}\n\n` +
      `We will continue to keep you informed of any developments. ` +
      `If you have additional information that may help us investigate, please reply to this update.\n\n` +
      `[DRAFT — Review and adjust before sending]`
    );
  }

  private buildProposedTasks(
    incident: ItsmIncident,
    snData: Record<string, unknown> | null,
  ): Array<{
    title: string;
    description?: string;
    assignmentGroup?: string;
    priority?: string;
  }> {
    const tasks: Array<{
      title: string;
      description?: string;
      assignmentGroup?: string;
      priority?: string;
    }> = [];

    tasks.push({
      title: `Initial investigation for ${incident.number}`,
      description: `Investigate root cause of: ${incident.shortDescription}`,
      assignmentGroup: incident.assignmentGroup || undefined,
      priority: incident.priority,
    });

    if (
      incident.impact === IncidentImpact.HIGH ||
      incident.priority === IncidentPriority.P1
    ) {
      tasks.push({
        title: `Emergency workaround for ${incident.number}`,
        description:
          'Identify and implement temporary workaround to restore service',
        priority: 'P1',
      });
    }

    tasks.push({
      title: `Customer communication for ${incident.number}`,
      description:
        'Draft and send customer-facing update about incident status',
      priority: incident.priority === IncidentPriority.P1 ? 'P1' : 'P3',
    });

    if (snData) {
      tasks.push({
        title: `Cross-reference ServiceNow data for ${incident.number}`,
        description:
          'Review ServiceNow incident record for additional context and history',
        priority: 'P3',
      });
    }

    tasks.push({
      title: `Post-resolution review for ${incident.number}`,
      description: 'Document lessons learned and update knowledge base',
      priority: 'P4',
      isDraft: true,
    } as {
      title: string;
      description?: string;
      assignmentGroup?: string;
      priority?: string;
    });

    return tasks;
  }

  private buildImpactAssessment(
    incident: ItsmIncident,
    snData: Record<string, unknown> | null,
    snChanges: Array<Record<string, unknown>> | null,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Impact Level: ${incident.impact} | Urgency: ${incident.urgency} | Priority: ${incident.priority}`,
    );

    if (incident.relatedService || incident.serviceId) {
      parts.push(
        `Affected Service: ${incident.relatedService || incident.serviceId}`,
      );
    }

    if (snData) {
      const businessService = snData['business_service'] as string | undefined;
      if (businessService) {
        parts.push(`Business Service (SN): ${businessService}`);
      }
      const cmdbCi = snData['cmdb_ci'] as string | undefined;
      if (cmdbCi) {
        parts.push(`Configuration Item (SN): ${cmdbCi}`);
      }
    }

    if (snChanges && snChanges.length > 0) {
      parts.push(
        `Related Changes: ${snChanges.length} recent change(s) found that may be contributing factors`,
      );
    }

    return parts.join('\n');
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private async persistAndReturnError(
    tenantId: string,
    incidentId: string,
    userId: string | null,
    errorCode: string,
    userSafeError: string,
    startTime: number,
  ): Promise<CopilotAnalysisResult> {
    const latencyMs = Date.now() - startTime;

    const snapshot = this.analysisRepo.create({
      tenantId,
      incidentId,
      providerType: 'N/A',
      modelName: null,
      status: AnalysisStatus.FAIL,
      confidence: ConfidenceLevel.LOW,
      errorCode,
      userSafeError,
      latencyMs,
      userId,
      usedDataSources: [],
      assumptions: [],
    });

    const saved = await this.analysisRepo.save(snapshot);

    // Log audit event for failed analysis
    await this.aiAdminService.logAuditEvent({
      tenantId,
      userId,
      featureKey: AiFeatureKey.INCIDENT_COPILOT,
      providerType: 'N/A',
      actionType: AiActionType.ANALYZE,
      status: AiAuditStatus.FAIL,
      latencyMs,
      details: `Analysis blocked: ${errorCode} — ${userSafeError}`,
    });

    return this.toResult(saved);
  }

  private toResult(entity: IncidentAiAnalysis): CopilotAnalysisResult {
    return {
      analysisId: entity.id,
      incidentId: entity.incidentId,
      status: entity.status,
      providerType: entity.providerType,
      modelName: entity.modelName,
      confidence: entity.confidence,
      summary: entity.summaryText,
      recommendedActions: entity.recommendedActions,
      customerUpdateDraft: entity.customerUpdateDraft,
      proposedTasks: entity.proposedTasks,
      similarIncidents: entity.similarIncidents,
      impactAssessment: entity.impactAssessment,
      explainability: {
        dataSources: entity.usedDataSources || [],
        assumptions: entity.assumptions || [],
        confidence: entity.confidence,
        toolCallCount: entity.inputsMeta?.toolCallCount ?? 0,
        toolKeysUsed: entity.inputsMeta?.toolKeysUsed ?? [],
      },
      createdAt: entity.createdAt,
      error: entity.userSafeError || undefined,
    };
  }
}
