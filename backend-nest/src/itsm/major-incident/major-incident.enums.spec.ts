import {
  MajorIncidentStatus,
  isValidMajorIncidentTransition,
  MAJOR_INCIDENT_TRANSITIONS,
} from './major-incident.enums';

describe('Major Incident Status Transitions', () => {
  describe('MAJOR_INCIDENT_TRANSITIONS map', () => {
    it('should define transitions for all statuses', () => {
      const allStatuses = Object.values(MajorIncidentStatus);
      for (const status of allStatuses) {
        expect(status in MAJOR_INCIDENT_TRANSITIONS).toBe(true);
      }
    });

    it('should have CLOSED as a terminal state with no outgoing transitions', () => {
      const closedTransitions = MAJOR_INCIDENT_TRANSITIONS[MajorIncidentStatus.CLOSED];
      expect(closedTransitions).toBeDefined();
      expect(closedTransitions).toHaveLength(0);
    });
  });

  describe('isValidMajorIncidentTransition', () => {
    // Valid forward transitions
    it('should allow DECLARED -> INVESTIGATING', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.DECLARED, MajorIncidentStatus.INVESTIGATING)).toBe(true);
    });

    it('should allow INVESTIGATING -> MITIGATING', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.INVESTIGATING, MajorIncidentStatus.MITIGATING)).toBe(true);
    });

    it('should allow INVESTIGATING -> MONITORING', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.INVESTIGATING, MajorIncidentStatus.MONITORING)).toBe(true);
    });

    it('should allow INVESTIGATING -> RESOLVED', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.INVESTIGATING, MajorIncidentStatus.RESOLVED)).toBe(true);
    });

    it('should allow MITIGATING -> MONITORING', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.MITIGATING, MajorIncidentStatus.MONITORING)).toBe(true);
    });

    it('should allow MITIGATING -> INVESTIGATING (rollback)', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.MITIGATING, MajorIncidentStatus.INVESTIGATING)).toBe(true);
    });

    it('should allow MITIGATING -> RESOLVED', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.MITIGATING, MajorIncidentStatus.RESOLVED)).toBe(true);
    });

    it('should allow MONITORING -> RESOLVED', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.MONITORING, MajorIncidentStatus.RESOLVED)).toBe(true);
    });

    it('should allow MONITORING -> INVESTIGATING (regression)', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.MONITORING, MajorIncidentStatus.INVESTIGATING)).toBe(true);
    });

    it('should allow RESOLVED -> PIR_PENDING', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.RESOLVED, MajorIncidentStatus.PIR_PENDING)).toBe(true);
    });

    it('should allow RESOLVED -> CLOSED', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.RESOLVED, MajorIncidentStatus.CLOSED)).toBe(true);
    });

    it('should allow RESOLVED -> INVESTIGATING (reopen)', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.RESOLVED, MajorIncidentStatus.INVESTIGATING)).toBe(true);
    });

    it('should allow PIR_PENDING -> CLOSED', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.PIR_PENDING, MajorIncidentStatus.CLOSED)).toBe(true);
    });

    // Invalid transitions
    it('should NOT allow DECLARED -> RESOLVED (skip states)', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.DECLARED, MajorIncidentStatus.RESOLVED)).toBe(false);
    });

    it('should NOT allow DECLARED -> CLOSED (skip states)', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.DECLARED, MajorIncidentStatus.CLOSED)).toBe(false);
    });

    it('should NOT allow CLOSED -> any state', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.CLOSED, MajorIncidentStatus.DECLARED)).toBe(false);
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.CLOSED, MajorIncidentStatus.INVESTIGATING)).toBe(false);
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.CLOSED, MajorIncidentStatus.RESOLVED)).toBe(false);
    });

    it('should NOT allow PIR_PENDING -> INVESTIGATING', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.PIR_PENDING, MajorIncidentStatus.INVESTIGATING)).toBe(false);
    });

    it('should NOT allow same-state transition', () => {
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.DECLARED, MajorIncidentStatus.DECLARED)).toBe(false);
      expect(isValidMajorIncidentTransition(MajorIncidentStatus.INVESTIGATING, MajorIncidentStatus.INVESTIGATING)).toBe(false);
    });
  });
});
