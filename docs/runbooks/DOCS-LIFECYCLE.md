# Docs Lifecycle Runbook

> **Version:** 1.0 | **Last Updated:** 2026-02-27 | **Status:** Active

---

## 1. Purpose

Keep product documentation accurate and up-to-date as the codebase evolves.
This runbook describes the lightweight process introduced by **Docs Lifecycle Pack v1**.

---

## 2. Components

| Component | Location | Purpose |
|-----------|----------|---------|
| PR Template — Docs Impact | `.github/pull_request_template.md` | Every PR author declares whether docs are affected |
| CODEOWNERS | `CODEOWNERS` | Auto-assigns reviewers for docs changes |
| CI — Docs Checks | `.github/workflows/docs-ci.yml` | Lints markdown, checks relative links, flags raw HTML |
| Docs Backlog | `docs/DOCS_BACKLOG.md` | Append-only log of deferred doc updates |
| Suite Frontmatter | `docs/suite/*.md` | Optional `Owner:` line for at-a-glance ownership |

---

## 3. PR Workflow

### 3.1 Author Responsibilities

When opening a PR, fill in the **Docs Impact** section of the PR template:

| Choice | Action Required |
|--------|----------------|
| **None** | No docs changes needed. Check the box and move on. |
| **Updated** | Docs are updated in this PR. List the changed files. |
| **Deferred** | Docs update is needed but not included. Add a line to `docs/DOCS_BACKLOG.md` with the PR number, area, and description. |

### 3.2 Reviewer Responsibilities

- If a PR touches code that could affect docs (new features, API changes, config changes), verify the Docs Impact section is filled in correctly.
- If Docs Impact is "Deferred," confirm a backlog entry exists in `docs/DOCS_BACKLOG.md`.

---

## 4. CODEOWNERS

The `CODEOWNERS` file ensures that changes to documentation files automatically request review from the designated owner.

| Path Pattern | Owner Domain |
|-------------|-------------|
| `docs/suite/01*` | Infrastructure |
| `docs/suite/02*` | Architecture |
| `docs/suite/03*` | ITSM |
| `docs/suite/04*` | GRC |
| `docs/suite/05*` | Bridges |
| `docs/suite/06*` | AI |

To update owners, edit `CODEOWNERS` in the repo root.

---

## 5. CI Docs Checks

The `docs-ci.yml` workflow runs on every PR that touches `docs/**` or `*.md` files. It performs three checks:

### 5.1 Markdown Lint

Uses `markdownlint-cli2` with a relaxed rule set (see `.github/workflows/docs-ci.yml`).
Catches common issues: trailing whitespace, missing blank lines, inconsistent heading levels.

### 5.2 Broken Relative Link Check

A shell script scans all `.md` files under `docs/` for relative links (`[text](./path)` or `[text](../path)`) and verifies the target file exists.
This prevents dead links caused by file renames or deletions.

### 5.3 Raw HTML Block Check

Scans for raw HTML block-level elements (`<div>`, `<table>`, `<details>`, `<iframe>`, `<script>`, `<style>`) that may be stripped by strict Markdown renderers.
Inline HTML like `<br>`, `<sub>`, `<sup>`, `<kbd>`, `<code>` is allowed.

---

## 6. Docs Backlog Process

### Adding an Entry

When marking Docs Impact as **Deferred**, append a row to `docs/DOCS_BACKLOG.md`:

```markdown
| 2026-02-27 | #123 | GRC | Add docs for new risk heatmap endpoint | @owner | open |
```

### Closing an Entry

When the deferred docs update is completed in a subsequent PR, change the Status column from `open` to `done` and reference the PR that resolved it.

### Periodic Review

Doc owners should review the backlog at least once per sprint/release cycle and pick up outstanding items.

---

## 7. Suite Frontmatter (Optional)

Each doc in `docs/suite/` may include an `Owner:` line in its header block for at-a-glance ownership:

```markdown
> **Version:** 2.0 | **Last Updated:** 2026-02-27 | **Status:** Final | **Owner:** @infra-team
```

This is informational only and does not replace CODEOWNERS for automated review assignment.
