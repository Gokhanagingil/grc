export type TransformName =
  | 'trim'
  | 'lower'
  | 'upper'
  | 'parseInt'
  | 'parseFloat'
  | 'date'
  | 'boolean'
  | 'toString'
  | 'default';

export interface TransformDef {
  name: TransformName;
  args?: Record<string, unknown>;
}

export const ALLOWED_TRANSFORMS: Set<string> = new Set([
  'trim',
  'lower',
  'upper',
  'parseInt',
  'parseFloat',
  'date',
  'boolean',
  'toString',
  'default',
]);

function applyTrim(value: unknown): unknown {
  if (typeof value === 'string') return value.trim();
  return value;
}

function applyLower(value: unknown): unknown {
  if (typeof value === 'string') return value.toLowerCase();
  return value;
}

function applyUpper(value: unknown): unknown {
  if (typeof value === 'string') return value.toUpperCase();
  return value;
}

function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return `${value}`;
  return '';
}

function applyParseInt(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  const str = toStr(value).trim();
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? null : parsed;
}

function applyParseFloat(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  const str = toStr(value).trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

function applyDate(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  const str = toStr(value).trim();
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function applyBoolean(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  const str = toStr(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(str)) return true;
  if (['false', '0', 'no', 'off', ''].includes(str)) return false;
  return null;
}

function applyToString(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return toStr(value);
}

function applyDefault(value: unknown, args?: Record<string, unknown>): unknown {
  if (value === null || value === undefined || value === '') {
    return args?.value ?? null;
  }
  return value;
}

export function applyTransform(
  value: unknown,
  transform: TransformDef,
): unknown {
  if (!ALLOWED_TRANSFORMS.has(transform.name)) {
    throw new Error(`Unsafe transform rejected: ${transform.name}`);
  }

  switch (transform.name) {
    case 'trim':
      return applyTrim(value);
    case 'lower':
      return applyLower(value);
    case 'upper':
      return applyUpper(value);
    case 'parseInt':
      return applyParseInt(value);
    case 'parseFloat':
      return applyParseFloat(value);
    case 'date':
      return applyDate(value);
    case 'boolean':
      return applyBoolean(value);
    case 'toString':
      return applyToString(value);
    case 'default':
      return applyDefault(value, transform.args);
    default:
      return value;
  }
}

export function applyTransformChain(
  value: unknown,
  transforms: TransformDef[],
): unknown {
  let result = value;
  for (const t of transforms) {
    result = applyTransform(result, t);
  }
  return result;
}

export interface FieldMappingEntry {
  sourceField: string;
  targetField: string;
  transforms?: TransformDef[];
}

export function applyFieldMapping(
  row: Record<string, unknown>,
  fieldMap: FieldMappingEntry[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of fieldMap) {
    let value = row[entry.sourceField];
    if (entry.transforms && entry.transforms.length > 0) {
      value = applyTransformChain(value, entry.transforms);
    }
    result[entry.targetField] = value;
  }
  return result;
}
