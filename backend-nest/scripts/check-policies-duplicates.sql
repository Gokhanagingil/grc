-- Check for duplicate policy codes per tenant
-- This script is a preflight check before adding UNIQUE(code, tenant_id) constraint
-- Run this script to identify any existing duplicate policy codes that would prevent
-- adding the unique constraint in a future migration.
--
-- Usage:
--   psql -d grc -f check-policies-duplicates.sql
--   OR
--   sqlite3 data/grc.sqlite < check-policies-duplicates.sql
--
-- This script is read-only and idempotent (safe to run multiple times)

-- PostgreSQL version (if using PostgreSQL)
-- Uncomment if using PostgreSQL:
/*
SELECT
  tenant_id,
  code,
  COUNT(*) AS duplicate_count
FROM policies
GROUP BY tenant_id, code
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, tenant_id, code;
*/

-- SQLite version (if using SQLite)
-- Uncomment if using SQLite:
/*
SELECT
  tenant_id,
  code,
  COUNT(*) AS duplicate_count
FROM policies
GROUP BY tenant_id, code
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, tenant_id, code;
*/

-- Universal version (works for both PostgreSQL and SQLite)
-- This version uses standard SQL that works on both databases
SELECT
  tenant_id,
  code,
  COUNT(*) AS duplicate_count
FROM policies
GROUP BY tenant_id, code
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, tenant_id, code;

-- To inspect a specific duplicate group, uncomment and replace values:
-- Replace 'TENANT-UUID-HERE' with actual tenant_id
-- Replace 'POLICY-CODE-HERE' with actual code
/*
SELECT
  id,
  tenant_id,
  code,
  title,
  status,
  created_at,
  updated_at
FROM policies
WHERE tenant_id = 'TENANT-UUID-HERE'
  AND code = 'POLICY-CODE-HERE'
ORDER BY created_at;
*/

-- Summary query: Count total duplicate groups per tenant
SELECT
  tenant_id,
  COUNT(*) AS duplicate_groups_count
FROM (
  SELECT
    tenant_id,
    code
  FROM policies
  GROUP BY tenant_id, code
  HAVING COUNT(*) > 1
) AS duplicates
GROUP BY tenant_id
ORDER BY duplicate_groups_count DESC;

