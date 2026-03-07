

## Analysis: Why only ~187 in 140 seconds

The bottleneck is **sequential processing** on line 182. Each candidate goes through this waterfall:

1. GitHub fetch user profile (~200ms)
2. GitHub fetch repos (~300ms)  
3. Parse JSON + score (~1ms)
4. DB write to update candidate (~100ms)

Steps 1-2 are parallelized per candidate, but candidates themselves run **one at a time**. That's ~600ms per candidate × 187 = ~112 seconds. The math checks out — you're at the sequential limit.

## Fix: Parallel candidate processing

Process multiple candidates concurrently using `Promise.allSettled` with controlled concurrency (10 at a time), and batch DB writes.

### Changes to `supabase/functions/build-longlist/index.ts`:

1. **Increase `BATCH_SIZE` to 50** — fetch more pending candidates per loop
2. **Add concurrency control** — process 10 candidates in parallel using a semaphore pattern
3. **Batch DB updates** — collect all updates in an array, write them in one loop after parallel processing completes

This should yield ~10x throughput: processing 10 candidates in the same ~600ms window instead of 1, reaching **500-700 candidates per 140s invocation**.

### Risk mitigation
- 10 concurrent GitHub requests is well within rate limits (2 requests × 10 = 20 concurrent, GitHub allows this)
- `Promise.allSettled` ensures one failure doesn't kill the batch
- Still respects the timeout deadline check between batches

