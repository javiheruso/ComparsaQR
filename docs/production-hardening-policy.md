## Production Hardening Policy Notes

### Rounding policy

- Canonical money scale is **2 decimal places** everywhere.
- Canonicalization uses **half-up rounding** (`1.005` → `1.01`).
- Input that already must be canonical can be rejected in strict paths instead of silently rewritten.
- Stored values, replay payloads, and API responses must all preserve the same canonical amount.

### Idempotency policy

- The idempotency scope is **command + resource identity** (for example `member-credit:9`).
- A repeated key with the **same canonical payload** must return the original response and must not create a second financial effect.
- A repeated key with a **different payload hash** must fail with **409 Conflict**.
- Batch/import/sync flows may derive a deterministic batch key from the payload when the caller does not send `x-idempotency-key`, so retries still collapse onto the same per-item receipts.

### Retention policy

- The hardened implementation currently keeps completed idempotency receipts in the database with **no automatic expiry**.
- This means the effective retention policy is **indefinite until an explicit cleanup job or migration is introduced**.
- Any future pruning policy must preserve replay safety for the supported retry window before deleting receipts.

### Verification note

- In this Linux clone, `npm test`, `npm run lint`, and `npx tsc --noEmit` currently jump through the Windows npm shim on the UNC workspace path, so command results must be recorded alongside native fallback executions when proving the hardened slice.
