import { config } from 'dotenv';

config({ path: process.env.ENV_FILE || '.env' });

// Runtime function to determine database type (called at module load time)
function getRawDbType(): string {
  return (
    process.env.DB_TYPE ??
    process.env.DB_DRIVER ??
    process.env.TYPEORM_CONNECTION ??
    process.env.DATABASE_TYPE ??
    'sqlite' // Default to sqlite for dev environment
  )
    .toString()
    .toLowerCase();
}

const rawDbType = getRawDbType();

export const isPostgres = rawDbType === 'postgres';

// Runtime-computed column types (evaluated at module load time, but safe for SQLite)
export const jsonColumnType: 'jsonb' | 'simple-json' = isPostgres
  ? 'jsonb'
  : 'simple-json';

export const timestampColumnType: 'timestamptz' | 'datetime' = isPostgres
  ? 'timestamptz'
  : 'datetime';

type EnumDefinition<T extends string | number> =
  | readonly T[]
  | Record<string, T>;

const extractEnumValues = <T extends string | number>(
  enumDef: EnumDefinition<T>,
): T[] => {
  if (Array.isArray(enumDef)) {
    return enumDef as T[];
  }
  return (Object.values(enumDef) as T[]).filter(
    (value) => typeof value === 'string' || typeof value === 'number',
  );
};

export const enumColumnOptions = <T extends string | number>(
  enumDef: EnumDefinition<T>,
  defaultValue?: T,
) => {
  const values = extractEnumValues(enumDef);
  if (isPostgres) {
    return {
      type: 'enum' as const,
      enum: values,
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    };
  }
  return {
    type: 'text' as const,
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
  };
};

