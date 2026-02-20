export interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function expandField(field: string, min: number, max: number): number[] {
  const results: number[] = [];

  for (const part of field.split(',')) {
    const trimmed = part.trim();

    const stepMatch = trimmed.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const base = stepMatch ? stepMatch[1] : trimmed;

    let start = min;
    let end = max;

    if (base === '*') {
      start = min;
      end = max;
    } else {
      const rangeMatch = base.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        start = parseInt(rangeMatch[1], 10);
        end = parseInt(rangeMatch[2], 10);
      } else {
        const val = parseInt(base, 10);
        if (isNaN(val) || val < min || val > max) {
          throw new Error(`Invalid cron field value: ${base}`);
        }
        if (!stepMatch) {
          results.push(val);
          continue;
        }
        start = val;
        end = max;
      }
    }

    if (start < min || end > max || start > end) {
      throw new Error(`Invalid cron range: ${trimmed}`);
    }

    for (let i = start; i <= end; i += step) {
      results.push(i);
    }
  }

  return [...new Set(results)].sort((a, b) => a - b);
}

export function parseCron(expr: string): CronParts {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${parts.length}`,
    );
  }
  return {
    minute: expandField(parts[0], 0, 59),
    hour: expandField(parts[1], 0, 23),
    dayOfMonth: expandField(parts[2], 1, 31),
    month: expandField(parts[3], 1, 12),
    dayOfWeek: expandField(parts[4], 0, 6),
  };
}

export function isValidCron(expr: string): boolean {
  try {
    parseCron(expr);
    return true;
  } catch {
    return false;
  }
}

export function getNextRunDate(
  cronExpr: string,
  after: Date = new Date(),
): Date {
  const parts = parseCron(cronExpr);
  const limit = 366 * 24 * 60;
  const candidate = new Date(after.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let i = 0; i < limit; i++) {
    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const dom = candidate.getDate();
    const mon = candidate.getMonth() + 1;
    const dow = candidate.getDay();

    if (
      parts.month.includes(mon) &&
      parts.dayOfMonth.includes(dom) &&
      parts.dayOfWeek.includes(dow) &&
      parts.hour.includes(h) &&
      parts.minute.includes(m)
    ) {
      return candidate;
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(
    `Could not find next run date within 1 year for cron: ${cronExpr}`,
  );
}
