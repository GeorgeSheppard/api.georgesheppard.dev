import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@core/telemetry/logger.js';

export interface LineDirection {
  lineId: string;
  lineName: string;
  direction: string;
}

export interface StationLineData {
  stationId: string;
  stationName: string;
  lines: LineDirection[];
}

let cachedStationLines: Map<string, LineDirection[]> = new Map();

export function initializeStationLinesCache(): void {
  const stationLinesFile = path.join(process.cwd(), 'data', 'station-lines.json');

  try {
    if (!fs.existsSync(stationLinesFile)) {
      logger.warn(
        `Station lines file not found at ${stationLinesFile}. Pre-computed data will not be available. Run the generate-station-lines script to create it.`
      );
      return;
    }

    const fileContent = fs.readFileSync(stationLinesFile, 'utf-8');
    const stationLinesData: StationLineData[] = JSON.parse(fileContent);

    // Build a map for fast lookups
    for (const station of stationLinesData) {
      cachedStationLines.set(station.stationId, station.lines);
    }

    logger.info(`Loaded ${cachedStationLines.size} stations with pre-computed line data`);
  } catch (error) {
    logger.error('Error loading station lines cache:', error);
  }
}

export function getStationLines(stationId: string): LineDirection[] {
  return cachedStationLines.get(stationId) ?? [];
}

export function hasStationLineData(): boolean {
  return cachedStationLines.size > 0;
}
