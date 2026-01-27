# Statement of Applicability (SOA) Module

## Overview

The Statement of Applicability (SOA) is a key document in information security management that maps standard clauses (such as ISO 27001 or NIST controls) to an organization's specific implementation status. This module enables organizations to create, manage, and export SOA profiles for compliance and audit purposes.

## Key Concepts

### SOA Profile

An SOA Profile represents a complete Statement of Applicability document for a specific standard. Each profile contains:

- **Name**: A descriptive name for the SOA (e.g., "ISO 27001:2022 - Production Environment")
- **Standard**: The compliance standard being mapped (e.g., ISO 27001, NIST CSF)
- **Scope Statement**: A description of what systems, processes, or organizational units are covered
- **Status**: The lifecycle state of the profile (Draft, Published, Archived)
- **Version**: Incremented each time the profile is published

### SOA Items

Each SOA Profile contains items that correspond to individual clauses from the selected standard. For each clause, you can specify:

- **Applicability**: Whether the clause applies to your organization
  - `APPLICABLE`: The clause is relevant and must be addressed
  - `NOT_APPLICABLE`: The clause does not apply (with justification)
  - `UNDECIDED`: Not yet determined

- **Implementation Status**: Current state of implementation
  - `IMPLEMENTED`: Fully implemented and operational
  - `PARTIALLY_IMPLEMENTED`: Some aspects implemented
  - `PLANNED`: Implementation is scheduled
  - `NOT_IMPLEMENTED`: Not yet started

- **Justification**: Explanation for applicability decisions (especially important for NOT_APPLICABLE items)
- **Target Date**: When implementation is expected to be complete
- **Notes**: Additional context or comments

### Linking Controls and Evidence

SOA Items can be linked to:

- **Controls**: Security controls from your control library that address the clause
- **Evidence**: Documentation or artifacts that demonstrate compliance

## Workflow

### 1. Create a Profile

1. Navigate to GRC > SOA
2. Click "New SOA Profile"
3. Select the standard you want to map
4. Provide a name, description, and scope statement
5. Save the profile

### 2. Initialize Items

After creating a profile, click "Initialize Items" to automatically create SOA items for every clause in the selected standard. This is idempotent - running it multiple times won't create duplicates.

### 3. Assess Each Item

For each SOA item:

1. Determine if the clause is applicable to your organization
2. If not applicable, provide a justification
3. Set the implementation status
4. Link relevant controls and evidence
5. Add notes as needed

### 4. Publish the Profile

When your assessment is complete:

1. Review all items for completeness
2. Click "Publish" to finalize the profile
3. The version number will increment
4. Published profiles can still be edited (creates a new draft version)

### 5. Export for Auditors

Click "Export CSV" to generate a spreadsheet containing:

- Clause code and title
- Applicability status and justification
- Implementation status
- Target dates
- Control and evidence counts

This CSV can be shared with auditors or used for reporting.

## Roles and Permissions

The SOA module uses existing GRC permissions:

- **GRC_REQUIREMENT_READ**: View SOA profiles and items
- **GRC_REQUIREMENT_WRITE**: Create, edit, and manage SOA profiles and items

## Best Practices

1. **Complete Justifications**: Always provide clear justifications for NOT_APPLICABLE items - auditors will ask about these

2. **Link Evidence**: Connect SOA items to evidence artifacts to demonstrate compliance during audits

3. **Regular Reviews**: Periodically review and update your SOA as your organization and controls evolve

4. **Version Control**: Use the publish feature to create snapshots before major changes

5. **Scope Clarity**: Write clear scope statements that define exactly what is covered by the SOA

## Multi-Tenant Support

SOA profiles are fully tenant-isolated. Each tenant can have their own SOA profiles without visibility into other tenants' data. The `x-tenant-id` header is required for all API operations.
