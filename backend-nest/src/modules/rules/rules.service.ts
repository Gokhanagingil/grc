import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface IncidentRule {
  name: string;
  condition: {
    severity?: string[];
    category?: string[];
    count?: number;
    window?: string; // e.g., "5m"
    resource?: string;
  };
  action: {
    type: string;
    correlationKey?: string;
  };
}

export interface IncidentContext {
  tenantId: string;
  eventId: string;
  severity: string;
  category: string;
  resource: string;
  message: string;
}

@Injectable()
export class RulesService {
  private rules: IncidentRule[] = [];

  constructor() {
    this.loadRules();
  }

  private loadRules() {
    const rulesPath = path.join(process.cwd(), 'rules', 'incident.rules.json');
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf-8');
      this.rules = JSON.parse(content);
    } else {
      // Default rules
      this.rules = [
        {
          name: 'INCIDENT_RESOURCE_PRESSURE',
          condition: {
            severity: ['major', 'critical'],
            category: ['disk', 'cpu', 'memory'],
            count: 3,
            window: '5m',
          },
          action: {
            type: 'create_incident',
            correlationKey: 'resource',
          },
        },
      ];
    }
  }

  async evaluateIncident(
    context: IncidentContext,
  ): Promise<{ id: string; key: string } | null> {
    for (const rule of this.rules) {
      if (this.matchesRule(context, rule)) {
        // In production, create/update incident in DB
        const incidentId = `inc-${Date.now()}`;
        const correlationKey = rule.action.correlationKey
          ? `${context[rule.action.correlationKey as keyof IncidentContext]}`
          : 'default';

        return {
          id: incidentId,
          key: correlationKey,
        };
      }
    }
    return null;
  }

  private matchesRule(context: IncidentContext, rule: IncidentRule): boolean {
    const { condition } = rule;

    if (condition.severity && !condition.severity.includes(context.severity)) {
      return false;
    }

    if (condition.category && !condition.category.includes(context.category)) {
      return false;
    }

    if (condition.resource && condition.resource !== context.resource) {
      return false;
    }

    // Count and window checks would require Redis/cache lookup
    // Simplified for MVP
    if (condition.count && condition.count > 1) {
      // Would check Redis counter for resource+category in window
      // For now, assume match if severity/category match
    }

    return true;
  }
}
