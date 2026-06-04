import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Fr24Params = Record<string, string | number | boolean | undefined>;

@Injectable()
export class Fr24Service {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('FR24_API_BASE_URL') ?? 'https://fr24api.flightradar24.com/api';
    this.apiKey = this.config.get<string>('FR24_API_KEY');
  }

  configured() {
    return Boolean(this.apiKey);
  }

  async airportBoard(code: string, type: 'departures' | 'arrivals', params: Fr24Params = {}) {
    const airport = this.normalizeAirport(code);
    return this.request(`/static/airports/${airport}/${type}`, params);
  }

  async livePositions(params: Fr24Params = {}) {
    return this.request('/live/flight-positions/full', params);
  }

  async flightSummary(params: Fr24Params = {}) {
    return this.request('/flight-summary/full', params);
  }

  async flightTracks(fr24Id: string) {
    if (!fr24Id) throw new BadRequestException('fr24Id is required');
    return this.request('/flight-tracks', { flight_id: fr24Id });
  }

  async byFlightNumber(flightNumber: string) {
    const callsign = String(flightNumber || '').trim().toUpperCase();
    if (!callsign) throw new BadRequestException('flightNumber is required');
    return this.livePositions({ callsigns: callsign });
  }

  private normalizeAirport(code: string) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(normalized)) throw new BadRequestException('Invalid airport code');
    return normalized;
  }

  private async request(path: string, params: Fr24Params = {}) {
    if (!this.apiKey) throw new ServiceUnavailableException('FR24_API_KEY is not configured');
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'x-api-key': this.apiKey,
      },
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      throw new ServiceUnavailableException({ message: 'FR24 request failed', status: res.status, body });
    }
    return body;
  }
}
