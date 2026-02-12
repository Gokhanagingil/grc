import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowClientService } from '../servicenow';
import { CopilotIncidentIndex, CopilotKbIndex } from '../entities';
import { StructuredLoggerService } from '../../common/logger';

@Injectable()
export class IndexingService {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly snClient: ServiceNowClientService,
    @InjectRepository(CopilotIncidentIndex)
    private readonly incidentIndexRepo: Repository<CopilotIncidentIndex>,
    @InjectRepository(CopilotKbIndex)
    private readonly kbIndexRepo: Repository<CopilotKbIndex>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('IndexingService');
  }

  async indexResolvedIncidents(
    tenantId: string,
    userId: string,
    daysBack = 180,
  ): Promise<{ indexed: number; errors: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const query = `state=6^ORstate=7^resolved_at>=${cutoffStr}^ORDERBYDESCresolved_at`;

    let indexed = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 50;

    this.logger.log('Starting incident indexing', {
      tenantId,
      daysBack,
      cutoffStr,
    });

    let hasMore = true;
    while (hasMore) {
      try {
        const result = await this.snClient.listIncidents(tenantId, {
          limit: batchSize,
          offset,
          query,
        });

        if (!result.items || result.items.length === 0) {
          hasMore = false;
          break;
        }

        for (const incident of result.items) {
          try {
            await this.upsertIncidentIndex(tenantId, userId, incident);
            indexed++;
          } catch (err) {
            errors++;
            this.logger.warn('Failed to index incident', {
              tenantId,
              sysId: incident.sys_id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        offset += result.items.length;
        if (result.items.length < batchSize) {
          hasMore = false;
        }
      } catch (err) {
        this.logger.error('Batch fetch failed during indexing', {
          tenantId,
          offset,
          error: err instanceof Error ? err.message : String(err),
        });
        hasMore = false;
      }
    }

    this.logger.log('Incident indexing complete', {
      tenantId,
      indexed,
      errors,
    });

    return { indexed, errors };
  }

  async indexKbArticles(
    tenantId: string,
    userId: string,
  ): Promise<{ indexed: number; errors: number }> {
    let indexed = 0;
    let errors = 0;

    this.logger.log('Starting KB article indexing', { tenantId });

    try {
      const articles = await this.snClient.listKbArticles(tenantId, {
        limit: 200,
        query: 'workflow_state=published',
      });

      for (const article of articles) {
        try {
          await this.upsertKbIndex(tenantId, userId, article);
          indexed++;
        } catch (err) {
          errors++;
          this.logger.warn('Failed to index KB article', {
            tenantId,
            sysId: article.sys_id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      this.logger.error('KB article fetch failed', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.log('KB article indexing complete', {
      tenantId,
      indexed,
      errors,
    });

    return { indexed, errors };
  }

  private async upsertIncidentIndex(
    tenantId: string,
    userId: string,
    incident: {
      sys_id: string;
      number?: string;
      short_description?: string;
      description?: string;
      state?: string;
      priority?: string;
      category?: string;
      assignment_group?: string;
      close_code?: string;
      close_notes?: string;
      resolved_at?: string;
      closed_at?: string;
      sys_created_on?: string;
      sys_updated_on?: string;
    },
  ): Promise<void> {
    const searchText = [
      incident.short_description,
      incident.description,
      incident.category,
      incident.close_notes,
    ]
      .filter(Boolean)
      .join(' ')
      .substring(0, 10000);

    const existing = await this.incidentIndexRepo.findOne({
      where: { tenantId, sysId: incident.sys_id },
    });

    if (existing) {
      await this.incidentIndexRepo.update(existing.id, {
        number: incident.number || null,
        shortDescription: incident.short_description || null,
        description: incident.description
          ? incident.description.substring(0, 5000)
          : null,
        state: incident.state || null,
        priority: incident.priority || null,
        category: incident.category || null,
        assignmentGroup: incident.assignment_group || null,
        closeCode: incident.close_code || null,
        closeNotes: incident.close_notes || null,
        resolvedAt: incident.resolved_at
          ? new Date(incident.resolved_at)
          : null,
        closedAt: incident.closed_at ? new Date(incident.closed_at) : null,
        snCreatedAt: incident.sys_created_on
          ? new Date(incident.sys_created_on)
          : null,
        snUpdatedAt: incident.sys_updated_on
          ? new Date(incident.sys_updated_on)
          : null,
        searchText,
        updatedBy: userId,
      });
    } else {
      const entity = this.incidentIndexRepo.create({
        tenantId,
        sysId: incident.sys_id,
        number: incident.number || null,
        shortDescription: incident.short_description || null,
        description: incident.description
          ? incident.description.substring(0, 5000)
          : null,
        state: incident.state || null,
        priority: incident.priority || null,
        category: incident.category || null,
        assignmentGroup: incident.assignment_group || null,
        closeCode: incident.close_code || null,
        closeNotes: incident.close_notes || null,
        resolvedAt: incident.resolved_at
          ? new Date(incident.resolved_at)
          : null,
        closedAt: incident.closed_at ? new Date(incident.closed_at) : null,
        snCreatedAt: incident.sys_created_on
          ? new Date(incident.sys_created_on)
          : null,
        snUpdatedAt: incident.sys_updated_on
          ? new Date(incident.sys_updated_on)
          : null,
        searchText,
        createdBy: userId,
        isDeleted: false,
      });
      await this.incidentIndexRepo.save(entity);
    }
  }

  private async upsertKbIndex(
    tenantId: string,
    userId: string,
    article: {
      sys_id: string;
      number?: string;
      short_description?: string;
      text?: string;
      category?: string;
      workflow_state?: string;
      sys_created_on?: string;
      sys_updated_on?: string;
    },
  ): Promise<void> {
    const searchText = [
      article.short_description,
      article.text,
      article.category,
    ]
      .filter(Boolean)
      .join(' ')
      .substring(0, 10000);

    const existing = await this.kbIndexRepo.findOne({
      where: { tenantId, sysId: article.sys_id },
    });

    if (existing) {
      await this.kbIndexRepo.update(existing.id, {
        number: article.number || null,
        title: article.short_description || null,
        text: article.text ? article.text.substring(0, 5000) : null,
        category: article.category || null,
        workflowState: article.workflow_state || null,
        snCreatedAt: article.sys_created_on
          ? new Date(article.sys_created_on)
          : null,
        snUpdatedAt: article.sys_updated_on
          ? new Date(article.sys_updated_on)
          : null,
        searchText,
        updatedBy: userId,
      });
    } else {
      const entity = this.kbIndexRepo.create({
        tenantId,
        sysId: article.sys_id,
        number: article.number || null,
        title: article.short_description || null,
        text: article.text ? article.text.substring(0, 5000) : null,
        category: article.category || null,
        workflowState: article.workflow_state || null,
        snCreatedAt: article.sys_created_on
          ? new Date(article.sys_created_on)
          : null,
        snUpdatedAt: article.sys_updated_on
          ? new Date(article.sys_updated_on)
          : null,
        searchText,
        createdBy: userId,
        isDeleted: false,
      });
      await this.kbIndexRepo.save(entity);
    }
  }

  async getIndexStats(
    tenantId: string,
  ): Promise<{ incidents: number; kbArticles: number }> {
    const [incidents, kbArticles] = await Promise.all([
      this.incidentIndexRepo.count({ where: { tenantId, isDeleted: false } }),
      this.kbIndexRepo.count({ where: { tenantId, isDeleted: false } }),
    ]);
    return { incidents, kbArticles };
  }
}
