/**
 * RCA Orchestration Service
 *
 * Orchestrates creating Problem, Known Error, and PIR Action records
 * from MI RCA topology hypotheses. Preserves traceability metadata
 * and writes audit/journal entries.
 *
 * Phase-C, Phase 2: MI RCA → Problem / Known Error / PIR Action.
 */
import {
  Injectable,
  Optional,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TopologyImpactAnalysisService } from './topology-impact-analysis.service';
import { ProblemService } from '../../../problem/problem.service';
import { KnownErrorService } from '../../../known-error/known-error.service';
import { PirService } from '../../../pir/pir.service';
import { PirActionService } from '../../../pir/pir-action.service';
import { JournalService } from '../../../journal/journal.service';
import { JournalType } from '../../../journal/journal.entity';
import { MajorIncidentService } from '../../../major-incident/major-incident.service';
import {
  CreateProblemFromHypothesisDto,
  CreateKnownErrorFromHypothesisDto,
  CreatePirActionFromHypothesisDto,
  RcaTraceabilityMeta,
  RcaOrchestrationResult,
} from './dto/rca-orchestration.dto';
import {
  RcaHypothesis,
  RcaTopologyHypothesesResponse,
} from './dto/topology-impact.dto';
import { ItsmProblem } from '../../../problem/problem.entity';
import { ItsmKnownError } from '../../../known-error/known-error.entity';
import { ItsmPirAction } from '../../../pir/pir-action.entity';
import { ProblemSource } from '../../../enums';
import { CreateKnownErrorDto } from '../../../known-error/dto/create-known-error.dto';
import { CreatePirActionDto } from '../../../pir/dto/create-pir-action.dto';

/** Max journal message length */
const JOURNAL_MESSAGE_CAP = 2000;

@Injectable()
export class RcaOrchestrationService {
  private readonly logger = new Logger(RcaOrchestrationService.name);

  constructor(
    @Optional()
    private readonly topologyImpactService?: TopologyImpactAnalysisService,
    @Optional()
    private readonly problemService?: ProblemService,
    @Optional()
    private readonly knownErrorService?: KnownErrorService,
    @Optional()
    private readonly pirService?: PirService,
    @Optional()
    private readonly pirActionService?: PirActionService,
    @Optional()
    private readonly journalService?: JournalService,
    @Optional()
    private readonly majorIncidentService?: MajorIncidentService,
  ) {}

  // ==========================================================================
  // Create Problem from Hypothesis
  // ==========================================================================

  async createProblemFromHypothesis(
    tenantId: string,
    userId: string,
    dto: CreateProblemFromHypothesisDto,
  ): Promise<RcaOrchestrationResult<ItsmProblem>> {
    if (!this.problemService) {
      throw new BadRequestException(
        'Problem service is not available. Cannot create problem.',
      );
    }

    // Resolve hypothesis
    const hypothesis = await this.resolveHypothesis(
      tenantId,
      dto.majorIncidentId,
      dto.hypothesisId,
    );

    // Build traceability metadata
    const traceability = this.buildTraceability(
      dto.majorIncidentId,
      hypothesis,
    );

    // Build RCA entries from hypothesis evidence
    const rcaEntries = hypothesis.evidence.map((ev, idx) => ({
      type: 'EVIDENCE' as const,
      content: `[${ev.type.replace(/_/g, ' ')}] ${ev.description}${ev.referenceLabel ? ` (Ref: ${ev.referenceLabel})` : ''}`,
      order: idx + 1,
    }));

    // Create the problem
    const problem = await this.problemService.createProblem(tenantId, userId, {
      shortDescription: dto.shortDescription,
      description:
        dto.description ||
        `Created from RCA topology hypothesis: ${hypothesis.explanation}`,
      category: dto.category,
      impact: dto.impact,
      urgency: dto.urgency,
      serviceId: dto.serviceId || null,
      assignmentGroup: dto.assignmentGroup || null,
      source: ProblemSource.POSTMORTEM,
      symptomSummary: hypothesis.explanation,
      rcaEntries: rcaEntries.length > 0 ? rcaEntries : null,
      metadata: {
        rcaTraceability: traceability,
      },
    } as Partial<ItsmProblem>);

    // Write journal entry on the major incident
    await this.writeOrchestrationJournal(
      tenantId,
      userId,
      'major_incidents',
      dto.majorIncidentId,
      `Problem ${problem.number} created from RCA hypothesis "${hypothesis.suspectNodeLabel}" (${hypothesis.type}).`,
    );

    const summary = `Problem ${problem.number} created from hypothesis "${hypothesis.suspectNodeLabel}" (confidence: ${(hypothesis.score * 100).toFixed(0)}%).`;

    return { record: problem, traceability, summary };
  }

