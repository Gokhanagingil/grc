/**
 * Platform Self-Check Job
 *
 * Nightly job that runs platform:validate in JSON mode and stores the result summary.
 * This provides automated platform health monitoring and validation.
 */

import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  Job,
  JobConfig,
  JobResult,
  JobStatus,
} from '../interfaces/job.interface';
import { StructuredLoggerService } from '../../common/logger';

interface ValidationScriptResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  exitCode: number;
  durationMs: number;
}

interface ValidationResult {
  success: boolean;
  timestamp: string;
  environment: string;
  scripts: ValidationScriptResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    totalDurationMs: number;
  };
}

@Injectable()
export class PlatformSelfCheckJob implements Job {
  private readonly logger: StructuredLoggerService;
  private lastValidationResult: ValidationResult | null = null;

  readonly config: JobConfig = {
    name: 'platform-self-check',
    description: 'Nightly platform validation running environment, database, and migration checks',
    scheduleIntervalMs: 24 * 60 * 60 * 1000,
    enabled: true,
    runOnStartup: false,
  };

  constructor() {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('PlatformSelfCheckJob');
  }

  async execute(): Promise<JobResult> {
    const jobId = randomUUID();
    const startedAt = new Date();

    this.logger.log('Starting platform self-check job', { jobId });

    try {
      const validationResult = await this.runPlatformValidation();
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      this.lastValidationResult = validationResult;

      if (validationResult.success) {
        return {
          jobId,
          jobName: this.config.name,
          status: JobStatus.SUCCESS,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs,
          messageCode: 'PLATFORM_VALIDATION_PASSED',
          summary: `Platform validation passed: ${validationResult.summary.passed}/${validationResult.summary.total} checks passed`,
          details: {
            environment: validationResult.environment,
            summary: validationResult.summary,
            scripts: validationResult.scripts.map((s) => ({
              name: s.name,
              status: s.status,
              durationMs: s.durationMs,
            })),
          },
        };
      } else {
        const failedScripts = validationResult.scripts
          .filter((s) => s.status === 'failed')
          .map((s) => s.name);

        return {
          jobId,
          jobName: this.config.name,
          status: JobStatus.FAILED,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs,
          messageCode: 'PLATFORM_VALIDATION_FAILED',
          summary: `Platform validation failed: ${validationResult.summary.failed} checks failed`,
          details: {
            environment: validationResult.environment,
            summary: validationResult.summary,
            failedScripts,
            scripts: validationResult.scripts.map((s) => ({
              name: s.name,
              status: s.status,
              durationMs: s.durationMs,
            })),
          },
          error: {
            code: 'VALIDATION_FAILED',
            message: `Failed checks: ${failedScripts.join(', ')}`,
          },
        };
      }
    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Platform self-check job failed', {
        jobId,
        error: errorMessage,
      });

      return {
        jobId,
        jobName: this.config.name,
        status: JobStatus.FAILED,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        messageCode: 'PLATFORM_VALIDATION_ERROR',
        error: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
        },
      };
    }
  }

  getLastValidationResult(): ValidationResult | null {
    return this.lastValidationResult;
  }

  private runPlatformValidation(): Promise<ValidationResult> {
    return new Promise((resolve, reject) => {
      let output = '';
      const backendNestPath = path.join(__dirname, '..', '..', '..');

      const child = spawn(
        'npx',
        [
          'ts-node',
          '-r',
          'tsconfig-paths/register',
          'src/scripts/platform-validate.ts',
          '--json',
          '--skip-smoke',
        ],
        {
          cwd: backendNestPath,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        try {
          const lines = output.trim().split('\n');
          let jsonOutput = '';

          for (const line of lines) {
            if (line.startsWith('{')) {
              jsonOutput = line;
              for (let i = lines.indexOf(line) + 1; i < lines.length; i++) {
                jsonOutput += lines[i];
              }
              break;
            }
          }

          if (jsonOutput) {
            const result = JSON.parse(jsonOutput) as ValidationResult;
            resolve(result);
          } else {
            resolve({
              success: code === 0,
              timestamp: new Date().toISOString(),
              environment: process.env.NODE_ENV || 'development',
              scripts: [],
              summary: {
                total: 0,
                passed: code === 0 ? 1 : 0,
                failed: code === 0 ? 0 : 1,
                skipped: 0,
                totalDurationMs: 0,
              },
            });
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse validation output', {
            error: parseError instanceof Error ? parseError.message : 'Unknown error',
            output: output.substring(0, 500),
          });

          resolve({
            success: code === 0,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            scripts: [],
            summary: {
              total: 1,
              passed: code === 0 ? 1 : 0,
              failed: code === 0 ? 0 : 1,
              skipped: 0,
              totalDurationMs: 0,
            },
          });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        child.kill();
        reject(new Error('Platform validation timed out after 120 seconds'));
      }, 120000);
    });
  }
}
