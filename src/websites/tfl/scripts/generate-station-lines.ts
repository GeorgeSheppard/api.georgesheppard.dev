import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface TflLine {
  id: string;
  name: string;
}

interface TflRoute {
  originationName: string;
  destinationName: string;
  direction: string;
  originator: string;
  destination: string;
}

interface TflLineRoute {
  id: string;
  name: string;
  routeSections: TflRoute[];
}

interface StationLineData {
  stationId: string;
  stationName: string;
  lines: Array<{
    lineId: string;
    lineName: string;
    direction: string;
  }>;
}

const BASE_URL = 'https://api.tfl.gov.uk';
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'station-lines.json');

// Map of station IDs to names (discovered from routes)
const stationNames = new Map<string, string>();

// Map of station ID -> Set of (lineId:lineName:direction)
const stationLines = new Map<string, Set<string>>();

async function getAllTubeLines(): Promise<TflLine[]> {
  try {
    const { data } = await axios.get<TflLine[]>(`${BASE_URL}/Line/Mode/tube`);
    return data ?? [];
  } catch (error) {
    console.error('Error fetching tube lines:', error);
    return [];
  }
}

async function getLineRoutes(lineId: string): Promise<TflRoute[]> {
  try {
    const { data } = await axios.get<TflLineRoute>(
      `${BASE_URL}/Line/${encodeURIComponent(lineId)}/Route?serviceTypes=Regular`
    );
    return data.routeSections ?? [];
  } catch (error) {
    console.error(`Error fetching routes for line ${lineId}:`, error);
    return [];
  }
}

async function generateStationLines(): Promise<void> {
  console.log('Starting station lines generation using static route data...');

  try {
    // Get all tube lines
    const lines = await getAllTubeLines();
    console.log(`Found ${lines.length} tube lines`);

    // Process each line
    for (const line of lines) {
      const routes = await getLineRoutes(line.id);

      if (routes.length === 0) {
        console.log(`No routes for line ${line.name} (${line.id})`);
        continue;
      }

      // Extract all stations and their directions from the routes
      const lineDirections = new Set<string>();
      for (const route of routes) {
        // Store station names
        stationNames.set(route.originator, route.originationName);
        stationNames.set(route.destination, route.destinationName);

        // Add this line/direction to both stations in the route
        const key = `${line.id}:${line.name}:${route.direction}`;

        if (!stationLines.has(route.originator)) {
          stationLines.set(route.originator, new Set());
        }
        stationLines.get(route.originator)!.add(key);

        if (!stationLines.has(route.destination)) {
          stationLines.set(route.destination, new Set());
        }
        stationLines.get(route.destination)!.add(key);

        lineDirections.add(`${route.direction}`);
      }

      console.log(`Processed line ${line.name}: ${lineDirections.size} directions, ${new Set(routes.map((r) => r.originator)).size} stations`);

      // Rate limit - be nice to TfL API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Build the final data structure
    const stationLinesData: StationLineData[] = Array.from(stationLines.entries())
      .map(([stationId, lineSet]) => ({
        stationId,
        stationName: stationNames.get(stationId) || stationId,
        lines: Array.from(lineSet)
          .map((key) => {
            const [lineId, lineName, direction] = key.split(':');
            return { lineId, lineName, direction };
          })
          .sort((a, b) => `${a.lineName}:${a.direction}`.localeCompare(`${b.lineName}:${b.direction}`)),
      }))
      .sort((a, b) => a.stationName.localeCompare(b.stationName));

    // Ensure data directory exists
    if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
      fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    }

    // Write to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(stationLinesData, null, 2));

    console.log(`\nSuccessfully generated ${stationLinesData.length} station records`);
    console.log(`Data written to: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Error during generation:', error);
    process.exit(1);
  }
}

generateStationLines().then(() => {
  console.log('Done!');
  process.exit(0);
});
