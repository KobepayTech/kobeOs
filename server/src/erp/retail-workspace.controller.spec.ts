import { DataSource } from 'typeorm';
import { RetailWorkspaceController } from './retail-workspace.controller';
import { RetailMember } from './retail-member.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { DiscountApprovalService } from '../discount-approval/discount-approval.service';
import { OrdersService } from '../pos/pos.service';

describe('RetailWorkspaceController', () => {
  const owner = { id: 'shop-owner', email: 'owner@example.com', role: 'user' };
  const staff = { id: 'shop-staff', email: 'staff@example.com', role: 'user' };
  const outsider = { id: 'other-user', email: 'other@example.com', role: 'admin' };
  const shop = { id: 'shop-id', ownerId: owner.id, domainSlug: 'shop' };
  let stores: { find: jest.Mock };
  let memberships: { findOneBy: jest.Mock };
  let products: { find: jest.Mock };
  let orders: { findOneBy: jest.Mock };
  let pos: { markPreparing: jest.Mock };
  let controller: RetailWorkspaceController;

  beforeEach(() => {
    stores = { find: jest.fn().mockResolvedValue([shop]) };
    memberships = { findOneBy: jest.fn().mockImplementation(async ({ userId }) => userId === staff.id ? { role: 'staff' } : null) };
    products = { find: jest.fn().mockResolvedValue([{ sku: 'S1', stock: 5, reservedStock: 2 }]) };
    orders = { findOneBy: jest.fn().mockResolvedValue({ status: 'COMPLETED' }) };
    pos = { markPreparing: jest.fn().mockResolvedValue({ fulfillmentStatus: 'PREPARING' }) };
    const repos = new Map<unknown, unknown>([[StoreSettings, stores], [RetailMember, memberships], [PosProduct, products], [PosOrder, orders]]);
    controller = new RetailWorkspaceController({ getRepository: (target: unknown) => repos.get(target) } as DataSource, {} as DiscountApprovalService, pos as unknown as OrdersService);
  });

  it('scopes staff reads to the selected shop and omits private product costs', async () => {
    await expect(controller.stock(staff, 'shop')).resolves.toEqual([{ sku: 'S1', stock: 3 }]);
    expect(memberships.findOneBy).toHaveBeenCalledWith({ shopId: shop.id, userId: staff.id });
    expect(products.find).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: owner.id, active: true } }));
    expect(products.find.mock.calls[0][0].select).not.toContain('cost');
  });

  it('blocks a platform admin from another shop without a membership', async () => {
    await expect(controller.stock(outsider, 'shop')).rejects.toThrow('no access');
    expect(products.find).not.toHaveBeenCalled();
  });

  it('refuses ambiguous shop slugs', async () => {
    stores.find.mockResolvedValue([shop, { ...shop, id: 'other-shop' }]);
    await expect(controller.stock(owner, 'shop')).rejects.toThrow('unavailable');
    expect(products.find).not.toHaveBeenCalled();
  });

  it('blocks staff from management and validates paid order ownership for managers', async () => {
    await expect(controller.team(staff, 'shop')).rejects.toThrow('Only the shop owner');
    await expect(controller.approve(staff, 'discount', 'shop')).rejects.toThrow('Only the shop owner');
    await expect(controller.prepareOrder(staff, 'order', 'shop')).rejects.toThrow('Only shop managers');
    expect(orders.findOneBy).not.toHaveBeenCalled();
    memberships.findOneBy.mockResolvedValue({ role: 'manager' });
    await expect(controller.prepareOrder(staff, 'order', 'shop')).resolves.toEqual({ fulfillmentStatus: 'PREPARING' });
    expect(orders.findOneBy).toHaveBeenCalledWith({ id: 'order', ownerId: owner.id, status: 'COMPLETED' });
    expect(pos.markPreparing).toHaveBeenCalledWith(owner.id, 'order');
  });
});
