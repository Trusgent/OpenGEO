---
name: geo-recheck
description: Re-run OpenGEO prompts after publishing and explain what changed in mentions, citations, and share of voice.
---

# GEO Re-check

## Goal

Prove whether published changes improved AI answer visibility.

## Steps

1. Capture the baseline snapshot id from `get_visibility_snapshot`.
2. Call `run_recheck` with that baseline.
3. Poll `get_job_status`.
4. Call `get_recheck_diff` with before/after snapshot ids.
5. Explain deltas, new own-domain citations, and persistent gaps.

## Output

A short scoreboard plus the next best action if gaps remain.
