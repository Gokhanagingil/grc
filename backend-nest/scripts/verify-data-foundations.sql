\set ON_ERROR_STOP on

-- Data Foundations Verification Script
-- Usage: psql -h localhost -U grc -d grc -f scripts/verify-data-foundations.sql

\echo '=== Data Foundations Verification ==='
\echo ''

\set TENANT_ID '217492b2-f814-4ba0-ae50-4e4f8ecf6216'

SELECT 
  'Standards' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END as status
FROM app.standard
WHERE tenant_id = :'TENANT_ID';

SELECT 
  'Clauses' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 400 THEN 'PASS' ELSE 'FAIL' END as status
FROM app.standard_clause
WHERE tenant_id = :'TENANT_ID';

SELECT 
  'Clauses Synthetic' as metric,
  COUNT(*) as count,
  'INFO' as status
FROM app.standard_clause
WHERE tenant_id = :'TENANT_ID' AND synthetic = true;

SELECT 
  'Controls' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 150 THEN 'PASS' ELSE 'FAIL' END as status
FROM app.control_library
WHERE tenant_id = :'TENANT_ID';

SELECT 
  'Risks' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 300 THEN 'PASS' ELSE 'FAIL' END as status
FROM app.risk_catalog
WHERE tenant_id = :'TENANT_ID';

SELECT 
  'Mappings' as metric,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 200 THEN 'PASS' ELSE 'FAIL' END as status
FROM app.standard_mapping
WHERE tenant_id = :'TENANT_ID';

SELECT 
  'Mappings Synthetic' as metric,
  COUNT(*) as count,
  'INFO' as status
FROM app.standard_mapping
WHERE tenant_id = :'TENANT_ID' AND synthetic = true;

-- Cross-impact test
\echo ''
\echo '=== Cross-Impact Test (ISO20000:8.4) ==='
SELECT 
  COUNT(*) as cross_impact_count,
  CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END as status
FROM app.standard_mapping sm
INNER JOIN app.standard_clause sc1 ON sm.from_clause_id = sc1.id
INNER JOIN app.standard_clause sc2 ON sm.to_clause_id = sc2.id
WHERE (sc1.clause_code = '8.4' OR sc2.clause_code = '8.4')
  AND (sc1.tenant_id = :'TENANT_ID' OR sc2.tenant_id = :'TENANT_ID')
  AND sm.tenant_id = :'TENANT_ID';

