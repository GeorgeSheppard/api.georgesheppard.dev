import axios, { AxiosInstance } from 'axios';
import { config } from '@config/index.js';

const OPENSKY_BASE_URL = 'https://opensky-network.org/api';
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// OpenSky access tokens are short-lived, so we cache one and only re-request it once it's close
// to expiring rather than on every call.
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 30_000;

interface OpenSkyTokenResponse {
  access_token: string;
  expires_in: number;
}

export class OpenSkyClientWrapper {
  private client: AxiosInstance;
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor() {
    this.client = axios.create({ baseURL: OPENSKY_BASE_URL });

    this.client.interceptors.request.use(async (requestConfig) => {
      const token = await this.getAccessToken();
      requestConfig.headers.set('Authorization', `Bearer ${token}`);
      return requestConfig;
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const { data } = await axios.post<OpenSkyTokenResponse>(
      OPENSKY_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.OPENSKY_CLIENT_ID,
        client_secret: config.OPENSKY_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MARGIN_MS;
    return this.cachedToken;
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}
