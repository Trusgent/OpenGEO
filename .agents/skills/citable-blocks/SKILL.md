---
name: citable-blocks
description: Generate publishable citable content blocks (definition, comparison, FAQ, sourced bullets) from an OpenGEO brief.
---

# Citable Blocks

## Goal

Produce copy-ready Markdown blocks designed to be quoted by AI answer engines.

## Steps

1. Use latest brief or generate one with `generate_geo_brief`.
2. Call `generate_citable_blocks` for selected actions/formats.
3. Review claims — keep them factual and sourceable on the user's domain.
4. Give the user paste-ready Markdown and the intended target URL.
5. Remind them to publish, then run `/geo-recheck`.

## Formats

- definition
- comparison
- faq
- sourced_bullets
