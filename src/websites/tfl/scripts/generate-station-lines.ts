import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface TflStopPointMatch {
  id: string;
  name: string;
  modes: string[];
}

interface TflSearchResponse {
  matches: TflStopPointMatch[];
}

interface TflArrival {
  lineId: string;
  lineName: string;
  direction: string;
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

async function getAllTubeStations(): Promise<TflStopPointMatch[]> {
  try {
    const { data } = await axios.get<TflSearchResponse>(`${BASE_URL}/StopPoint/Search`, {
      params: {
        modes: 'tube',
        maxResults: 500,
      },
    });
    return data.matches ?? [];
  } catch (error) {
    console.error('Error fetching tube stations:', error);
    return [];
  }
}

async function getStationArrivals(stationId: string): Promise<TflArrival[]> {
  try {
    const { data } = await axios.get<TflArrival[]>(
      `${BASE_URL}/StopPoint/${encodeURIComponent(stationId)}/Arrivals`
    );
    return data ?? [];
  } catch (error) {
    console.error(`Error fetching arrivals for station ${stationId}:`, error);
    return [];
  }
}

async function generateStationLines(): Promise<void> {
  console.log('Starting station lines generation...');

  try {
    // Get all tube stations
    const stations = await getAllTubeStations();
    console.log(`Found ${stations.length} tube stations`);

    const stationLinesData: StationLineData[] = [];

    // Process each station
    for (const station of stations) {
      const arrivals = await getStationArrivals(station.id);

      if (arrivals.length === 0) {
        console.log(`No arrivals for station ${station.name} (${station.id})`);
        continue;
      }

      // Extract unique line/direction combinations
      const lineDirections = new Map<string, { lineId: string; lineName: string; direction: string }>();
      for (const arrival of arrivals) {
        const key = `${arrival.lineId}:${arrival.direction}`;
        if (!lineDirections.has(key)) {
          lineDirections.set(key, {
            lineId: arrival.lineId,
            lineName: arrival.lineName,
            direction: arrival.direction,
          });
        }
      }

      if (lineDirections.size > 0) {
        stationLinesData.push({
          stationId: station.id,
          stationName: station.name,
          lines: Array.from(lineDirections.values()).sort((a, b) =>
            `${a.lineName}:${a.direction}`.localeCompare(`${b.lineName}:${b.direction}`)
          ),
        });
        console.log(`Processed station ${station.name}: ${lineDirections.size} line/direction combos`);
      }

      // Rate limit - be nice to TfL API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

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
