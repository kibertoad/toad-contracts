---
"@toad-contracts/core": minor
---

Export `resolveStatusEntry`: resolves the raw contract response entry for a status code with
exact → range → `'default'` precedence, before content-type resolution. `resolveResponseEntry` now
builds on it, and adapters can reuse the lookup without duplicating the range-key boundaries.
