

## Fix: Flush DB after every batch + increase parallelism

**Single file change: `supabase/functions/build-longlist/index.ts`**

1. Change `BATCH_SIZE` from 5 to 20
2. Remove `DB_FLUSH_SIZE` constant (no longer needed)
3. Replace the conditional flush (`if (pendingUpdates.length >= DB_FLUSH_SIZE)`) with unconditional `await flushUpdates()` after every batch

This ensures each batch of 20 candidates is written to the DB immediately, so the next iteration fetches truly new pending candidates instead of re-processing the same ones.

