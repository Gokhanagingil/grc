/**
 * RCA Hypothesis Decision Service
 *
 * Manages hypothesis status decisions (accept/reject/investigate),
 * analyst notes, selected hypothesis tracking, and audit trail.
 *
 * Storage: In-memory Map keyed by `tenantId:majorIncidentId`.
 * Decisions are ephemeral per-server lifecycle (no DB entity needed
 * for Phase C MVP). If persistence is needed later, swap to TypeORM entity.
 *
 * Phase C: MI RCA Actions & Evidence
 */
import { Injectable, Optional, Logger } from '@nestjs/common';
import { EventBusService } from '../../../../event-bus/event-bus.service';
import { JournalService } from '../../../journal/journal.service';
import { JournalType } from '../../../journal/journal.entity';
import {
  HypothesisDecisionStatus,
  UpdateHypothesisDecisionDto,
  AddHypothesisNoteDto,
  SetSelectedHypothesisDto,
  HypothesisDecisionResponse,
  HypothesisNoteResponse,
  RcaDecisionsSummaryResponse,
} from './dto/rca-hypothesis-decision.dto';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Internal storage types
// ---------------------------------------------------------------------------

interface StoredNote {
  id: string;
  content: string;
  noteType: string;
  createdBy: string;
  createdAt: Date;
}

interface StoredDecision {
  hypothesisId: string;
  status: HypothesisDecisionStatus;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  notes: StoredNote[];
}

interface MiDecisionState {
  majorIncidentId: string;
  tenantId: string;
  decisions: Map<string, StoredDecision>;
  selectedHypothesisId: string | null;
  selectedReason: string | null;
  selectedBy: string | null;
  selectedAt: Date | null;
}

/** Max journal message length */
const JOURNAL_MESSAGE_CAP = 2000;

/** Max notes per hypothesis */
const MAX_NOTES_PER_HYPOTHESIS = 50;

/** Event source identifier */
const EVENT_SOURCE = 'itsm.rca_hypothesis_decision';

@Injectable()
export class RcaHypothesisDecisionService {
  private readonly logger = new Logger(RcaHypothesisDecisionService.name);

  /**
   * In-memory store: key = `${tenantId}:${majorIncidentId}`
   */
  private readonly store = new Map<string, MiDecisionState>();

  constructor(
    @Optional() private readonly eventBusService?: EventBusService,
    @Optional() private readonly journalService?: JournalService,
  ) {}

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the full decisions summary for a major incident.
   */
  getDecisionsSummary(
    tenantId: string,
    majorIncidentId: string,
  ): RcaDecisionsSummaryResponse {
    const state = this.getOrCreateState(tenantId, majorIncidentId);
    const decisions = this.buildDecisionResponses(state);

    let acceptedCount = 0;
    let rejectedCount = 0;
    let investigatingCount = 0;
    let pendingCount = 0;

    for (const d of decisions) {
      switch (d.status) {
        case HypothesisDecisionStatus.ACCEPTED:
          acceptedCount++;
          break;
        case HypothesisDecisionStatus.REJECTED:
          rejectedCount++;
          break;
        case HypothesisDecisionStatus.NEEDS_INVESTIGATION:
          investigatingCount++;
          break;
        default:
          pendingCount++;
          break;
      }
    }

    return {
      majorIncidentId,
      decisions,
      selectedHypothesisId: state.selectedHypothesisId,
      selectedReason: state.selectedReason,
      selectedBy: state.selectedBy,
      selectedAt: state.selectedAt?.toISOString() ?? null,
      totalDecisions: decisions.length,
      acceptedCount,
      rejectedCount,
      investigatingCount,
      pendingCount,
    };
  }

  /**
   * Update the status of a hypothesis (accept/reject/investigate).
   */
  updateDecision(
    tenantId: string,
    majorIncidentId: string,
    hypothesisId: string,
    userId: string,
    dto: UpdateHypothesisDecisionDto,
  ): HypothesisDecisionResponse {
    const state = this.getOrCreateState(tenantId, majorIncidentId);
    const decision = this.getOrCreateDecision(state, hypothesisId);

    const previousStatus = decision.status;
    decision.status = dto.status;
    decision.reason = dto.reason ?? null;
    decision.decidedBy = userId;
    decision.decidedAt = new Date();

    // Emit event + journal (non-blocking)
    this.emitDecisionEvent(
      tenantId,
      majorIncidentId,
      hypothesisId,
      userId,
      previousStatus,
      dto.status,
      dto.reason,
    ).catch((err) =>
      this.logger.warn(`Failed to emit decision event: ${String(err)}`),
    );

    this.writeDecisionJournal(
      tenantId,
      userId,
      majorIncidentId,
      hypothesisId,
      previousStatus,
      dto.status,
      dto.reason,
    ).catch((err) =>
      this.logger.warn(`Failed to write decision journal: ${String(err)}`),
    );

    return this.toDecisionResponse(decision, majorIncidentId);
  }

