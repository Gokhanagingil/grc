/**
 * Coverage Response Normalizer
 *
 * Centralizes normalization of coverage API responses to prevent
 * "Cannot read properties of undefined (reading 'length')" crashes.
 *
 * This normalizer ensures all expected array fields are always arrays,
 * using `Array.isArray(x) ? x : []` pattern to handle malformed objects.
 */

/**
 * Generic safe array helper - ensures a value is always an array.
 * Returns empty array if value is null, undefined, or not an array.
 * This is the primary utility for preventing .length crashes on undefined.
 *
 * @param value - Any value that should be an array
 * @returns The value if it's an array, otherwise an empty array
 */
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Requirement coverage item structure
 */
export interface RequirementCoverageItem {
  id: string;
  title: string;
  referenceCode: string;
  status: string;
  controlCount: number;
  isCovered: boolean;
}

/**
 * Process coverage item structure
 */
export interface ProcessCoverageItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  controlCount: number;
  isCovered: boolean;
}

/**
 * Coverage summary structure
 */
export interface CoverageSummary {
  requirementCoverage: number;
  processCoverage: number;
  unlinkedControlsCount: number;
  totalRequirements: number;
  coveredRequirements: number;
  totalProcesses: number;
  coveredProcesses: number;
  totalControls: number;
}

/**
 * Requirement coverage response structure
 */
export interface RequirementCoverageResponse {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  requirements: RequirementCoverageItem[];
}

/**
 * Process coverage response structure
 */
export interface ProcessCoverageResponse {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  processes: ProcessCoverageItem[];
}

/**
 * Default coverage summary with safe defaults
 */
export const DEFAULT_COVERAGE_SUMMARY: CoverageSummary = {
  requirementCoverage: 0,
  processCoverage: 0,
  unlinkedControlsCount: 0,
  totalRequirements: 0,
  coveredRequirements: 0,
  totalProcesses: 0,
  coveredProcesses: 0,
  totalControls: 0,
};

/**
 * Default requirement coverage response with safe defaults
 */
export const DEFAULT_REQUIREMENT_COVERAGE: RequirementCoverageResponse = {
  total: 0,
  covered: 0,
  uncovered: 0,
  coveragePercent: 0,
  requirements: [],
};

/**
 * Default process coverage response with safe defaults
 */
export const DEFAULT_PROCESS_COVERAGE: ProcessCoverageResponse = {
  total: 0,
  covered: 0,
  uncovered: 0,
  coveragePercent: 0,
  processes: [],
};

/**
 * Normalizes a coverage summary response.
 * Returns safe defaults if input is null/undefined or malformed.
 */
export function normalizeCoverageSummary(raw: unknown): CoverageSummary {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_COVERAGE_SUMMARY };
  }

  const data = raw as Record<string, unknown>;

  return {
    requirementCoverage: typeof data.requirementCoverage === 'number' ? data.requirementCoverage : 0,
    processCoverage: typeof data.processCoverage === 'number' ? data.processCoverage : 0,
    unlinkedControlsCount: typeof data.unlinkedControlsCount === 'number' ? data.unlinkedControlsCount : 0,
    totalRequirements: typeof data.totalRequirements === 'number' ? data.totalRequirements : 0,
    coveredRequirements: typeof data.coveredRequirements === 'number' ? data.coveredRequirements : 0,
    totalProcesses: typeof data.totalProcesses === 'number' ? data.totalProcesses : 0,
    coveredProcesses: typeof data.coveredProcesses === 'number' ? data.coveredProcesses : 0,
    totalControls: typeof data.totalControls === 'number' ? data.totalControls : 0,
  };
}

/**
 * Normalizes a requirement coverage response.
 * Ensures the requirements array is always an array.
 */
export function normalizeRequirementCoverage(raw: unknown): RequirementCoverageResponse {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_REQUIREMENT_COVERAGE };
  }

  const data = raw as Record<string, unknown>;

  return {
    total: typeof data.total === 'number' ? data.total : 0,
    covered: typeof data.covered === 'number' ? data.covered : 0,
    uncovered: typeof data.uncovered === 'number' ? data.uncovered : 0,
    coveragePercent: typeof data.coveragePercent === 'number' ? data.coveragePercent : 0,
    requirements: safeArray<RequirementCoverageItem>(data.requirements),
  };
}

/**
 * Normalizes a process coverage response.
 * Ensures the processes array is always an array.
 */
export function normalizeProcessCoverage(raw: unknown): ProcessCoverageResponse {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PROCESS_COVERAGE };
  }

  const data = raw as Record<string, unknown>;

  return {
    total: typeof data.total === 'number' ? data.total : 0,
    covered: typeof data.covered === 'number' ? data.covered : 0,
    uncovered: typeof data.uncovered === 'number' ? data.uncovered : 0,
    coveragePercent: typeof data.coveragePercent === 'number' ? data.coveragePercent : 0,
    processes: safeArray<ProcessCoverageItem>(data.processes),
  };
}

/**
 * Normalized coverage data structure
 */
export interface NormalizedCoverageData {
  summary: CoverageSummary;
  requirementCoverage: RequirementCoverageResponse;
  processCoverage: ProcessCoverageResponse;
}

/**
 * Normalizes all coverage data from API responses.
 * This is the main entry point for normalizing coverage page data.
 *
 * @param summaryRaw - Raw summary response
 * @param requirementRaw - Raw requirement coverage response
 * @param processRaw - Raw process coverage response
 * @returns Normalized data with guaranteed safe array fields
 */
export function normalizeCoverageData(
  summaryRaw: unknown,
  requirementRaw: unknown,
  processRaw: unknown
): NormalizedCoverageData {
  return {
    summary: normalizeCoverageSummary(summaryRaw),
    requirementCoverage: normalizeRequirementCoverage(requirementRaw),
    processCoverage: normalizeProcessCoverage(processRaw),
  };
}
