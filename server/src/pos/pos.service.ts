import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { CreateOrderDto, CreateProductDto, UpdateOrderDto, UpdateProductDto } from './dto/pos.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(PosProduct) private readonly repo: Repository<PosProduct>) {}

  list(uid: string) {
    return this.repo.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }
  async get(uid: string, id: string) {
    const item = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!item) throw new NotFoundException();
    return item;
  }
  create(uid: string, dto: CreateProductDto) {
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
  }
  async update(uid: string, id: string, dto: UpdateProductDto) {
    const item = await this.get(uid, id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }
  async remove(uid: string, id: string) {
    const item = await this.get(uid, id);
    await this.repo.remove(item);
    return { id };
  }
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(PosOrder) private readonly orders: Repository<PosOrder>,
    @InjectRepository(PosOrderItem) private readonly items: Repository<PosOrderItem>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    private readonly ds: DataSource,
  ) {}

  list(uid: string) {
    return this.orders.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async get(uid: string, id: string) {
    const order = await this.orders.findOne({ where: { id, ownerId: uid } });
    if (!order) throw new NotFoundException();
    const items = await this.items.find({ where: { orderId: id, ownerId: uid } });
    return { ...order, items };
  }

  async create(uid: string, dto: CreateOrderDto) {
    if (!dto.lines.length) throw new BadRequestException('Order has no lines');
    return this.ds.transaction(async (tx) => {
      const productRepo = tx.getRepository(PosProduct);
      const orderRepo = tx.getRepository(PosOrder);
      const itemRepo = tx.getRepository(PosOrderItem);

      let subtotal = 0;
      const itemsToInsert: PosOrderItem[] = [];

      for (const line of dto.lines) {
        const product = await productRepo.findOne({ where: { id: line.productId, ownerId: uid } });
        if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
        if (product.stock < line.quantity) {
          throw new BadRequestException(`Insufficient stock for ${product.name}`);
        }
        product.stock -= line.quantity;
        await productRepo.save(product);

        const lineTotal = product.price * line.quantity;
        subtotal += lineTotal;
        itemsToInsert.push(
          itemRepo.create({
            ownerId: uid,
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity: line.quantity,
            lineTotal,
          }),
        );
      }

      const tax = dto.taxAmount ?? 0;
      const discount = dto.discountAmount ?? 0;
      const order = await orderRepo.save(
        orderRepo.create({
          ownerId: uid,
          orderNumber: dto.orderNumber,
          subtotal,
          taxAmount: tax,
          discountAmount: discount,
          total: subtotal + tax - discount,
          paymentMethod: dto.paymentMethod ?? 'CASH',
          customerName: dto.customerName ?? null,
          customerPhone: dto.customerPhone ?? null,
          status: 'COMPLETED',
        }),
      );

      for (const item of itemsToInsert) item.orderId = order.id;
      await itemRepo.save(itemsToInsert);
      return { ...order, items: itemsToInsert };
    });
  }

  async update(uid: string, id: string, dto: UpdateOrderDto) {
    const order = await this.orders.findOne({ where: { id, ownerId: uid } });
    if (!order) throw new NotFoundException();
    Object.assign(order, dto);
    return this.orders.save(order);
  }
}
