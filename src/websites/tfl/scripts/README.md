# TfL Scripts

## generate-station-lines.ts

Generates pre-computed station/line/direction data using TfL's **static route data** (not live arrivals).

### What it does:
1. Fetches all tube lines (`/Line/Mode/tube`)
2. For each line, fetches its routes (`/Line/{id}/Route?serviceTypes=Regular`)
3. Extracts all stations and directions from the route data
4. Generates `data/station-lines.json` with the pre-computed data

### Why static route data (not live arrivals)?
- ✅ **Always works** - doesn't depend on trains running
- ✅ **Reliable** - works even at night, during service suspensions, weekends
- ✅ **Canonical** - uses the official line routes, not whatever happened to arrive
- ✅ **Fast** - just route topology, no real-time queries
- ✅ **Consistent** - same data every run (no variance from traffic)

### Running:

```bash
node --loader tsx ./src/websites/tfl/scripts/generate-station-lines.ts
```

This will create `data/station-lines.json` in the project root containing all 270+ stations with their lines and directions.

### When to run:
- **Once on setup** - generates the initial data
- **Rarely needed** - TfL's routes change infrequently (new branches, service changes)
- **After major changes** - if a new line opens or existing routes change significantly

### Deployment:

The generated `data/station-lines.json` should be committed to the repository and deployed with the application. The backend reads it on startup and caches it in memory.

### Example output:
```json
{
  "stationId": "940GZZLUSSD",
  "stationName": "South Ealing",
  "lines": [
    {
      "lineId": "district",
      "lineName": "District",
      "direction": "inbound"
    },
    {
      "lineId": "district",
      "lineName": "District",
      "direction": "outbound"
    }
  ]
}
```
