import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { AssignFr24FlightDto, Fr24ShipmentController } from './fr24.controller';

const metadata: ArgumentMetadata = { type: 'body', metatype: AssignFr24FlightDto };
const pipe = new ValidationPipe({ whitelist: true, transform: true });

describe('FR24 flight assignment request validation', () => {
  it('preserves a valid flight number through production validation and forwards it', async () => {
    const dto = await pipe.transform({ flightNumber: ' ET815 ', ignored: true }, metadata);
    const assignFlightToShipment = jest.fn().mockResolvedValue({ id: 'shipment' });
    const controller = new Fr24ShipmentController({ assignFlightToShipment } as any);
    await controller.assign('owner', 'shipment', dto);
    expect(dto).toEqual({ flightNumber: ' ET815 ' });
    expect(assignFlightToShipment).toHaveBeenCalledWith('owner', 'shipment', 'ET815');
  });
  it.each([{}, { flightNumber: '' }, { flightNumber: 815 }, { flightNumber: 'x'.repeat(17) }])('rejects invalid flight assignment %p', async body => {
    await expect(pipe.transform(body, metadata)).rejects.toThrow(BadRequestException);
  });
});
