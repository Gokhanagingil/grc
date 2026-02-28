/**
 * Core Company Enums
 *
 * Shared dimension enums for company type and status.
 * Used across ITSM, GRC, SLA, and Contracts modules.
 *
 * IMPORTANT: Postgres enum labels are UPPERCASE.
 */

export enum CompanyType {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  INTERNAL = 'INTERNAL',
}

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
