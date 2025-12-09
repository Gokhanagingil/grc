# Search Abstraction Layer Design

## Overview

The Search Abstraction Layer provides a unified search interface that supports multiple search engines. Currently implemented with PostgreSQL (ILIKE-based search), it's designed to seamlessly integrate Elasticsearch or OpenSearch in the future without requiring changes to consuming code.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SearchController                          │
│  POST /grc/search, /grc/search/risks, /grc/search/policies  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SearchService                           │
│  - Engine abstraction (postgres, elasticsearch)              │
│  - Entity-specific search methods                            │
│  - Query DSL integration                                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │  Elasticsearch  │ │   OpenSearch    │
│   (ILIKE)       │ │   (Future)      │ │   (Future)      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Search Engines

```typescript
enum SearchEngine {
  POSTGRES = 'postgres',
  ELASTICSEARCH = 'elasticsearch',
}
```

### PostgreSQL Engine (Default)

Uses ILIKE for text search with the following features:
- Case-insensitive matching
- Multi-field search
- Configurable search fields per entity
- Full TypeORM query builder integration

### Elasticsearch Engine (Future)

Stub implementation ready for:
- Full-text search with relevance scoring
- Fuzzy matching
- Aggregations and facets
- Highlighting

## Searchable Entities

```typescript
type SearchableEntity = 'risk' | 'policy' | 'requirement';
```

### Entity Configuration

Each entity has configurable search fields:

| Entity | Default Search Fields |
|--------|----------------------|
| risk | title, description, category |
| policy | name, summary, category |
| requirement | title, description, framework |

## API Endpoints

### Generic Search
```
POST /grc/search
Body: {
  entity: 'risk' | 'policy' | 'requirement',
  query?: string,
  dsl?: QueryDSL,
  page?: number,
  pageSize?: number,
  sortBy?: string,
  sortOrder?: 'ASC' | 'DESC',
  searchFields?: string[]
}
```

### Entity-Specific Search
```
POST /grc/search/risks
POST /grc/search/policies
POST /grc/search/requirements
Body: {
  query?: string,
  dsl?: QueryDSL,
  page?: number,
  pageSize?: number,
  sortBy?: string,
  sortOrder?: 'ASC' | 'DESC',
  searchFields?: string[]
}
```

## Search Query DTO

```typescript
interface SearchQueryDto {
  query?: string;           // Text search query
  dsl?: QueryDSL;          // Advanced filtering
  page?: number;           // Page number (default: 1)
  pageSize?: number;       // Items per page (default: 20)
  sortBy?: string;         // Sort field
  sortOrder?: 'ASC' | 'DESC';
  searchFields?: string[]; // Fields to search
}
```

## Search Result DTO

```typescript
interface SearchResultDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query?: string;
  engine: SearchEngine;
}
```

## Service Implementation

### SearchService

Key methods:

```typescript
class SearchService {
  // Generic search with entity type
  async search<T>(
    tenantId: string,
    entity: SearchableEntity,
    query: SearchQueryDto
  ): Promise<SearchResultDto<T>>

  // Entity-specific convenience methods
  async searchRisks(tenantId: string, query: SearchQueryDto): Promise<SearchResultDto<GrcRisk>>
  async searchPolicies(tenantId: string, query: SearchQueryDto): Promise<SearchResultDto<GrcPolicy>>
  async searchRequirements(tenantId: string, query: SearchQueryDto): Promise<SearchResultDto<GrcRequirement>>
}
```

### PostgreSQL Search Implementation

```typescript
private applyTextSearch<T>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  searchQuery: string,
  fields: string[]
): void {
  const conditions = fields.map((field, index) => {
    const paramName = `search_${index}`;
    return `${alias}.${field} ILIKE :${paramName}`;
  });
  
  const params = fields.reduce((acc, _, index) => {
    acc[`search_${index}`] = `%${searchQuery}%`;
    return acc;
  }, {});
  
  qb.andWhere(`(${conditions.join(' OR ')})`, params);
}
```

## Query DSL Integration

The SearchService integrates with QueryDSLService for advanced filtering:

```typescript
if (dsl) {
  this.queryDSLService.applyDSL(qb, dsl, alias);
}
```

See [QUERY-DSL-SPEC.md](./QUERY-DSL-SPEC.md) for DSL details.

## Frontend Integration

### searchApi Client

```typescript
export const searchApi = {
  search: (tenantId, entity, query) => 
    api.post('/grc/search', { entity, ...query }, withTenantId(tenantId)),
  
  searchRisks: (tenantId, query) => 
    api.post('/grc/search/risks', query, withTenantId(tenantId)),
  
  searchPolicies: (tenantId, query) => 
    api.post('/grc/search/policies', query, withTenantId(tenantId)),
  
  searchRequirements: (tenantId, query) => 
    api.post('/grc/search/requirements', query, withTenantId(tenantId)),
};
```

## Security

- All endpoints require authentication
- Entity-specific permissions:
  - GRC_RISK_READ for risk search
  - GRC_POLICY_READ for policy search
  - GRC_REQUIREMENT_READ for requirement search
- Multi-tenant isolation via tenantId

## Performance Considerations

### PostgreSQL

- ILIKE queries can be slow on large datasets
- Consider adding GIN indexes for full-text search:
  ```sql
  CREATE INDEX idx_risks_search ON grc_risks 
  USING gin(to_tsvector('english', title || ' ' || description));
  ```

### Elasticsearch Migration

When migrating to Elasticsearch:
1. Set up Elasticsearch cluster
2. Create index mappings for each entity
3. Implement sync mechanism (event-driven or scheduled)
4. Update SearchService to use Elasticsearch client
5. Configure engine via environment variable

## Future Enhancements

- Elasticsearch/OpenSearch integration
- Full-text search with PostgreSQL tsvector
- Search suggestions/autocomplete
- Search analytics and popular queries
- Saved searches
- Search result highlighting
- Faceted search with aggregations
