import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CopilotLearningEvent, LearningEventType } from '../entities';
import { StructuredLoggerService } from '../../common/logger';

@Injectable()
export class LearningService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(CopilotLearningEvent)
    private readonly repo: Repository<CopilotLearningEvent>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('LearningService');
  }

  async recordEvent(
    tenantId: string,
    userId: string,
    data: {
      incidentSysId: string;
      eventType: string;
      actionType: string;
      confidence?: number;
      evidenceIds?: string[];
    },
  ): Promise<CopilotLearningEvent> {
    const event = this.repo.create({
      tenantId,
      createdBy: userId,
      incidentSysId: data.incidentSysId,
      eventType: data.eventType as LearningEventType,
      actionType: data.actionType,
      confidence: data.confidence ?? null,
      evidenceIds: data.evidenceIds ?? null,
      isDeleted: false,
    });

    const saved = await this.repo.save(event);

    this.logger.log('Learning event recorded', {
      tenantId,
      eventType: data.eventType,
      actionType: data.actionType,
      incidentSysId: data.incidentSysId,
    });

    return saved;
  }

  async getEventsForIncident(
    tenantId: string,
    incidentSysId: string,
  ): Promise<CopilotLearningEvent[]> {
    return this.repo.find({
      where: { tenantId, incidentSysId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }
}
