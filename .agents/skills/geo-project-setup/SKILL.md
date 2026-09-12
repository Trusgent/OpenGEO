---
name: geo-project-setup
description: Create or refresh an OpenGEO project — brand, domain, competitors, and initial prompts. Use when starting GEO work for a website or brand.
---

# GEO Project Setup

## Goal

Create one OpenGEO project and store enough context to run visibility checks.

## Steps

1. Call `whoami` and `list_projects`.
2. If no matching project exists, call `create_project` with name, brand, domain, market, and up to 5 competitors.
3. Call `suggest_prompts`, review candidates with the user, then `upsert_prompts`.
4. Summarize project id, brand, domain, competitor count, and prompt count.
5. Suggest next step: `/visibility-check`.

## Rules

- Ask in small batches.
- Do not run paid/live checks during setup unless the user asks.
- Keep the summary under 120 words.
