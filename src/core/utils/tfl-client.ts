import axios, { AxiosInstance } from 'axios';
import { config } from '@config/index.js';

const TFL_BASE_URL = 'https://api.tfl.gov.uk';

export class TflClientWrapper {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: TFL_BASE_URL,
      params: { app_key: config.TFL_API_KEY },
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}
