import { BadGatewayException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from './cargo.entity';
import { CargoTrackingEvent } from './air-cargo-ops.entity';

/**
 * Flightradar24 — official API integration.
 *
 * Reference: https://fr24api.flightradar24.com/docs
 *
 * The base URL and route shapes are documented at the URL above; we keep them
 * configurable via env so that endpoint moves don't require a code change:
 *   FR24_API_KEY   — bearer token (required to use this service)
 *   FR24_API_BASE  — default https://fr24api.flightradar24.com/api
 *   FR24_VERSION   — accept-version header, default v1
 *
 * When FR24_API_KEY is unset every method returns an empty result instead of
 * throwing — this lets the storefront/dashboard render an empty Flight Board
 * gracefully on instances that haven't bought the FR24 plan yet.
 */
export interface Fr24Flight {
  fr24Id?: string;
  callsign: string;
  flightNumber: string;
  airline?: string;
  aircraftType?: string;
  registration?: string;
  origin: string;
  destination: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedArrival?: string;
  status?: string;
  altitude?: number;
  groundSpeed?: number;
  latitude?: number;
  longitude?: number;
}

export type Fr24Direction = 'departures' | 'arrivals';

@Injectable()
export class Fr24Service {
  private readonly logger = new Logger(Fr24Service.name);
  private readonly apiKey: string | undefined;
  private readonly apiBase: string;
  private readonly apiVersion: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Shipment) private readonly shipments: Repository<Shipment>,
    @InjectRepository(CargoTrackingEvent) private readonly events: Repository<CargoTrackingEvent>,
  ) {
    this.apiKey = config.get<string>('FR24_API_KEY');
    this.apiBase = config.get<string>('FR24_API_BASE') ?? 'https://fr24api.flightradar24.com/api';
    this.apiVersion = config.get<string>('FR24_API_VERSION') ?? 'v1';
  }

  /** True when FR24 has been configured on this instance. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Live flights departing the given IATA/ICAO airport code.
   * Maps to FR24's flight-positions endpoint filtered by outbound airport.
   */
  async airportDepartures(code: string): Promise<Fr24Flight[]> {
    return this.airportFlights(code, 'departures');
  }

  /** Live flights arriving at the given airport code. */
  async airportArrivals(code: string): Promise<Fr24Flight[]> {
    return this.airportFlights(code, 'arrivals');
  }

  /**
   * Detail lookup for a single flight number. Returns null when not found
   * (e.g. typo, regional code, or flight outside FR24's window).
   */
  async flightByNumber(flightNumber: string): Promise<Fr24Flight | null> {
    if (!this.apiKey) return null;
    const cleaned = flightNumber.trim().toUpperCase();
    if (!cleaned) return null;

    const url = `${this.apiBase}/live/flight-positions/light?flights=${encodeURIComponent(cleaned)}`;
    const payload = await this.request<Fr24RawResponse>(url);
    const first = (payload.data ?? [])[0];
    return first ? this.normalise(first) : null;
  }

  /**
   * Attach an FR24-resolved flight to a shipment. Updates the shipment's
   * carrier/flight fields and stamps a FLIGHT_ASSIGNED tracking event so the
   * existing cargo timeline reflects the choice without any UI plumbing.
   */
  async assignFlightToShipment(ownerId: string, shipmentId: string, flightNumber: string) {
    const flight = await this.flightByNumber(flightNumber);
    if (!flight) throw new NotFoundException(`Flight ${flightNumber} not found on FR24`);

    const shipment = await this.shipments.findOne({ where: { ownerId, id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    shipment.flightNumber = flight.flightNumber;
    shipment.carrier = flight.airline ?? shipment.carrier ?? null;
    if (flight.scheduledDeparture) shipment.etd = new Date(flight.scheduledDeparture);
    if (flight.scheduledArrival ?? flight.estimatedArrival) {
      shipment.eta = new Date(flight.scheduledArrival ?? flight.estimatedArrival!);
    }
    await this.shipments.save(shipment);

    await this.events.save(
      this.events.create({
        ownerId,
        shipmentId: shipment.id,
        eventType: 'FLIGHT_ASSIGNED' as CargoTrackingEvent['eventType'],
        location: flight.origin,
        flightNumber: flight.flightNumber,
        eventAt: new Date(),
        metadata: { source: 'fr24', fr24Id: flight.fr24Id, callsign: flight.callsign },
        notes: `Assigned via FR24: ${flight.airline ?? ''} ${flight.flightNumber} ${flight.origin}→${flight.destination}`,
      } as Partial<CargoTrackingEvent>),
    );

    return { shipment, flight };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async airportFlights(code: string, direction: Fr24Direction): Promise<Fr24Flight[]> {
    if (!this.apiKey) return [];
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return [];

    const filter = direction === 'departures' ? `outbound:${cleaned}` : `inbound:${cleaned}`;
    const url = `${this.apiBase}/live/flight-positions/light?airports=${encodeURIComponent(filter)}`;
    const payload = await this.request<Fr24RawResponse>(url);
    return (payload.data ?? []).map((row) => this.normalise(row));
  }

  private async request<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Accept-Version': this.apiVersion,
        Accept: 'application/json',
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new ForbiddenException('FR24 rejected the API key');
    }
    if (res.status === 404) {
      throw new NotFoundException('FR24 resource not found');
    }
    if (res.status === 429) {
      throw new ServiceUnavailableException('FR24 rate limit reached — retry shortly');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`FR24 ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
      throw new BadGatewayException(`FR24 upstream error (${res.status})`);
    }
    return (await res.json()) as T;
  }

  private normalise(row: Fr24RawFlight): Fr24Flight {
    return {
      fr24Id: row.fr24_id ?? row.id,
      callsign: row.callsign ?? '',
      flightNumber: row.flight ?? row.flight_number ?? row.callsign ?? '',
      airline: row.operating_as ?? row.airline ?? row.operator,
      aircraftType: row.type ?? row.aircraft_type,
      registration: row.reg ?? row.registration,
      origin: row.orig_iata ?? row.origin ?? '',
      destination: row.dest_iata ?? row.destination ?? '',
      scheduledDeparture: row.orig_eta ?? row.scheduled_departure ?? row.std,
      scheduledArrival: row.dest_eta ?? row.scheduled_arrival ?? row.sta,
      estimatedArrival: row.eta ?? row.estimated_arrival,
      status: row.status,
      altitude: row.alt,
      groundSpeed: row.gspeed ?? row.ground_speed,
      latitude: row.lat,
      longitude: row.lon,
    };
  }
}

/** Raw FR24 response wrapper — fields beyond `data` are accepted but ignored. */
interface Fr24RawResponse {
  data?: Fr24RawFlight[];
}

/**
 * Field union covers both the live `light` and `full` endpoint shapes since
 * FR24 has evolved the field names across plans. We map whichever names are
 * present onto a single normalised flight in `normalise()`.
 */
interface Fr24RawFlight {
  fr24_id?: string;
  id?: string;
  callsign?: string;
  flight?: string;
  flight_number?: string;
  operating_as?: string;
  airline?: string;
  operator?: string;
  type?: string;
  aircraft_type?: string;
  reg?: string;
  registration?: string;
  orig_iata?: string;
  origin?: string;
  dest_iata?: string;
  destination?: string;
  orig_eta?: string;
  scheduled_departure?: string;
  std?: string;
  dest_eta?: string;
  scheduled_arrival?: string;
  sta?: string;
  eta?: string;
  estimated_arrival?: string;
  status?: string;
  alt?: number;
  gspeed?: number;
  ground_speed?: number;
  lat?: number;
  lon?: number;
}
