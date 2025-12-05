# GRC Analytics, Filtering & Reporting

This document describes the analytics, filtering, and reporting capabilities of the GRC module in the NestJS backend. It is intended for BI/dashboard consumers, frontend developers, and API integrators.

## Overview

The GRC module provides standardized pagination, sorting, filtering, and summary endpoints for all three core entities: Risks, Policies, and Requirements. All endpoints are tenant-scoped and require authentication.

## Authentication

All GRC endpoints require:
- **JWT Bearer Token**: Include in the `Authorization` header as `Bearer <token>`
- **Tenant ID**: Include in the `x-tenant-id` header

Example:
```bash
curl -X GET "http://localhost:3002/grc/risks" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "x-tenant-id: <your-tenant-uuid>"
```

## Pagination

All list endpoints return paginated responses with the following structure:

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

### Pagination Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `pageSize` | integer | 20 | 100 | Number of items per page |

### Example

```bash
# Get page 2 with 10 items per page
GET /grc/risks?page=2&pageSize=10
```

## Sorting

All list endpoints support sorting by various fields.

### Sorting Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortOrder` | string | `DESC` | Sort direction: `ASC` or `DESC` |

### Sortable Fields by Entity

**Risks:**
- `createdAt`, `updatedAt`, `title`, `status`, `severity`, `likelihood`, `impact`, `dueDate`, `score`

**Policies:**
- `createdAt`, `updatedAt`, `name`, `status`, `code`, `effectiveDate`, `reviewDate`, `version`

**Requirements:**
- `createdAt`, `updatedAt`, `title`, `framework`, `referenceCode`, `status`, `priority`, `dueDate`

### Example

```bash
# Sort risks by severity in ascending order
GET /grc/risks?sortBy=severity&sortOrder=ASC

# Sort policies by name alphabetically
GET /grc/policies?sortBy=name&sortOrder=ASC
```

## Filtering

Each entity has specific filter parameters that can be combined with pagination and sorting.

### Risk Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | Filter by status: `draft`, `identified`, `assessed`, `mitigating`, `accepted`, `closed` |
| `severity` | enum | Filter by severity: `low`, `medium`, `high`, `critical` |
| `likelihood` | enum | Filter by likelihood: `rare`, `unlikely`, `possible`, `likely`, `almost_certain` |
| `impact` | enum | Filter by impact: `low`, `medium`, `high`, `critical` |
| `category` | string | Filter by category |
| `ownerUserId` | uuid | Filter by owner user ID |
| `createdFrom` | date | Filter by creation date (from) |
| `createdTo` | date | Filter by creation date (to) |
| `dueDateFrom` | date | Filter by due date (from) |
| `dueDateTo` | date | Filter by due date (to) |
| `search` | string | Search in title and description (case-insensitive) |

### Policy Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | Filter by status: `draft`, `under_review`, `approved`, `active`, `retired` |
| `category` | string | Filter by category |
| `code` | string | Filter by policy code |
| `ownerUserId` | uuid | Filter by owner user ID |
| `approvedByUserId` | uuid | Filter by approver user ID |
| `createdFrom` | date | Filter by creation date (from) |
| `createdTo` | date | Filter by creation date (to) |
| `effectiveDateFrom` | date | Filter by effective date (from) |
| `effectiveDateTo` | date | Filter by effective date (to) |
| `reviewDateFrom` | date | Filter by review date (from) |
| `reviewDateTo` | date | Filter by review date (to) |
| `search` | string | Search in name, summary, and code (case-insensitive) |

### Requirement Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `framework` | enum | Filter by framework: `iso27001`, `soc2`, `gdpr`, `hipaa`, `pci_dss`, `nist`, `other` |
| `status` | string | Filter by status |
| `category` | string | Filter by category |
| `priority` | string | Filter by priority |
| `referenceCode` | string | Filter by reference code |
| `ownerUserId` | uuid | Filter by owner user ID |
| `createdFrom` | date | Filter by creation date (from) |
| `createdTo` | date | Filter by creation date (to) |
| `dueDateFrom` | date | Filter by due date (from) |
| `dueDateTo` | date | Filter by due date (to) |
| `search` | string | Search in title, description, and reference code (case-insensitive) |

### Filter Examples

```bash
# Get high-severity risks that are identified
GET /grc/risks?severity=high&status=identified

# Get active policies in the Security category
GET /grc/policies?status=active&category=Security

# Get ISO 27001 requirements that are compliant
GET /grc/requirements?framework=iso27001&status=compliant

# Search for risks containing "data breach"
GET /grc/risks?search=data%20breach

# Get risks created in the last 30 days
GET /grc/risks?createdFrom=2024-11-01&createdTo=2024-11-30

# Combine filters with pagination and sorting
GET /grc/risks?severity=high&status=identified&page=1&pageSize=10&sortBy=createdAt&sortOrder=DESC
```

## Summary Endpoints

Summary endpoints provide aggregated data for dashboards and reporting. All summary endpoints are tenant-scoped.

### Risk Summary

**Endpoint:** `GET /grc/risks/summary`

**Response:**
```json
{
  "total": 45,
  "byStatus": {
    "identified": 15,
    "assessed": 12,
    "mitigating": 10,
    "accepted": 5,
    "closed": 3
  },
  "bySeverity": {
    "low": 10,
    "medium": 20,
    "high": 12,
    "critical": 3
  },
  "byLikelihood": {
    "rare": 5,
    "unlikely": 10,
    "possible": 15,
    "likely": 10,
    "almost_certain": 5
  },
  "byCategory": {
    "Operational": 15,
    "Security": 12,
    "Compliance": 10,
    "Financial": 8
  },
  "highPriorityCount": 15,
  "overdueCount": 3
}
```

