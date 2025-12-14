import { SuiteType } from '../entities/tenant-active-suite.entity';
import { ModuleType } from '../entities/tenant-enabled-module.entity';

export interface SuiteDefinition {
  suiteType: SuiteType;
  name: string;
  description: string;
  defaultModules: ModuleType[];
}

export const SUITE_MANIFEST: Record<SuiteType, SuiteDefinition> = {
  [SuiteType.GRC_SUITE]: {
    suiteType: SuiteType.GRC_SUITE,
    name: 'GRC Suite',
    description: 'Governance, Risk, and Compliance management suite',
    defaultModules: [
      ModuleType.RISK,
      ModuleType.POLICY,
      ModuleType.CONTROL,
      ModuleType.AUDIT,
    ],
  },
  [SuiteType.ITSM_SUITE]: {
    suiteType: SuiteType.ITSM_SUITE,
    name: 'ITSM Suite',
    description: 'IT Service Management suite',
    defaultModules: [
      ModuleType.INCIDENT,
      ModuleType.REQUEST,
      ModuleType.CHANGE,
      ModuleType.PROBLEM,
      ModuleType.CMDB,
    ],
  },
};

export function getDefaultModulesForSuite(suiteType: SuiteType): ModuleType[] {
  return SUITE_MANIFEST[suiteType]?.defaultModules ?? [];
}

export function getSuiteForModule(moduleType: ModuleType): SuiteType | null {
  for (const [suiteType, definition] of Object.entries(SUITE_MANIFEST)) {
    if (definition.defaultModules.includes(moduleType)) {
      return suiteType as SuiteType;
    }
  }
  return null;
}

export function isGrcModule(moduleType: ModuleType): boolean {
  return SUITE_MANIFEST[SuiteType.GRC_SUITE].defaultModules.includes(
    moduleType,
  );
}

export function isItsmModule(moduleType: ModuleType): boolean {
  return SUITE_MANIFEST[SuiteType.ITSM_SUITE].defaultModules.includes(
    moduleType,
  );
}
