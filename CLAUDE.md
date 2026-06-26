## Project Management

- This project uses pnpm. DO NOT use npm.
- Lint and format with oxlint and oxfmt (default settings). Type-check with `tsc`.
- Two packages: `@toad-contracts/core` (contract logic against the Standard Schema interface) and
  `@toad-contracts/valibot` (a thin valibot adapter that re-exports core). Keep core free of any
  schema-library runtime dependency; library-specific behavior belongs in an adapter.

## Changesets

- Every PR that changes published package code needs at least ONE changeset.
- Create one changeset per logical change (not per package).
- Create manually: add `.changeset/<descriptive-name>.md` with YAML front matter listing
  `"@toad-contracts/core": patch|minor|major` and/or `"@toad-contracts/valibot": ...` and a concise
  summary.
- Changeset summaries should be specific ("add streamResponse body type" not "update contracts").

Example:

```md
---
"@toad-contracts/core": minor
---

One-line summary of what changed.
```