### Policy Summary

**Endpoint:** `GET /grc/policies/summary`

**Response:**
```json
{
  "total": 25,
  "byStatus": {
    "draft": 5,
    "under_review": 3,
    "approved": 2,
    "active": 12,
    "retired": 3
  },
  "byCategory": {
    "Security": 8,
    "Privacy": 6,
    "Compliance": 5,
    "Operations": 6
  },
  "dueForReviewCount": 4,
  "activeCount": 12,
  "draftCount": 5
}
```

### Requirement Summary

**Endpoint:** `GET /grc/requirements/summary`

**Response:**
```json
{
  "total": 120,
  "byFramework": {
    "iso27001": 45,
    "soc2": 30,
    "gdpr": 25,
    "hipaa": 20
  },
  "byStatus": {
    "not_started": 20,
    "in_progress": 35,
    "compliant": 50,
    "non_compliant": 15
  },
  "byCategory": {
    "Access Control": 25,
    "Data Protection": 30,
    "Incident Response": 20,
    "Risk Management": 25,
    "Other": 20
  },
  "byPriority": {
    "High": 40,
    "Medium": 50,
    "Low": 30
  },
  "compliantCount": 50,
  "nonCompliantCount": 15,
  "inProgressCount": 35
}
```

## BI Tool Integration

### Power BI

To connect Power BI to the GRC API:

1. Use the **Web** data source in Power BI Desktop
2. Enter the API URL (e.g., `https://your-api.com/grc/risks/summary`)
3. Configure authentication:
   - Select **Advanced** options
   - Add HTTP headers:
     - `Authorization`: `Bearer <your-token>`
     - `x-tenant-id`: `<your-tenant-uuid>`
4. Transform the JSON response as needed

For paginated data, you may need to use Power Query M to iterate through pages:

```m
let
    BaseUrl = "https://your-api.com/grc/risks",
    GetPage = (page) =>
        let
            Response = Web.Contents(BaseUrl, [
                Query = [page = Text.From(page), pageSize = "100"],
                Headers = [
                    Authorization = "Bearer <token>",
                    #"x-tenant-id" = "<tenant-uuid>"
                ]
            ]),
            Json = Json.Document(Response)
        in
            Json,
    FirstPage = GetPage(1),
    TotalPages = FirstPage[totalPages],
    AllPages = List.Generate(
        () => [Page = 1, Data = FirstPage],
        each [Page] <= TotalPages,
        each [Page = [Page] + 1, Data = GetPage([Page] + 1)],
        each [Data][items]
    ),
    Combined = List.Combine(AllPages)
in
    Combined
```

### Grafana

To visualize GRC data in Grafana:

1. Install the **JSON API** data source plugin
2. Configure the data source:
   - URL: `https://your-api.com`
   - Add custom headers for authentication
3. Create panels using the summary endpoints for quick metrics
4. Use the list endpoints with filters for detailed tables

Example Grafana query for risk summary:
```
Path: /grc/risks/summary
Method: GET
Headers:
  Authorization: Bearer <token>
  x-tenant-id: <tenant-uuid>
```

### Tableau

To connect Tableau to the GRC API:

1. Use the **Web Data Connector** or **JSON file** approach
2. For real-time data, create a custom Web Data Connector
3. For scheduled refreshes, use a script to export data to JSON/CSV

### Custom Dashboards

For custom dashboard implementations:

1. **Polling Interval**: Summary endpoints are lightweight; polling every 30-60 seconds is reasonable
2. **Caching**: Consider caching summary responses for 1-5 minutes on the client side
3. **Error Handling**: Handle 401 (unauthorized) and 400 (bad request) errors gracefully
4. **Rate Limiting**: The API has rate limiting; implement exponential backoff for retries

## Best Practices

1. **Use Summary Endpoints for Dashboards**: Summary endpoints are optimized for aggregate data and are more efficient than fetching all records and aggregating client-side.

2. **Paginate Large Datasets**: Always use pagination when fetching list data. The default page size is 20, maximum is 100.

3. **Filter Server-Side**: Apply filters on the server rather than fetching all data and filtering client-side.

4. **Cache Appropriately**: Summary data can be cached for short periods (1-5 minutes) to reduce API load.

5. **Handle Tenant Context**: Always include the `x-tenant-id` header. Data is strictly isolated by tenant.

6. **Use Search for Text Queries**: The `search` parameter performs case-insensitive partial matching across relevant text fields.

7. **Combine Filters**: Multiple filters are combined with AND logic. Use this to narrow down results efficiently.

## API Reference Quick Links

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/grc/risks` | GET | List risks with pagination, sorting, filtering |
| `/grc/risks/summary` | GET | Get risk summary for dashboards |
| `/grc/policies` | GET | List policies with pagination, sorting, filtering |
| `/grc/policies/summary` | GET | Get policy summary for dashboards |
| `/grc/requirements` | GET | List requirements with pagination, sorting, filtering |
| `/grc/requirements/summary` | GET | Get requirement summary for dashboards |

## Changelog

- **v1.0.0** (2024-12): Initial release with pagination, sorting, filtering, and summary endpoints
