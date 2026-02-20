import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowClientService, SnIncident } from '../servicenow';
import { CopilotIncidentIndex, CopilotKbIndex } from '../entities';
import {
  ActionCard,
  SimilarIncident,
  KbSuggestion,
  CopilotSuggestResponse,
} from '../dto';
import { StructuredLoggerService } from '../../common/logger';

@Injectable()
export class SuggestService {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly snClient: ServiceNowClientService,
    @InjectRepository(CopilotIncidentIndex)
    private readonly incidentIndexRepo: Repository<CopilotIncidentIndex>,
    @InjectRepository(CopilotKbIndex)
    private readonly kbIndexRepo: Repository<CopilotKbIndex>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('SuggestService');
  }

  async suggest(
    tenantId: string,
    sysId: string,
    similarLimit: number,
    kbLimit: number,
  ): Promise<CopilotSuggestResponse> {
    const incident = await this.snClient.getIncident(tenantId, sysId);

    if (!incident) {
      const indexed = await this.incidentIndexRepo.findOne({
        where: { tenantId, sysId },
      });
      if (!indexed) {
        throw new Error(`Incident ${sysId} not found`);
      }
      return this.buildResponseFromIndex(
        tenantId,
        sysId,
        indexed,
        similarLimit,
        kbLimit,
      );
    }

    const [similarIncidents, kbSuggestions] = await Promise.all([
      this.findSimilarIncidents(tenantId, incident, similarLimit),
      this.findKbSuggestions(tenantId, incident, kbLimit),
    ]);

    const actionCards = this.generateActionCards(
      incident,
      similarIncidents,
      kbSuggestions,
    );

    return {
      incidentSysId: sysId,
      incidentNumber: incident.number || sysId,
      actionCards,
      similarIncidents,
      kbSuggestions,
      generatedAt: new Date().toISOString(),
    };
  }

  private async buildResponseFromIndex(
    tenantId: string,
    sysId: string,
    indexed: CopilotIncidentIndex,
    similarLimit: number,
    kbLimit: number,
  ): Promise<CopilotSuggestResponse> {
    const mockIncident: SnIncident = {
      sys_id: sysId,
      number: indexed.number || '',
      short_description: indexed.shortDescription || '',
      description: indexed.description || '',
      state: indexed.state || '',
      impact: '',
      urgency: '',
      priority: indexed.priority || '',
      category: indexed.category || '',
      assignment_group: indexed.assignmentGroup || '',
      assigned_to: '',
      service_offering: '',
      business_service: '',
      opened_at: indexed.snCreatedAt?.toISOString() || '',
      resolved_at: indexed.resolvedAt?.toISOString() || '',
      closed_at: indexed.closedAt?.toISOString() || '',
      close_code: indexed.closeCode || '',
      close_notes: indexed.closeNotes || '',
      sys_created_on: indexed.snCreatedAt?.toISOString() || '',
      sys_updated_on: indexed.snUpdatedAt?.toISOString() || '',
      work_notes: '',
      comments: '',
    };

    const [similarIncidents, kbSuggestions] = await Promise.all([
      this.findSimilarIncidents(tenantId, mockIncident, similarLimit),
      this.findKbSuggestions(tenantId, mockIncident, kbLimit),
    ]);

    const actionCards = this.generateActionCards(
      mockIncident,
      similarIncidents,
      kbSuggestions,
    );

    return {
      incidentSysId: sysId,
      incidentNumber: indexed.number || sysId,
      actionCards,
      similarIncidents,
      kbSuggestions,
      generatedAt: new Date().toISOString(),
    };
  }

  private async findSimilarIncidents(
    tenantId: string,
    incident: SnIncident,
    limit: number,
  ): Promise<SimilarIncident[]> {
    const searchTerms = this.extractSearchTerms(
      `${incident.short_description || ''} ${incident.category || ''}`,
    );

    if (searchTerms.length === 0) {
      return [];
    }

    try {
      const tsQuery = searchTerms.map((t) => `${t}:*`).join(' | ');

      const results = await this.incidentIndexRepo
        .createQueryBuilder('idx')
        .select([
          'idx.sysId',
          'idx.number',
          'idx.shortDescription',
          'idx.state',
          'idx.priority',
          'idx.resolutionNotes',
        ])
        .addSelect(
          `ts_rank(to_tsvector('english', COALESCE(idx.search_text, '')), to_tsquery('english', :tsQuery))`,
          'rank',
        )
        .where('idx.tenantId = :tenantId', { tenantId })
        .andWhere('idx.sysId != :sysId', { sysId: incident.sys_id })
        .andWhere('idx.state IN (:...resolvedStates)', {
          resolvedStates: ['6', '7', 'Resolved', 'Closed'],
        })
        .andWhere(
          `to_tsvector('english', COALESCE(idx.search_text, '')) @@ to_tsquery('english', :tsQuery)`,
          { tsQuery },
        )
        .orderBy('rank', 'DESC')
        .limit(limit)
        .getRawAndEntities();

      return results.entities.map((entity, i) => {
        const rawRow = results.raw[i] as { rank?: string | number } | undefined;
        const rankStr = rawRow?.rank !== undefined ? `${rawRow.rank}` : '';
        return {
          sysId: entity.sysId,
          number: entity.number,
          shortDescription: entity.shortDescription,
          state: entity.state,
          priority: entity.priority,
          resolutionNotes: entity.resolutionNotes,
          score: rankStr ? parseFloat(rankStr) : 0,
        };
      });
    } catch (error) {
      this.logger.warn('Full-text search failed, falling back to ILIKE', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.findSimilarIncidentsFallback(
        tenantId,
        incident,
        searchTerms,
        limit,
      );
    }
  }

  private async findSimilarIncidentsFallback(
    tenantId: string,
    incident: SnIncident,
    searchTerms: string[],
    limit: number,
  ): Promise<SimilarIncident[]> {
    const qb = this.incidentIndexRepo
      .createQueryBuilder('idx')
      .where('idx.tenantId = :tenantId', { tenantId })
      .andWhere('idx.sysId != :sysId', { sysId: incident.sys_id })
      .andWhere('idx.state IN (:...resolvedStates)', {
        resolvedStates: ['6', '7', 'Resolved', 'Closed'],
      });

    const conditions = searchTerms.map((term, i) => {
      const param = `term${i}`;
      return `idx.search_text ILIKE :${param}`;
    });

    if (conditions.length > 0) {
      qb.andWhere(
        `(${conditions.join(' OR ')})`,
        Object.fromEntries(
          searchTerms.map((term, i) => [`term${i}`, `%${term}%`]),
        ),
      );
    }

    const results = await qb
      .orderBy('idx.resolvedAt', 'DESC', 'NULLS LAST')
      .limit(limit)
      .getMany();

    return results.map((r, i) => ({
      sysId: r.sysId,
      number: r.number,
      shortDescription: r.shortDescription,
      state: r.state,
      priority: r.priority,
      resolutionNotes: r.resolutionNotes,
      score: 1 - i * 0.1,
    }));
  }

  private async findKbSuggestions(
    tenantId: string,
    incident: SnIncident,
    limit: number,
  ): Promise<KbSuggestion[]> {
    const searchTerms = this.extractSearchTerms(
      `${incident.short_description || ''} ${incident.category || ''}`,
    );

    if (searchTerms.length === 0) {
      return [];
    }

    try {
      const tsQuery = searchTerms.map((t) => `${t}:*`).join(' | ');

      const results = await this.kbIndexRepo
        .createQueryBuilder('kb')
        .select(['kb.sysId', 'kb.number', 'kb.title', 'kb.text'])
        .addSelect(
          `ts_rank(to_tsvector('english', COALESCE(kb.search_text, '')), to_tsquery('english', :tsQuery))`,
          'rank',
        )
        .where('kb.tenantId = :tenantId', { tenantId })
        .andWhere(
          `to_tsvector('english', COALESCE(kb.search_text, '')) @@ to_tsquery('english', :tsQuery)`,
          { tsQuery },
        )
        .orderBy('rank', 'DESC')
        .limit(limit)
        .getRawAndEntities();

      return results.entities.map((entity, i) => {
        const rawRow = results.raw[i] as { rank?: string | number } | undefined;
        const rankStr = rawRow?.rank !== undefined ? `${rawRow.rank}` : '';
        return {
          sysId: entity.sysId,
          number: entity.number,
          title: entity.title,
          snippet: entity.text ? entity.text.substring(0, 300) : null,
          score: rankStr ? parseFloat(rankStr) : 0,
        };
      });
    } catch {
      return this.findKbSuggestionsFallback(tenantId, searchTerms, limit);
    }
  }

  private async findKbSuggestionsFallback(
    tenantId: string,
    searchTerms: string[],
    limit: number,
  ): Promise<KbSuggestion[]> {
    const qb = this.kbIndexRepo
      .createQueryBuilder('kb')
      .where('kb.tenantId = :tenantId', { tenantId });

    const conditions = searchTerms.map(
      (_, i) => `kb.search_text ILIKE :kbTerm${i}`,
    );
    if (conditions.length > 0) {
      qb.andWhere(
        `(${conditions.join(' OR ')})`,
        Object.fromEntries(
          searchTerms.map((term, i) => [`kbTerm${i}`, `%${term}%`]),
        ),
      );
    }

    const results = await qb.limit(limit).getMany();
    return results.map((r, i) => ({
      sysId: r.sysId,
      number: r.number,
      title: r.title,
      snippet: r.text ? r.text.substring(0, 300) : null,
      score: 1 - i * 0.1,
    }));
  }

  private generateActionCards(
    incident: SnIncident,
    similarIncidents: SimilarIncident[],
    kbSuggestions: KbSuggestion[],
  ): ActionCard[] {
    const cards: ActionCard[] = [];

    cards.push({
      id: 'summary',
      type: 'summary',
      title: 'Incident Summary',
      content: this.buildSummary(incident),
      confidence: 0.9,
      canApply: false,
    });

    cards.push({
      id: 'next_best_steps',
      type: 'next_best_steps',
      title: 'Next Best Steps',
      content: this.buildNextSteps(incident, similarIncidents, kbSuggestions),
      confidence: 0.7,
      canApply: false,
    });

    cards.push({
      id: 'customer_update_draft',
      type: 'customer_update_draft',
      title: 'Customer Update Draft',
      content: this.buildCustomerUpdate(incident),
      confidence: 0.8,
      targetField: 'additional_comments',
      canApply: true,
    });

    cards.push({
      id: 'work_notes_draft',
      type: 'work_notes_draft',
      title: 'Work Notes Draft',
      content: this.buildWorkNotes(incident, similarIncidents),
      confidence: 0.8,
      targetField: 'work_notes',
      canApply: true,
    });

    return cards;
  }

  private buildSummary(incident: SnIncident): string {
    const parts: string[] = [];
    parts.push(
      `Incident ${incident.number}: ${incident.short_description || 'No description'}`,
    );
    if (incident.priority) parts.push(`Priority: ${incident.priority}`);
    if (incident.state) parts.push(`State: ${incident.state}`);
    if (incident.category) parts.push(`Category: ${incident.category}`);
    if (incident.assignment_group)
      parts.push(`Assignment Group: ${incident.assignment_group}`);
    if (incident.description) {
      const desc =
        incident.description.length > 500
          ? incident.description.substring(0, 500) + '...'
          : incident.description;
      parts.push(`\nDescription: ${desc}`);
    }
    return parts.join('\n');
  }

  private buildNextSteps(
    incident: SnIncident,
    similarIncidents: SimilarIncident[],
    kbSuggestions: KbSuggestion[],
  ): string {
    const steps: string[] = [];
    steps.push('Recommended next steps:');

    const state = (incident.state || '').toLowerCase();
    if (state === '1' || state === 'new') {
      steps.push(
        '1. Acknowledge the incident and assign to the appropriate team',
      );
      steps.push('2. Verify impact and urgency with the reporter');
    } else if (state === '2' || state === 'in progress') {
      steps.push('1. Continue investigation based on current findings');
      steps.push('2. Update the customer on progress');
    } else {
      steps.push('1. Review the incident details and current state');
      steps.push('2. Determine appropriate action based on priority');
    }

    if (similarIncidents.length > 0) {
      steps.push(
        `\n${similarIncidents.length} similar resolved incident(s) found - review their resolutions for guidance.`,
      );
    }

    if (kbSuggestions.length > 0) {
      steps.push(
        `${kbSuggestions.length} relevant KB article(s) found - check for applicable solutions.`,
      );
    }

    return steps.join('\n');
  }

  private buildCustomerUpdate(incident: SnIncident): string {
    const state = (incident.state || '').toLowerCase();
    if (state === '1' || state === 'new') {
      return `Thank you for reporting this issue. We have received your incident (${incident.number}) regarding "${incident.short_description || 'your reported issue'}". Our team is reviewing it and will provide an update shortly.`;
    }
    if (state === '2' || state === 'in progress') {
      return `We wanted to provide an update on your incident (${incident.number}). Our team is actively working on "${incident.short_description || 'your reported issue'}". We will notify you once we have a resolution.`;
    }
    return `Update on incident ${incident.number}: We are reviewing "${incident.short_description || 'your reported issue'}" and will keep you informed of progress.`;
  }

  private buildWorkNotes(
    incident: SnIncident,
    similarIncidents: SimilarIncident[],
  ): string {
    const notes: string[] = [];
    notes.push(`[Copilot Analysis] Incident ${incident.number}`);
    notes.push(`Category: ${incident.category || 'N/A'}`);
    notes.push(`Priority: ${incident.priority || 'N/A'}`);

    if (similarIncidents.length > 0) {
      notes.push(`\nSimilar resolved incidents found:`);
      similarIncidents.slice(0, 3).forEach((sim) => {
        notes.push(
          `- ${sim.number || sim.sysId}: ${sim.shortDescription || 'No description'}`,
        );
        if (sim.resolutionNotes) {
          const truncated =
            sim.resolutionNotes.length > 200
              ? sim.resolutionNotes.substring(0, 200) + '...'
              : sim.resolutionNotes;
          notes.push(`  Resolution: ${truncated}`);
        }
      });
    }

    notes.push(
      `\nRecommended: Review similar incidents and apply relevant resolution steps.`,
    );
    return notes.join('\n');
  }

  private extractSearchTerms(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'shall',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'out',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'and',
      'but',
      'or',
      'not',
      'no',
      'nor',
      'so',
      'if',
      'that',
      'this',
      'it',
      'its',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .slice(0, 8);
  }
}
