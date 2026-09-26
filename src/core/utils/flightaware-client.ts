import axios, { AxiosInstance } from 'axios';
import { config } from '@config/index.js';

const FLIGHTAWARE_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

export class FlightAwareClientWrapper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: FLIGHTAWARE_BASE_URL,
      headers: { 'x-apikey': config.FLIGHTAWARE_API_KEY },
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}
