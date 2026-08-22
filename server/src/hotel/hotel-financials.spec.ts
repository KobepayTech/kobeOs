import { NotFoundException } from '@nestjs/common';
import { HotelChainService } from './hotel.service';

describe('HotelChainService financial ownership', () => {
  const ownerId = 'owner-1';
  const hotelId = 'hotel-1';

  function setup() {
    const tenantRepo = { findOne: jest.fn() };
    const financialRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    };
    const service = new HotelChainService(
      {} as any,
      tenantRepo as any,
      {} as any,
      {} as any,
      {} as any,
      financialRepo as any,
    );
    return { service, tenantRepo, financialRepo };
  }

  it('scopes financial reads to a hotel owned by the caller', async () => {
    const { service, tenantRepo, financialRepo } = setup();
    tenantRepo.findOne.mockResolvedValue({ id: hotelId, ownerId });

    await service.getFinancials(ownerId, hotelId, {});

    expect(tenantRepo.findOne).toHaveBeenCalledWith({ where: { id: hotelId, ownerId } });
    expect(financialRepo.find).toHaveBeenCalledWith({
      where: { ownerId, hotelId },
      order: { recordDate: 'DESC' },
    });
  });

  it('rejects financial reads for another owner’s hotel', async () => {
    const { service, tenantRepo, financialRepo } = setup();
    tenantRepo.findOne.mockResolvedValue(null);

    await expect(service.getFinancials(ownerId, hotelId, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(financialRepo.find).not.toHaveBeenCalled();
  });

  it('writes the authenticated owner onto a financial record', async () => {
    const { service, tenantRepo, financialRepo } = setup();
    tenantRepo.findOne.mockResolvedValue({ id: hotelId, ownerId });

    await service.createFinancialRecord(ownerId, {
      hotelId,
      category: 'room_revenue',
      amount: 125000,
    });

    expect(financialRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId,
      hotelId,
      category: 'room_revenue',
      amount: 125000,
    }));
    expect(financialRepo.save).toHaveBeenCalled();
  });
});
