import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CopilotSuggestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  similarLimit?: number = 5;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  kbLimit?: number = 5;
}

export interface ActionCard {
  id: string;
  type:
    | 'summary'
    | 'next_best_steps'
    | 'customer_update_draft'
    | 'work_notes_draft';
  title: string;
  content: string;
  confidence: number;
  targetField?: 'work_notes' | 'additional_comments';
  canApply: boolean;
}

export interface SimilarIncident {
  sysId: string;
  number: string | null;
  shortDescription: string | null;
  state: string | null;
  priority: string | null;
  resolutionNotes: string | null;
  score: number;
}

export interface KbSuggestion {
  sysId: string;
  number: string | null;
  title: string | null;
  snippet: string | null;
  score: number;
}

export interface CopilotSuggestResponse {
  incidentSysId: string;
  incidentNumber: string;
  actionCards: ActionCard[];
  similarIncidents: SimilarIncident[];
  kbSuggestions: KbSuggestion[];
  generatedAt: string;
}
