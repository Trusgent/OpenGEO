---
name: citation-gap
description: Find domains and URLs cited in AI answers where the brand is weak or missing.
---

# Citation Gap

## Goal

Identify who gets cited instead of the brand, and on which prompts.

## Steps

1. `get_visibility_snapshot` — if missing, run `/visibility-check` first.
2. `get_citation_gaps`.
3. Group gaps by competitor domain vs third-party sources.
4. Rank by frequency and prompt coverage.
5. Recommend 3 pages or content types to create or improve.

## Output

A short gap table plus three recommended targets for `/geo-brief`.
