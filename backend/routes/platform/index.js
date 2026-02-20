/**
 * Platform Routes Index
 * 
 * Exports all platform-related routes:
 * - ACL (Access Control List)
 * - Form Layouts
 * - UI Policies
 * - Modules
 * - Search (DSL-based queries)
 * - Metadata (Phase 7)
 */

const aclRoutes = require('./acl');
const formLayoutRoutes = require('./form-layout');
const uiPolicyRoutes = require('./ui-policy');
const moduleRoutes = require('./modules');
const searchRoutes = require('./search');
const metadataRoutes = require('./metadata');

module.exports = {
  aclRoutes,
  formLayoutRoutes,
  uiPolicyRoutes,
  moduleRoutes,
  searchRoutes,
  metadataRoutes
};
