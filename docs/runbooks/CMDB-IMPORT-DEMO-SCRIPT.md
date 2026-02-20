# CMDB Import & Reconciliation — 1-Minute Demo Script

## Setup (before demo)

1. Ensure baseline CIs are seeded (`seed-cmdb-baseline.js`)
2. Ensure import demo data is seeded (`seed-cmdb-import-demo.js`)
3. Login as admin at `http://<host>/login`

---

## Demo Flow (60 seconds)

### Step 1: Navigate to Import Jobs (10s)

1. Open sidebar -> CMDB -> **Import Jobs**
2. Point out: "Here we see our import jobs with status chips and summary counts"
3. Note the COMPLETED status chip and the create/update/conflict/error counts

### Step 2: Open Job Detail (15s)

1. Click on the demo import job row
2. Point out the **summary cards** at top:
   - "5 would be created" (new CIs not in our CMDB)
   - "4 would be updated" (matched CIs with safe field changes)
   - "3 conflicts" (matched CIs with key field mismatches like IP changes)
   - "1 error" (row with missing hostname)
3. Note the **Dry-Run** banner: "This is a preview — no changes have been made yet"

### Step 3: Explore Tabs (15s)

1. Click **Rows** tab — show all 15 imported rows with status chips
2. Click **Results** tab — show reconcile outcomes (CREATE/UPDATE/CONFLICT/SKIP)
3. Click **Conflicts** tab — show only the 3 conflict rows

### Step 4: Explain Drawer (10s)

1. Click any UPDATE or CONFLICT result row
2. Show the **Explain drawer** that opens:
   - Which rule matched (e.g., "Hostname Exact Match")
   - Which fields were used for matching
   - Confidence score (1.0 for exact match)
   - Field-level diff showing old vs new values

### Step 5: Reconcile Rules (10s)

1. Navigate to sidebar -> CMDB -> **Reconcile Rules**
2. Show the 3 rules with precedence ordering:
   - #0: Hostname Exact Match
   - #1: IP Address Match
   - #2: Hostname + Environment Composite
3. Click Edit on one rule to show the strategy builder with field mappings and weights

### Key Takeaways

- **Dry-run first**: Every import starts as a preview. Admins can review before applying.
- **Deterministic**: Same data always produces the same counts.
- **Explainable**: Every match decision shows the rule, fields, and confidence.
- **Safe**: Key field conflicts (IP, serial number) are flagged, not auto-applied.
- **Multi-tenant**: All data is tenant-scoped. No cross-tenant leakage.
