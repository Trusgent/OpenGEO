---
name: visibility-check
description: Run OpenGEO visibility checks across AI answer engines and summarize mention/citation results.
---

# Visibility Check

## Goal

Measure whether the brand is mentioned and cited for tracked prompts.

## Steps

1. Confirm project with `get_project`.
2. Ensure prompts exist (`list_prompts`); if empty, route to `/prompt-research`.
3. Start `run_visibility_batch`.
4. Poll `get_job_status` until completed or failed.
5. Read `get_visibility_snapshot` and `get_share_of_voice`.
6. Summarize mention rate, citation rate, strongest/weakest engines, and top competitor pressure.

## Output

Keep the summary actionable. Offer `/citation-gap` next.