  // ==========================================================================
  // Create Known Error from Hypothesis
  // ==========================================================================

  async createKnownErrorFromHypothesis(
    tenantId: string,
    userId: string,
    dto: CreateKnownErrorFromHypothesisDto,
  ): Promise<RcaOrchestrationResult<ItsmKnownError>> {
    if (!this.knownErrorService) {
      throw new BadRequestException(
        'Known Error service is not available. Cannot create known error.',
      );
    }

    // Resolve hypothesis
    const hypothesis = await this.resolveHypothesis(
      tenantId,
      dto.majorIncidentId,
      dto.hypothesisId,
    );

    // Build traceability metadata
    const traceability = this.buildTraceability(
      dto.majorIncidentId,
      hypothesis,
    );

    // Build symptoms from evidence
    const symptomsText =
      dto.symptoms ||
      hypothesis.evidence
        .map(
          (ev) =>
            `[${ev.type.replace(/_/g, ' ')}] ${ev.description}`,
        )
        .join('\n');

    const createDto = new CreateKnownErrorDto();
    createDto.title = dto.title;
    createDto.symptoms = symptomsText || undefined;
    createDto.rootCause =
      dto.rootCause ||
      `Topology hypothesis: ${hypothesis.explanation}`;
    createDto.workaround = dto.workaround;
    createDto.problemId = dto.problemId;

    const knownError = await this.knownErrorService.createKnownError(
      tenantId,
      userId,
      createDto,
    );

    // Persist traceability in metadata
    if (knownError) {
      knownError.metadata = {
        ...(knownError.metadata || {}),
        rcaTraceability: traceability,
      };
      // Save metadata update — we use the service's update if available
      try {
        await this.knownErrorService.updateKnownError(
          tenantId,
          userId,
          knownError.id,
          { metadata: knownError.metadata } as never,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to persist traceability metadata on KE ${knownError.id}: ${String(err)}`,
        );
      }
    }

    // Write journal entry on the major incident
    await this.writeOrchestrationJournal(
      tenantId,
      userId,
      'major_incidents',
      dto.majorIncidentId,
      `Known Error "${knownError.title}" created from RCA hypothesis "${hypothesis.suspectNodeLabel}" (${hypothesis.type}).`,
    );

    const summary = `Known Error "${knownError.title}" created from hypothesis "${hypothesis.suspectNodeLabel}" (confidence: ${(hypothesis.score * 100).toFixed(0)}%).`;

    return { record: knownError, traceability, summary };
  }

  // ==========================================================================
  // Create PIR Action from Hypothesis
  // ==========================================================================

  async createPirActionFromHypothesis(
    tenantId: string,
    userId: string,
    dto: CreatePirActionFromHypothesisDto,
  ): Promise<RcaOrchestrationResult<ItsmPirAction>> {
    if (!this.pirActionService) {
      throw new BadRequestException(
        'PIR Action service is not available. Cannot create PIR action.',
      );
    }

    // Resolve hypothesis
    const hypothesis = await this.resolveHypothesis(
      tenantId,
      dto.majorIncidentId,
      dto.hypothesisId,
    );

    // Verify PIR exists and belongs to this MI
    if (this.pirService) {
      const pir = await this.pirService.findOne(tenantId, dto.pirId);
      if (!pir) {
        throw new NotFoundException(`PIR with ID ${dto.pirId} not found`);
      }
      if (pir.majorIncidentId !== dto.majorIncidentId) {
        throw new BadRequestException(
          `PIR ${dto.pirId} does not belong to Major Incident ${dto.majorIncidentId}`,
        );
      }
    }

    // Build traceability metadata
    const traceability = this.buildTraceability(
      dto.majorIncidentId,
      hypothesis,
    );

    const actionDto = new CreatePirActionDto();
    actionDto.pirId = dto.pirId;
    actionDto.title = dto.title;
    actionDto.description =
      dto.description ||
      `Created from RCA topology hypothesis: ${hypothesis.explanation}`;
    actionDto.priority = dto.priority;
    actionDto.ownerId = dto.ownerId;
    actionDto.dueDate = dto.dueDate;
    actionDto.metadata = {
      rcaTraceability: traceability,
    };

    const pirAction = await this.pirActionService.create(
      tenantId,
      userId,
      actionDto,
    );

    // Write journal entry on the major incident
    await this.writeOrchestrationJournal(
      tenantId,
      userId,
      'major_incidents',
      dto.majorIncidentId,
      `PIR Action "${pirAction.title}" created from RCA hypothesis "${hypothesis.suspectNodeLabel}" (${hypothesis.type}).`,
    );

    const summary = `PIR Action "${pirAction.title}" created from hypothesis "${hypothesis.suspectNodeLabel}" (confidence: ${(hypothesis.score * 100).toFixed(0)}%).`;

    return { record: pirAction, traceability, summary };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Resolve an RCA hypothesis by re-generating hypotheses for the MI
   * and finding the matching hypothesis by ID. This ensures the
   * hypothesis data is fresh and valid.
   */
  private async resolveHypothesis(
    tenantId: string,
    majorIncidentId: string,
    hypothesisId: string,
  ): Promise<RcaHypothesis> {
    if (!this.majorIncidentService || !this.topologyImpactService) {
      throw new BadRequestException(
        'Required services are not available. Cannot resolve hypothesis.',
      );
    }

    const mi = await this.majorIncidentService.findOne(
      tenantId,
      majorIncidentId,
    );
    if (!mi) {
      throw new NotFoundException(
        `Major Incident ${majorIncidentId} not found`,
      );
    }

    // Regenerate hypotheses to get fresh data
    let rcaResult: RcaTopologyHypothesesResponse;
    try {
      rcaResult = await this.topologyImpactService.generateRcaHypotheses(
        tenantId,
        mi,
      );
    } catch (err) {
      throw new BadRequestException(
        `Failed to generate RCA hypotheses for MI ${majorIncidentId}: ${String(err)}`,
      );
    }

    const hypothesis = rcaResult.hypotheses.find(
      (h) => h.id === hypothesisId,
    );
    if (!hypothesis) {
      throw new NotFoundException(
        `Hypothesis "${hypothesisId}" not found for Major Incident ${majorIncidentId}. ` +
          `Available hypothesis IDs: ${rcaResult.hypotheses.map((h) => h.id).join(', ') || 'none'}`,
      );
    }

    return hypothesis;
  }

  /**
   * Build traceability metadata for a created record.
   */
  private buildTraceability(
    majorIncidentId: string,
    hypothesis: RcaHypothesis,
  ): RcaTraceabilityMeta {
    return {
      sourceType: 'TOPOLOGY_RCA_HYPOTHESIS',
      sourceHypothesisId: hypothesis.id,
      sourceMajorIncidentId: majorIncidentId,
      suspectNodeLabel: hypothesis.suspectNodeLabel,
      suspectNodeType: hypothesis.suspectNodeType,
      hypothesisType: hypothesis.type,
      hypothesisScore: hypothesis.score,
    };
  }

  /**
   * Write a journal/audit entry for an orchestration action.
   * Non-blocking: errors are logged but don't fail the operation.
   */
  private async writeOrchestrationJournal(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    message: string,
  ): Promise<void> {
    if (!this.journalService) return;

    try {
      await this.journalService.createJournalEntry(
        tenantId,
        userId,
        entityType,
        entityId,
        {
          type: JournalType.WORK_NOTE,
          message: message.slice(0, JOURNAL_MESSAGE_CAP),
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to write orchestration journal entry: ${String(err)}`,
      );
    }
  }
}
