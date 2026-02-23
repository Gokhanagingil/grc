/**
 * RCA Hypothesis Decision Service — Unit Tests
 *
 * Tests hypothesis status management (accept/reject/investigate),
 * analyst notes, selected hypothesis tracking, event bus integration,
 * and audit trail journal entries.
 *
 * Phase C: MI RCA Actions & Evidence
 */
import { RcaHypothesisDecisionService } from './rca-hypothesis-decision.service';
import { HypothesisDecisionStatus } from './dto/rca-hypothesis-decision.dto';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockEventBusService() {
  return {
    emit: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  };
}

function createMockJournalService() {
  return {
    createJournalEntry: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    resolveTableName: jest.fn().mockReturnValue('itsm_major_incidents'),
    isAllowedTable: jest.fn().mockReturnValue(true),
  };
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const MI_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const HYPO_ID_1 = 'hypo-common-upstream-srv-db-01';
const HYPO_ID_2 = 'hypo-recent-change-srv-app-01';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RcaHypothesisDecisionService', () => {
  let service: RcaHypothesisDecisionService;
  let mockEventBus: ReturnType<typeof createMockEventBusService>;
  let mockJournal: ReturnType<typeof createMockJournalService>;

  beforeEach(() => {
    mockEventBus = createMockEventBusService();
    mockJournal = createMockJournalService();
    service = new RcaHypothesisDecisionService(
      mockEventBus as never,
      mockJournal as never,
    );
  });

  // ========================================================================
  // getDecisionsSummary
  // ========================================================================

  describe('getDecisionsSummary', () => {
    it('should return empty summary for a new MI', () => {
      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);

      expect(summary.majorIncidentId).toBe(MI_ID);
      expect(summary.decisions).toEqual({});
      expect(summary.selectedHypothesisId).toBeNull();
      expect(summary.totalDecisions).toBe(0);
      expect(summary.acceptedCount).toBe(0);
      expect(summary.rejectedCount).toBe(0);
      expect(summary.investigatingCount).toBe(0);
      expect(summary.pendingCount).toBe(0);
    });

    it('should return decisions after updates', () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
        reason: 'Strong evidence',
      });

      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_2, USER_ID, {
        status: HypothesisDecisionStatus.REJECTED,
        reason: 'No correlation',
      });

      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);

      expect(summary.totalDecisions).toBe(2);
      expect(summary.acceptedCount).toBe(1);
      expect(summary.rejectedCount).toBe(1);
      expect(summary.investigatingCount).toBe(0);
      expect(summary.pendingCount).toBe(0);
    });

    it('should isolate decisions by tenant', () => {
      const otherTenant = '99999999-9999-9999-9999-999999999999';

      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
      });

      const summaryOther = service.getDecisionsSummary(otherTenant, MI_ID);
      expect(summaryOther.totalDecisions).toBe(0);

      const summaryOwn = service.getDecisionsSummary(TENANT_ID, MI_ID);
      expect(summaryOwn.totalDecisions).toBe(1);
    });
  });

  // ========================================================================
  // updateDecision
  // ========================================================================

  describe('updateDecision', () => {
    it('should accept a hypothesis and return decision response', () => {
      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        {
          status: HypothesisDecisionStatus.ACCEPTED,
          reason: 'Topology path confirms upstream dependency',
        },
      );

      expect(result.hypothesisId).toBe(HYPO_ID_1);
      expect(result.majorIncidentId).toBe(MI_ID);
      expect(result.status).toBe(HypothesisDecisionStatus.ACCEPTED);
      expect(result.reason).toBe('Topology path confirms upstream dependency');
      expect(result.decidedBy).toBe(USER_ID);
      expect(result.decidedAt).toBeTruthy();
    });

    it('should reject a hypothesis', () => {
      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        {
          status: HypothesisDecisionStatus.REJECTED,
          reason: 'No impact path found',
        },
      );

      expect(result.status).toBe(HypothesisDecisionStatus.REJECTED);
      expect(result.reason).toBe('No impact path found');
    });

    it('should mark hypothesis as needs-investigation', () => {
      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        {
          status: HypothesisDecisionStatus.NEEDS_INVESTIGATION,
        },
      );

      expect(result.status).toBe(HypothesisDecisionStatus.NEEDS_INVESTIGATION);
      expect(result.reason).toBeNull();
    });

    it('should allow changing decision status', () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.NEEDS_INVESTIGATION,
      });

      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        {
          status: HypothesisDecisionStatus.ACCEPTED,
          reason: 'Investigation confirmed the hypothesis',
        },
      );

      expect(result.status).toBe(HypothesisDecisionStatus.ACCEPTED);
      expect(result.reason).toBe('Investigation confirmed the hypothesis');
    });

    it('should emit event bus event on accept', async () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
        reason: 'Confirmed',
      });

      // Wait for async event emission
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEventBus.emit).toHaveBeenCalled();
      const call = mockEventBus.emit.mock.calls[0][0];
      expect(call.eventName).toBe('rca.hypothesis.accepted');
      expect(call.tenantId).toBe(TENANT_ID);
      expect(call.recordId).toBe(MI_ID);
      expect(call.payload.hypothesisId).toBe(HYPO_ID_1);
      expect(call.payload.newStatus).toBe(HypothesisDecisionStatus.ACCEPTED);
    });

    it('should emit event bus event on reject', async () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.REJECTED,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEventBus.emit).toHaveBeenCalled();
      const call = mockEventBus.emit.mock.calls[0][0];
      expect(call.eventName).toBe('rca.hypothesis.rejected');
    });

    it('should emit event bus event on investigation started', async () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.NEEDS_INVESTIGATION,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEventBus.emit).toHaveBeenCalled();
      const call = mockEventBus.emit.mock.calls[0][0];
      expect(call.eventName).toBe('rca.hypothesis.investigation_started');
    });

    it('should write journal entry on decision', async () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
        reason: 'Root cause confirmed',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockJournal.createJournalEntry).toHaveBeenCalled();
      const args = mockJournal.createJournalEntry.mock.calls[0];
      expect(args[0]).toBe(TENANT_ID);
      expect(args[1]).toBe(USER_ID);
      expect(args[2]).toBe('major_incidents');
      expect(args[3]).toBe(MI_ID);
      expect(args[4].message).toContain('accepted');
      expect(args[4].message).toContain(HYPO_ID_1);
    });

    it('should not fail if event bus is unavailable', () => {
      const serviceNoEventBus = new RcaHypothesisDecisionService(
        undefined,
        mockJournal as never,
      );

      const result = serviceNoEventBus.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        { status: HypothesisDecisionStatus.ACCEPTED },
      );

      expect(result.status).toBe(HypothesisDecisionStatus.ACCEPTED);
    });

    it('should not fail if journal service is unavailable', () => {
      const serviceNoJournal = new RcaHypothesisDecisionService(
        mockEventBus as never,
        undefined,
      );

      const result = serviceNoJournal.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        { status: HypothesisDecisionStatus.REJECTED },
      );

      expect(result.status).toBe(HypothesisDecisionStatus.REJECTED);
    });
  });

  // ========================================================================
  // addNote
  // ========================================================================

  describe('addNote', () => {
    it('should add an analyst note to a hypothesis', () => {
      const result = service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Checked logs - confirmed DB timeout at 14:32 UTC',
        noteType: 'evidence',
      });

      expect(result.id).toBeTruthy();
      expect(result.content).toBe(
        'Checked logs - confirmed DB timeout at 14:32 UTC',
      );
      expect(result.noteType).toBe('evidence');
      expect(result.createdBy).toBe(USER_ID);
      expect(result.createdAt).toBeTruthy();
    });

    it('should default noteType to general', () => {
      const result = service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Some general observation',
      });

      expect(result.noteType).toBe('general');
    });

    it('should accumulate multiple notes', () => {
      service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Note 1',
      });
      service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Note 2',
      });
      service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Note 3',
      });

      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);
      const decision = summary.decisions[HYPO_ID_1];

      expect(decision).toBeTruthy();
      expect(decision.notes).toHaveLength(3);
      expect(decision.notes[0].content).toBe('Note 1');
      expect(decision.notes[2].content).toBe('Note 3');
    });

    it('should emit note event', async () => {
      service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Evidence found',
        noteType: 'evidence',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEventBus.emit).toHaveBeenCalled();
      const call = mockEventBus.emit.mock.calls[0][0];
      expect(call.eventName).toBe('rca.hypothesis.note_added');
      expect(call.payload.hypothesisId).toBe(HYPO_ID_1);
      expect(call.payload.noteType).toBe('evidence');
    });

    it('should write journal entry for note', async () => {
      service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Important observation',
        noteType: 'observation',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockJournal.createJournalEntry).toHaveBeenCalled();
      const args = mockJournal.createJournalEntry.mock.calls[0];
      expect(args[4].message).toContain('Analyst note added');
      expect(args[4].message).toContain('Important observation');
    });

    it('should enforce max notes limit by removing oldest', () => {
      // Add MAX_NOTES_PER_HYPOTHESIS + 1 notes (limit is 50)
      for (let i = 0; i < 51; i++) {
        service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
          content: `Note ${i}`,
        });
      }

      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);
      const decision = summary.decisions[HYPO_ID_1];

      expect(decision.notes).toHaveLength(50);
      // First note should be "Note 1" (Note 0 was evicted)
      expect(decision.notes[0].content).toBe('Note 1');
      expect(decision.notes[49].content).toBe('Note 50');
    });
  });

  // ========================================================================
  // setSelectedHypothesis
  // ========================================================================

  describe('setSelectedHypothesis', () => {
    it('should set selected hypothesis', () => {
      const result = service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_1,
        reason: 'Strongest evidence from topology analysis',
      });

      expect(result.selectedHypothesisId).toBe(HYPO_ID_1);
      expect(result.selectedReason).toBe(
        'Strongest evidence from topology analysis',
      );
      expect(result.selectedBy).toBe(USER_ID);
      expect(result.selectedAt).toBeTruthy();
    });

    it('should auto-accept pending hypothesis when selected', () => {
      const result = service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_1,
      });

      const decision = result.decisions[HYPO_ID_1];
      expect(decision).toBeTruthy();
      expect(decision.status).toBe(HypothesisDecisionStatus.ACCEPTED);
    });

    it('should not change status of already-rejected hypothesis when selected', () => {
      // First reject
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.REJECTED,
      });

      // Then select
      const result = service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_1,
      });

      const decision = result.decisions[HYPO_ID_1];
      // Should stay REJECTED since it was not PENDING
      expect(decision.status).toBe(HypothesisDecisionStatus.REJECTED);
    });

    it('should allow changing selected hypothesis', () => {
      service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_1,
      });

      const result = service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_2,
        reason: 'New evidence points to a different root cause',
      });

      expect(result.selectedHypothesisId).toBe(HYPO_ID_2);
      expect(result.selectedReason).toBe(
        'New evidence points to a different root cause',
      );
    });

    it('should emit selected event', async () => {
      service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_1,
        reason: 'Primary root cause',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockEventBus.emit).toHaveBeenCalled();
      const selectedCall = mockEventBus.emit.mock.calls.find(
        (c: Array<{ eventName: string }>) =>
          c[0].eventName === 'rca.hypothesis.selected',
      );
      expect(selectedCall).toBeTruthy();
      expect(selectedCall![0].payload.hypothesisId).toBe(HYPO_ID_1);
    });

    it('should write journal entry for selected hypothesis', async () => {
      service.setSelectedHypothesis(TENANT_ID, MI_ID, USER_ID, {
        hypothesisId: HYPO_ID_1,
        reason: 'Confirmed root cause',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const selectedJournal = mockJournal.createJournalEntry.mock.calls.find(
        (c: Array<string | { message: string }>) => {
          const msg = typeof c[4] === 'object' ? c[4].message : '';
          return msg.includes('selected as primary');
        },
      );
      expect(selectedJournal).toBeTruthy();
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle concurrent updates to same hypothesis', () => {
      const results = [
        service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
          status: HypothesisDecisionStatus.ACCEPTED,
        }),
        service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
          status: HypothesisDecisionStatus.REJECTED,
        }),
      ];

      // Both should complete without error
      expect(results).toHaveLength(2);

      // Final state should be one of the two statuses
      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);
      const decision = summary.decisions[HYPO_ID_1];
      expect([
        HypothesisDecisionStatus.ACCEPTED,
        HypothesisDecisionStatus.REJECTED,
      ]).toContain(decision.status);
    });

    it('should handle event bus error gracefully', () => {
      mockEventBus.emit.mockRejectedValueOnce(new Error('Event bus down'));

      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        { status: HypothesisDecisionStatus.ACCEPTED },
      );

      // Should still succeed - event bus errors are non-blocking
      expect(result.status).toBe(HypothesisDecisionStatus.ACCEPTED);
    });

    it('should handle journal error gracefully', () => {
      mockJournal.createJournalEntry.mockRejectedValueOnce(
        new Error('Journal write failed'),
      );

      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        { status: HypothesisDecisionStatus.ACCEPTED },
      );

      // Should still succeed - journal errors are non-blocking
      expect(result.status).toBe(HypothesisDecisionStatus.ACCEPTED);
    });

    it('should handle empty reason', () => {
      const result = service.updateDecision(
        TENANT_ID,
        MI_ID,
        HYPO_ID_1,
        USER_ID,
        { status: HypothesisDecisionStatus.ACCEPTED },
      );

      expect(result.reason).toBeNull();
    });

    it('should track decisions per major incident independently', () => {
      const otherMiId = '33333333-3333-3333-3333-333333333333';

      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
      });

      service.updateDecision(TENANT_ID, otherMiId, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.REJECTED,
      });

      const summary1 = service.getDecisionsSummary(TENANT_ID, MI_ID);
      const summary2 = service.getDecisionsSummary(TENANT_ID, otherMiId);

      expect(summary1.decisions[HYPO_ID_1].status).toBe(
        HypothesisDecisionStatus.ACCEPTED,
      );
      expect(summary2.decisions[HYPO_ID_1].status).toBe(
        HypothesisDecisionStatus.REJECTED,
      );
    });
  });

  // ========================================================================
  // Response Shape Contract (Phase 0 regression — PR #448 mismatch)
  // ========================================================================

  describe('response shape contract', () => {
    it('should return decisions as Record<string, HypothesisDecisionResponse>, not an array', () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
        reason: 'Confirmed root cause',
      });
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_2, USER_ID, {
        status: HypothesisDecisionStatus.REJECTED,
      });

      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);

      // CRITICAL: decisions MUST be a plain object (Record), NOT an array.
      // This is the contract the frontend relies on for O(1) lookup by hypothesisId.
      expect(Array.isArray(summary.decisions)).toBe(false);
      expect(typeof summary.decisions).toBe('object');
      expect(summary.decisions).not.toBeNull();

      // Verify keyed lookup works
      expect(summary.decisions[HYPO_ID_1]).toBeDefined();
      expect(summary.decisions[HYPO_ID_1].hypothesisId).toBe(HYPO_ID_1);
      expect(summary.decisions[HYPO_ID_1].status).toBe(
        HypothesisDecisionStatus.ACCEPTED,
      );

      expect(summary.decisions[HYPO_ID_2]).toBeDefined();
      expect(summary.decisions[HYPO_ID_2].status).toBe(
        HypothesisDecisionStatus.REJECTED,
      );
    });

    it('should return empty Record (not empty array) when no decisions exist', () => {
      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);

      expect(Array.isArray(summary.decisions)).toBe(false);
      expect(typeof summary.decisions).toBe('object');
      expect(Object.keys(summary.decisions)).toHaveLength(0);
    });

    it('should return all required summary fields with correct types', () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
      });

      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);

      // Required string fields
      expect(typeof summary.majorIncidentId).toBe('string');

      // Required nullable string fields
      expect(
        summary.selectedHypothesisId === null ||
          typeof summary.selectedHypothesisId === 'string',
      ).toBe(true);
      expect(
        summary.selectedAt === null || typeof summary.selectedAt === 'string',
      ).toBe(true);

      // Required number fields
      expect(typeof summary.totalDecisions).toBe('number');
      expect(typeof summary.acceptedCount).toBe('number');
      expect(typeof summary.rejectedCount).toBe('number');
      expect(typeof summary.investigatingCount).toBe('number');
      expect(typeof summary.pendingCount).toBe('number');

      // Counts should be consistent
      expect(
        summary.acceptedCount +
          summary.rejectedCount +
          summary.investigatingCount +
          summary.pendingCount,
      ).toBe(summary.totalDecisions);
    });

    it('each decision should have required fields with correct types', () => {
      service.updateDecision(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        status: HypothesisDecisionStatus.ACCEPTED,
        reason: 'Test reason',
      });
      service.addNote(TENANT_ID, MI_ID, HYPO_ID_1, USER_ID, {
        content: 'Test note',
        noteType: 'evidence',
      });

      const summary = service.getDecisionsSummary(TENANT_ID, MI_ID);
      const decision = summary.decisions[HYPO_ID_1];

      expect(typeof decision.hypothesisId).toBe('string');
      expect(typeof decision.majorIncidentId).toBe('string');
      expect(typeof decision.status).toBe('string');
      expect(
        [
          HypothesisDecisionStatus.PENDING,
          HypothesisDecisionStatus.ACCEPTED,
          HypothesisDecisionStatus.REJECTED,
          HypothesisDecisionStatus.NEEDS_INVESTIGATION,
        ].includes(decision.status),
      ).toBe(true);

      // reason and decidedBy are nullable strings
      expect(
        decision.reason === null || typeof decision.reason === 'string',
      ).toBe(true);
      expect(
        decision.decidedAt === null || typeof decision.decidedAt === 'string',
      ).toBe(true);

      // notes must be an array
      expect(Array.isArray(decision.notes)).toBe(true);
      expect(decision.notes.length).toBeGreaterThan(0);

      const note = decision.notes[0];
      expect(typeof note.id).toBe('string');
      expect(typeof note.content).toBe('string');
      expect(typeof note.noteType).toBe('string');
      expect(typeof note.createdBy).toBe('string');
      expect(typeof note.createdAt).toBe('string');
    });
  });
});
