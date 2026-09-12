---
name: geo-brief
description: Generate an OpenGEO Action Brief from citation gaps — prioritized weekly actions with evidence.
---

# GEO Brief

## Goal

Turn visibility gaps into a concrete weekly action list.

## Steps

1. Ensure a recent snapshot exists.
2. Call `generate_geo_brief`.
3. Review each action: why, what, target, evidence.
4. Ask the user which actions to execute this week.
5. Offer `/citable-blocks` for selected actions.

## Output

Return the brief title and the top actions in priority order.
