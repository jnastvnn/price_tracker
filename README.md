# Price Tracker (LLM Extraction Pipeline Showcase)

This project showcases an LLM-based extraction pipeline for marketplace listings and a demo web app for exploring the results.

## Purpose

- Demonstrate the end-to-end extraction flow from raw listing data to structured attributes.
- Expose extracted and aggregated data through a backend API and demo frontend.
- Provide a practical baseline for improving data quality, speed, and reliability of LLM-assisted extraction.

## Current Deployment

- Hosted on **CSC cPouta**.
- Database hosted on **CSC Pukki DBaaS**: https://research.csc.fi/service/pukki-database-as-a-service-dbaas/
- Live demo: https://fip-128-214-255-64.kaj.poutavm.fi
- The website is currently in **demo status**.
- A **CI/CD container** setup is in planning.

## Demo Status Note

This is an active demo environment. Occasional performance issues may happen, especially on heavier category/listing queries.

## High-Impact TODO (Next Steps)

- [ ] Finalize CI/CD container workflow (build, test, deploy) for repeatable releases.
- [ ] Add database performance indexes and validate with `EXPLAIN ANALYZE` on slow endpoints.
- [ ] Reduce heavy query cost by avoiding duplicate count/group queries on listing endpoints.
- [ ] Add short-lived caching for hot API routes (category + grouped listings).
- [ ] Add monitoring and alerting (request latency, error rate, DB query timing).
- [ ] Add load/performance tests for key user flows before broader rollout.
- [ ] Improve fault handling and retries in the extraction pipeline.

## Repo Structure

- `client/` - frontend demo application
- `server/` - backend API and data access layer
- `docker-compose.yml` - local/containerized app orchestration
