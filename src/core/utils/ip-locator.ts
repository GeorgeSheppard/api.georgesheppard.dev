import axios from 'axios';
import { Location } from '@core/types/location.js';

interface CountryIpResponse {
  ip: string;
  country: string;
}

export abstract class IpLocator {
  abstract getLocation(ip: string | undefined): Promise<Location>;
}

export class CountryIsIpLocator implements IpLocator {
  private readonly baseUrl = 'https://api.country.is';

  async getLocation(ip: string | undefined): Promise<Location> {
    if (!ip) {
      return Location.Us;
    }

    try {
      // Handle X-Forwarded-For with multiple IPs (take first one)
      const firstIp = ip.split(',')[0].trim();

      const response = await axios.get<CountryIpResponse>(`${this.baseUrl}/${firstIp}`, {
        timeout: 5000,
      });

      const countryCode = response.data.country;

      // Map country code to Location enum
      switch (countryCode) {
        case 'US':
          return Location.Us;
        case 'AU':
          return Location.Au;
        case 'GB':
          return Location.Gb;
        case 'FR':
          return Location.Fr;
        case 'IT':
          return Location.It;
        case 'ES':
          return Location.Es;
        case 'DE':
          return Location.De;
        default:
          return Location.Us; // Default fallback
      }
    } catch (error) {
      console.error('IP location lookup failed:', error);
      return Location.Us; // Default fallback on error
    }
  }
}