  /**
   * Add an analyst note to a hypothesis.
   */
  addNote(
    tenantId: string,
    majorIncidentId: string,
    hypothesisId: string,
    userId: string,
    dto: AddHypothesisNoteDto,
  ): HypothesisNoteResponse {
    const state = this.getOrCreateState(tenantId, majorIncidentId);
    const decision = this.getOrCreateDecision(state, hypothesisId);

    if (decision.notes.length >= MAX_NOTES_PER_HYPOTHESIS) {
      // Remove oldest note to make room
      decision.notes.shift();
    }

    const note: StoredNote = {
      id: uuidv4(),
      content: dto.content,
      noteType: dto.noteType || 'general',
      createdBy: userId,
      createdAt: new Date(),
    };

    decision.notes.push(note);

    // Emit event (non-blocking)
    this.emitNoteEvent(
      tenantId,
      majorIncidentId,
      hypothesisId,
      userId,
      note,
    ).catch((err) =>
      this.logger.warn(`Failed to emit note event: ${String(err)}`),
    );

    // Write journal (non-blocking)
    this.writeNoteJournal(
      tenantId,
      userId,
      majorIncidentId,
      hypothesisId,
      note,
    ).catch((err) =>
      this.logger.warn(`Failed to write note journal: ${String(err)}`),
    );

    return this.toNoteResponse(note);
  }

  /**
   * Set the selected (primary) hypothesis for an MI's RCA.
   */
  setSelectedHypothesis(
    tenantId: string,
    majorIncidentId: string,
    userId: string,
    dto: SetSelectedHypothesisDto,
  ): RcaDecisionsSummaryResponse {
    const state = this.getOrCreateState(tenantId, majorIncidentId);

    const previousSelectedId = state.selectedHypothesisId;
    state.selectedHypothesisId = dto.hypothesisId;
    state.selectedReason = dto.reason ?? null;
    state.selectedBy = userId;
    state.selectedAt = new Date();

    // Auto-accept the selected hypothesis if it's still pending
    const decision = this.getOrCreateDecision(state, dto.hypothesisId);
    if (decision.status === HypothesisDecisionStatus.PENDING) {
      decision.status = HypothesisDecisionStatus.ACCEPTED;
      decision.reason = dto.reason ?? 'Selected as primary hypothesis';
      decision.decidedBy = userId;
      decision.decidedAt = new Date();
    }

    // Emit event (non-blocking)
    this.emitSelectedEvent(
      tenantId,
      majorIncidentId,
      dto.hypothesisId,
      previousSelectedId,
      userId,
      dto.reason,
    ).catch((err) =>
      this.logger.warn(`Failed to emit selected event: ${String(err)}`),
    );

    // Write journal (non-blocking)
    this.writeSelectedJournal(
      tenantId,
      userId,
      majorIncidentId,
      dto.hypothesisId,
      dto.reason,
    ).catch((err) =>
      this.logger.warn(`Failed to write selected journal: ${String(err)}`),
    );

    return this.getDecisionsSummary(tenantId, majorIncidentId);
  }

  // ==========================================================================
  // Internal helpers
  // ==========================================================================

  private storeKey(tenantId: string, majorIncidentId: string): string {
    return `${tenantId}:${majorIncidentId}`;
  }

  private getOrCreateState(
    tenantId: string,
    majorIncidentId: string,
  ): MiDecisionState {
    const key = this.storeKey(tenantId, majorIncidentId);
    let state = this.store.get(key);
    if (!state) {
      state = {
        majorIncidentId,
        tenantId,
        decisions: new Map(),
        selectedHypothesisId: null,
        selectedReason: null,
        selectedBy: null,
        selectedAt: null,
      };
      this.store.set(key, state);
    }
    return state;
  }

  private getOrCreateDecision(
    state: MiDecisionState,
    hypothesisId: string,
  ): StoredDecision {
    let decision = state.decisions.get(hypothesisId);
    if (!decision) {
      decision = {
        hypothesisId,
        status: HypothesisDecisionStatus.PENDING,
        reason: null,
        decidedBy: null,
        decidedAt: null,
        notes: [],
      };
      state.decisions.set(hypothesisId, decision);
    }
    return decision;
  }

  private buildDecisionResponses(
    state: MiDecisionState,
  ): HypothesisDecisionResponse[] {
    const responses: HypothesisDecisionResponse[] = [];
    for (const [, decision] of state.decisions) {
      responses.push(this.toDecisionResponse(decision, state.majorIncidentId));
    }
    return responses;
  }

  private toDecisionResponse(
    decision: StoredDecision,
    majorIncidentId: string,
  ): HypothesisDecisionResponse {
    return {
      hypothesisId: decision.hypothesisId,
      majorIncidentId,
      status: decision.status,
      reason: decision.reason,
      decidedBy: decision.decidedBy,
      decidedAt: decision.decidedAt?.toISOString() ?? null,
      notes: decision.notes.map((n) => this.toNoteResponse(n)),
    };
  }

  private toNoteResponse(note: StoredNote): HypothesisNoteResponse {
    return {
      id: note.id,
      content: note.content,
      noteType: note.noteType,
      createdBy: note.createdBy,
      createdAt: note.createdAt.toISOString(),
    };
  }

