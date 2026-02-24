/**
 * SLA Condition Field Registry
 *
 * Registry-based field metadata so future modules can add fields
 * without rewriting the engine core.
 *
 * Each field defines:
 *  - key: the condition leaf `field` value
 *  - label: human-readable name
 *  - valueType: string | number | array | boolean | date
 *  - allowedOperators: which operators are valid for this field
 *  - recordTypes: which record types this field applies to
 */

export type FieldValueType = 'string' | 'number' | 'array' | 'boolean' | 'date';

export interface SlaFieldMeta {
  key: string;
  label: string;
  valueType: FieldValueType;
  allowedOperators: string[];
  recordTypes: string[];
}

/** All supported condition operators */
export const ALL_OPERATORS = [
  'is',
  'is_not',
  'in',
  'not_in',
  'contains',
  'is_empty',
  'is_not_empty',
  'gt',
  'gte',
  'lt',
  'lte',
] as const;

export type ConditionOperator = (typeof ALL_OPERATORS)[number];

/** Operators grouped by compatible value types */
const STRING_OPERATORS: ConditionOperator[] = [
  'is',
  'is_not',
  'in',
  'not_in',
  'contains',
  'is_empty',
  'is_not_empty',
];

export const NUMBER_OPERATORS: ConditionOperator[] = [
  'is',
  'is_not',
  'gt',
  'gte',
  'lt',
  'lte',
  'is_empty',
  'is_not_empty',
];

const ENUM_OPERATORS: ConditionOperator[] = [
  'is',
  'is_not',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
];

/**
 * Default field registry for Incident record type (v1).
 * Extensible: add fields for other record types as needed.
 */
const INCIDENT_FIELDS: SlaFieldMeta[] = [
  {
    key: 'priority',
    label: 'Priority',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'impact',
    label: 'Impact',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'urgency',
    label: 'Urgency',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'category',
    label: 'Category',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'subcategory',
    label: 'Subcategory',
    valueType: 'string',
    allowedOperators: STRING_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'serviceId',
    label: 'Service',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'offeringId',
    label: 'Service Offering',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'assignmentGroup',
    label: 'Assignment Group',
    valueType: 'string',
    allowedOperators: STRING_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'source',
    label: 'Channel / Source',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'status',
    label: 'Status',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'assignedTo',
    label: 'Assigned To',
    valueType: 'string',
    allowedOperators: [...ENUM_OPERATORS],
    recordTypes: ['INCIDENT'],
  },
  {
    key: 'relatedService',
    label: 'Related Service (legacy)',
    valueType: 'string',
    allowedOperators: STRING_OPERATORS,
    recordTypes: ['INCIDENT'],
  },
];

/**
 * Default field registry for Change Task record type.
 * Supports direct task fields + derived parent change fields.
 */
const CHANGE_TASK_FIELDS: SlaFieldMeta[] = [
  {
    key: 'priority',
    label: 'Task Priority',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'status',
    label: 'Task Status',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'taskType',
    label: 'Task Type',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'assignmentGroupId',
    label: 'Assignment Group',
    valueType: 'string',
    allowedOperators: STRING_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'assigneeId',
    label: 'Assignee',
    valueType: 'string',
    allowedOperators: [...ENUM_OPERATORS],
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'isBlocking',
    label: 'Is Blocking',
    valueType: 'boolean',
    allowedOperators: ['is', 'is_not'],
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'stageLabel',
    label: 'Stage Label',
    valueType: 'string',
    allowedOperators: STRING_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'sourceTemplateId',
    label: 'Source Template',
    valueType: 'string',
    allowedOperators: [...ENUM_OPERATORS],
    recordTypes: ['CHANGE_TASK'],
  },
  // Derived from parent change (dot-walk context)
  {
    key: 'change.type',
    label: 'Change Type (parent)',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'change.risk',
    label: 'Change Risk (parent)',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'change.serviceId',
    label: 'Service (parent change)',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
  {
    key: 'change.state',
    label: 'Change State (parent)',
    valueType: 'string',
    allowedOperators: ENUM_OPERATORS,
    recordTypes: ['CHANGE_TASK'],
  },
];

/**
 * The SLA Field Registry.
 *
 * Holds all registered fields. Modules can call `registerField()` to
 * extend the set of available condition fields at boot time.
 */
class FieldRegistry {
  private fields: Map<string, SlaFieldMeta> = new Map();

  constructor() {
    // Register default incident fields
    for (const f of INCIDENT_FIELDS) {
      this.fields.set(f.key, f);
    }
    // Register change task fields (additive — shared keys like 'priority'
    // get their recordTypes merged so they appear for both record types)
    for (const f of CHANGE_TASK_FIELDS) {
      const existing = this.fields.get(f.key);
      if (existing) {
        // Merge recordTypes without duplicates
        const merged = new Set([...existing.recordTypes, ...f.recordTypes]);
        this.fields.set(f.key, {
          ...existing,
          recordTypes: Array.from(merged),
        });
      } else {
        this.fields.set(f.key, f);
      }
    }
  }

  /** Register a new field (or override existing). */
  registerField(meta: SlaFieldMeta): void {
    this.fields.set(meta.key, meta);
  }

  /** Get metadata for a field key. */
  getField(key: string): SlaFieldMeta | undefined {
    return this.fields.get(key);
  }

  /** Check if a field key is registered. */
  hasField(key: string): boolean {
    return this.fields.has(key);
  }

  /** Get all fields applicable to a record type. */
  getFieldsForRecordType(recordType: string): SlaFieldMeta[] {
    return Array.from(this.fields.values()).filter((f) =>
      f.recordTypes.includes(recordType),
    );
  }

  /** Get all registered fields. */
  getAllFields(): SlaFieldMeta[] {
    return Array.from(this.fields.values());
  }

  /** Check if an operator is valid for a given field. */
  isOperatorAllowed(fieldKey: string, operator: string): boolean {
    const meta = this.fields.get(fieldKey);
    if (!meta) return false;
    return meta.allowedOperators.includes(operator);
  }
}

/** Singleton field registry instance. */
export const slaFieldRegistry = new FieldRegistry();
