import { Injectable, BadRequestException } from '@nestjs/common';
import { ServiceNowClientService } from '../servicenow';
import { AllowedTargetField, CopilotApplyResponse } from '../dto';
import { StructuredLoggerService } from '../../common/logger';
import { sanitizeString } from '../../common/logger/log-sanitizer';

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'work_notes',
  'additional_comments',
]);

const SN_FIELD_MAP: Record<AllowedTargetField, 'work_notes' | 'comments'> = {
  work_notes: 'work_notes',
  additional_comments: 'comments',
};

@Injectable()
export class ApplyService {
  private readonly logger: StructuredLoggerService;

  constructor(private readonly snClient: ServiceNowClientService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('ApplyService');
  }

  async apply(
    tenantId: string,
    sysId: string,
    actionType: string,
    targetField: AllowedTargetField,
    text: string,
  ): Promise<CopilotApplyResponse> {
    if (!ALLOWED_FIELDS.has(targetField)) {
      this.logger.error('Blocked attempt to write to disallowed field', {
        tenantId,
        sysId,
        targetField,
        actionType,
      });
      throw new BadRequestException(
        `Field "${targetField}" is not allowed. Only work_notes and additional_comments are permitted in Sprint 1.`,
      );
    }

    if (!text || text.trim().length === 0) {
      throw new BadRequestException('Comment text cannot be empty');
    }

    const snField = SN_FIELD_MAP[targetField];

    this.logger.log('Applying copilot action to ServiceNow', {
      tenantId,
      sysId,
      actionType,
      targetField,
      snField,
      textLength: text.length,
    });

    try {
      await this.snClient.postComment(tenantId, sysId, snField, text);

      this.logger.log('Successfully applied copilot action', {
        tenantId,
        sysId,
        actionType,
        targetField,
      });

      return {
        success: true,
        incidentSysId: sysId,
        targetField,
        appliedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to apply copilot action to ServiceNow', {
        tenantId,
        sysId,
        actionType,
        targetField,
        error: sanitizeString(
          error instanceof Error ? error.message : String(error),
        ),
      });
      throw error;
    }
  }
}