  // ==========================================================================
  // Event Bus
  // ==========================================================================

  private async emitDecisionEvent(
    tenantId: string,
    majorIncidentId: string,
    hypothesisId: string,
    userId: string,
    previousStatus: HypothesisDecisionStatus,
    newStatus: HypothesisDecisionStatus,
    reason?: string,
  ): Promise<void> {
    if (!this.eventBusService) return;

    const eventName =
      newStatus === HypothesisDecisionStatus.ACCEPTED
        ? 'rca.hypothesis.accepted'
        : newStatus === HypothesisDecisionStatus.REJECTED
          ? 'rca.hypothesis.rejected'
          : newStatus === HypothesisDecisionStatus.NEEDS_INVESTIGATION
            ? 'rca.hypothesis.investigation_started'
            : 'rca.hypothesis.status_changed';

    await this.eventBusService.emit({
      tenantId,
      source: EVENT_SOURCE,
      eventName,
      tableName: 'itsm_major_incidents',
      recordId: majorIncidentId,
      payload: {
        hypothesisId,
        previousStatus,
        newStatus,
        reason: reason?.slice(0, 500),
      },
      actorId: userId,
    });
  }

  private async emitNoteEvent(
    tenantId: string,
    majorIncidentId: string,
    hypothesisId: string,
    userId: string,
    note: StoredNote,
  ): Promise<void> {
    if (!this.eventBusService) return;

    await this.eventBusService.emit({
      tenantId,
      source: EVENT_SOURCE,
      eventName: 'rca.hypothesis.note_added',
      tableName: 'itsm_major_incidents',
      recordId: majorIncidentId,
      payload: {
        hypothesisId,
        noteId: note.id,
        noteType: note.noteType,
        contentPreview: note.content.slice(0, 200),
      },
      actorId: userId,
    });
  }

  private async emitSelectedEvent(
    tenantId: string,
    majorIncidentId: string,
    hypothesisId: string,
    previousSelectedId: string | null,
    userId: string,
    reason?: string,
  ): Promise<void> {
    if (!this.eventBusService) return;

    await this.eventBusService.emit({
      tenantId,
      source: EVENT_SOURCE,
      eventName: 'rca.hypothesis.selected',
      tableName: 'itsm_major_incidents',
      recordId: majorIncidentId,
      payload: {
        hypothesisId,
        previousSelectedId,
        reason: reason?.slice(0, 500),
      },
      actorId: userId,
    });
  }

  // ==========================================================================
  // Journal / Audit Trail
  // ==========================================================================

  private async writeDecisionJournal(
    tenantId: string,
    userId: string,
    majorIncidentId: string,
    hypothesisId: string,
    previousStatus: HypothesisDecisionStatus,
    newStatus: HypothesisDecisionStatus,
    reason?: string,
  ): Promise<void> {
    if (!this.journalService) return;

    const statusLabel =
      newStatus === HypothesisDecisionStatus.ACCEPTED
        ? 'accepted'
        : newStatus === HypothesisDecisionStatus.REJECTED
          ? 'rejected'
          : newStatus === HypothesisDecisionStatus.NEEDS_INVESTIGATION
            ? 'marked for investigation'
            : 'updated';

    let message = `RCA hypothesis "${hypothesisId}" ${statusLabel} (was: ${previousStatus}).`;
    if (reason) {
      message += ` Reason: ${reason}`;
    }

    try {
      await this.journalService.createJournalEntry(
        tenantId,
        userId,
        'major_incidents',
        majorIncidentId,
        {
          type: JournalType.WORK_NOTE,
          message: message.slice(0, JOURNAL_MESSAGE_CAP),
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to write decision journal entry: ${String(err)}`,
      );
    }
  }

  private async writeNoteJournal(
    tenantId: string,
    userId: string,
    majorIncidentId: string,
    hypothesisId: string,
    note: StoredNote,
  ): Promise<void> {
    if (!this.journalService) return;

    const message = `Analyst note added to RCA hypothesis "${hypothesisId}" [${note.noteType}]: ${note.content}`;

    try {
      await this.journalService.createJournalEntry(
        tenantId,
        userId,
        'major_incidents',
        majorIncidentId,
        {
          type: JournalType.WORK_NOTE,
          message: message.slice(0, JOURNAL_MESSAGE_CAP),
        },
      );
    } catch (err) {
      this.logger.warn(`Failed to write note journal entry: ${String(err)}`);
    }
  }

  private async writeSelectedJournal(
    tenantId: string,
    userId: string,
    majorIncidentId: string,
    hypothesisId: string,
    reason?: string,
  ): Promise<void> {
    if (!this.journalService) return;

    let message = `RCA hypothesis "${hypothesisId}" selected as primary root cause.`;
    if (reason) {
      message += ` Reason: ${reason}`;
    }

    try {
      await this.journalService.createJournalEntry(
        tenantId,
        userId,
        'major_incidents',
        majorIncidentId,
        {
          type: JournalType.WORK_NOTE,
          message: message.slice(0, JOURNAL_MESSAGE_CAP),
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to write selected journal entry: ${String(err)}`,
      );
    }
  }
}
