---
name: geo-readiness
description: Audit public GEO readiness signals such as homepage, robots.txt, llms.txt, and sitemap for an OpenGEO project.
---

# GEO Readiness

## Goal

Quickly check whether the brand domain exposes basic AI-crawler-friendly entrypoints.

## Steps

1. Confirm the project with `get_project`.
2. Call `audit_geo_readiness` (optionally pass `base_url` for staging).
3. Summarize score and failed checks.
4. If `llms_txt` or `robots_txt` fails, recommend publishing those files before heavy prompt tracking.
5. Offer `/visibility-check` once the basics are in place.
