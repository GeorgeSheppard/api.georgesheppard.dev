import axios, { AxiosInstance } from 'axios';

const PLANESPOTTERS_BASE_URL = 'https://api.planespotters.net/pub';

// Planespotters rejects generic library User-Agents; it asks for one naming the app and a contact.
const USER_AGENT = 'GeorgeSheppardFlights/1.0 (+https://flights.georgesheppard.dev)';

export class PlanespottersClientWrapper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: PLANESPOTTERS_BASE_URL,
      headers: { 'User-Agent': USER_AGENT },
      timeout: 5_000,
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}
