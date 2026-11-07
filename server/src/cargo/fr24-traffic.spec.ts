import { ConfigService } from '@nestjs/config';
import { Fr24Service } from './fr24.service';

const make = (key = 'qa') => new Fr24Service(new ConfigService({ FR24_API_KEY: key }), {} as any, {} as any, {} as any);
afterEach(() => jest.restoreAllMocks());
describe('Tanzania flight tracking', () => {
  it('returns live goods positions only for the owned shipment and assigned flight instance', async () => {
    const findOne = jest.fn().mockResolvedValue({flightNumber:'ET815'});
    const service = new Fr24Service(new ConfigService({FR24_API_KEY:'qa'}), {findOne} as any, {findOne:async()=>({metadata:{fr24Id:'f1'}})} as any, {} as any);
    jest.spyOn(service,'flightByNumber').mockResolvedValue({fr24Id:'f1',flightNumber:'ET815',callsign:'ETH815',origin:'ADD',destination:'DAR',latitude:-5,longitude:39});
    expect((await service.shipmentPosition('owner','shipment')).available).toBe(true);
    expect(findOne).toHaveBeenCalledWith({where:{ownerId:'owner',id:'shipment'}});
    jest.spyOn(service,'flightByNumber').mockResolvedValue({fr24Id:'other',flightNumber:'ET815',callsign:'ETH815',origin:'ADD',destination:'DAR'});
    expect((await service.shipmentPosition('owner','shipment')).available).toBe(false);
  });
  it('does not expose another tenant shipment position', async () => {
    const service = new Fr24Service(new ConfigService({FR24_API_KEY:'qa'}), {findOne:async()=>null} as any, {} as any, {} as any);
    await expect(service.shipmentPosition('other-owner','shipment')).rejects.toThrow('Shipment not found');
  });
  it.each([['arrivals', 'inbound:TZ'], ['departures', 'outbound:TZ']] as const)('queries all country airports for %s and shares concurrent requests', async (direction, filter) => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({ok:true,json:async()=>({data:[{fr24_id:'f1',flight:'ET815',orig_iata:'ADD',dest_iata:'DAR'}]})} as Response);
    const service = make();
    const [a,b] = await Promise.all([service.tanzaniaFlights(direction),service.tanzaniaFlights(direction)]);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/live/flight-positions/full');
    expect(url.searchParams.get('airports')).toBe(filter);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b); expect(a[0].destination).toBe('DAR');
  });
  it('does not turn missing credentials into an empty sky', async () => {
    await expect(make('').tanzaniaFlights('arrivals')).rejects.toThrow('not configured');
  });
  it('retries after a failed upstream response', async () => {
    const fetcher = jest.spyOn(global,'fetch').mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ok:true,json:async()=>({data:[]})} as Response);
    const service = make();
    await expect(service.tanzaniaFlights('arrivals')).rejects.toThrow('offline');
    await expect(service.tanzaniaFlights('arrivals')).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not infer a landing from taxi or missing telemetry', () => {
    expect((make() as any).looksAirborne({altitude:3000,groundSpeed:0})).toBe(false);
    expect((make() as any).looksOnGround({})).toBe(false);
    expect((make() as any).looksOnGround({status:'taxi',altitude:0,groundSpeed:0})).toBe(false);
  });
  it('rejects a different daily flight instance before writing cargo events', async () => {
    const save = jest.fn();
    const service = new Fr24Service(new ConfigService({FR24_API_KEY:'qa'}), {} as any, {find:async()=>[{eventType:'FLIGHT_ASSIGNED',eventAt:new Date(),metadata:{fr24Id:'yesterday'}}],save} as any, {} as any);
    await expect((service as any).reconcileShipmentWithFlight({id:'s',ownerId:'o'}, {fr24Id:'today',flightNumber:'ET815',altitude:10000})).resolves.toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });
});
