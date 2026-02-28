/**
 * i18n Module
 * 
 * Phase 1: react-i18next integration with user-selectable locale.
 * Supports en-US and tr-TR with JSON translation files.
 * 
 * Legacy keys (ADMIN_DATA_MODEL_KEYS, etc.) are preserved for backward
 * compatibility with Admin Studio screens (FAZ 2/3/5).
 */

// Initialize i18next (must be imported before any component uses useTranslation)
import './config';

export { default as i18n } from './config';
export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';

// Legacy exports for backward compatibility with Admin Studio screens
export { 
  ADMIN_DATA_MODEL_KEYS, 
  ADMIN_DATA_MODEL_EN, 
  ADMIN_SECURITY_KEYS,
  ADMIN_SECURITY_EN,
  ADMIN_PLATFORM_KEYS,
  ADMIN_PLATFORM_EN,
  t 
} from './keys';
