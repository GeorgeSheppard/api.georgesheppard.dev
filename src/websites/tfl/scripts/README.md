# TfL Scripts

## generate-station-lines.ts

This script pre-computes which lines and directions serve each London Underground station and generates a JSON file.

### What it does:
1. Fetches all tube stations from the TfL API
2. For each station, queries the arrivals endpoint to discover available lines/directions
3. Generates `data/station-lines.json` with the pre-computed data

### Why:
Instead of computing line/direction options on-demand from live arrivals (which can fail or be slow), we pre-compute this static infrastructure data once and cache it in a JSON file. This provides:
- Instant search results (no loading state when adding stations)
- More reliable (doesn't depend on live arrivals existing)
- Less API load (one pre-computed dataset instead of fetching live data per user)

### Running:

```bash
node --loader tsx ./src/websites/tfl/scripts/generate-station-lines.ts
```

This will create `data/station-lines.json` in the project root.

### Scheduling:

This should be run periodically (weekly or monthly) to keep the data fresh if new lines/directions are added to the network. Can be added to a cron job or scheduled task in your deployment pipeline.

### Deployment:

The generated `data/station-lines.json` should be committed to the repository and deployed with the application. The backend reads it on startup and caches it in memory.
