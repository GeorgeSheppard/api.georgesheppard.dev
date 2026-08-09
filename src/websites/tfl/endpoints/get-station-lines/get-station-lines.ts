import { z } from 'zod';
import { Context } from 'hono';
import * as fs from 'fs';
import * as path from 'path';

export const LineDirectionSchema = z.object({
  lineId: z.string().describe('TfL Line ID'),
  lineName: z.string().describe('Line name (e.g., Central, Circle)'),
  direction: z.string().describe('Direction (e.g., Inbound, Outbound, Northbound)'),
});

export type LineDirection = z.infer<typeof LineDirectionSchema>;

export const StationLinesSchema = z.object({
  stationId: z.string().describe('TfL StopPoint ID'),
  stationName: z.string().describe('Station name'),
  lines: z.array(LineDirectionSchema).describe('Available lines and directions at this station'),
});

export type StationLines = z.infer<typeof StationLinesSchema>;

export const GetStationLinesResponseSchema = z.object({
  stations: z.array(StationLinesSchema),
});

export type GetStationLinesResponse = z.infer<typeof GetStationLinesResponseSchema>;

const STATION_LINES_FILE = path.join(process.cwd(), 'data', 'station-lines.json');

let cachedData: StationLines[] = [];
let isLoaded = false;

function loadStationLines(): StationLines[] {
  if (isLoaded) {
    return cachedData;
  }

  try {
    if (!fs.existsSync(STATION_LINES_FILE)) {
      console.warn(`Station lines file not found: ${STATION_LINES_FILE}`);
      isLoaded = true;
      return [];
    }

    const fileContent = fs.readFileSync(STATION_LINES_FILE, 'utf-8');
    cachedData = JSON.parse(fileContent);
    isLoaded = true;
    return cachedData;
  } catch (error) {
    console.error('Error loading station lines:', error);
    return [];
  }
}

export async function getStationLines(c: Context): Promise<GetStationLinesResponse> {
  const stations = loadStationLines();
  return { stations };
}
