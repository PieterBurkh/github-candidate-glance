

# Delete Stuck Run

The run `c62ae670-6e3d-4fdc-afd1-d200d27fde96` is stuck in "running" status. I'll delete it along with any repos associated with it.

## Steps

1. Delete repos linked to run `c62ae670-6e3d-4fdc-afd1-d200d27fde96`
2. Delete any `repo_signals` linked to those repos (if any)
3. Delete the run itself

No code changes needed — just data cleanup via SQL DELETE statements.

