import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import sharp from 'sharp';
import { AiService } from '../ai/ai.service';
import { PosProduct } from '../pos/pos.entity';
import { Property, PropertyUnit } from '../property/property.entity';
import { PlatformEventsService, PlatformNotificationService } from '../platform/platform.service';
import {
  BusinessLocation, CommerceBusiness, CommerceCart, CommerceCartLine, CommerceCategory,
  CommerceCustomer, CommerceOrderLine, CommerceProductMedia, CommerceShopUnit, InterestEvent,
  KobeNode, MerchantClaim, MerchantOrder, MerchantQuota, NodeHeartbeat, ProductSnippet, PropertyFloor,
} from './commerce.entity';
import { LITE_FREE_ORDER_LIMIT, extractCaptionProductMetadata, groupByMerchant, isNodeOnline, marketplaceSlug, merchantOrderAccess, missingRequiredOptions, normalizePhone, panelCrops, propertyFloorCode, propertyUnitShopCode, shopCode, vehicleEconomics } from './commerce.rules';
import { CreatorCommerceService } from '../creator-commerce/creator-commerce.service';
import { LiveAdsService } from '../live-ads/live-ads.service';
import { CommerceVehicle, VehicleBuyerRequest, VehicleListingMetadata, VehicleMedia, VehicleReservation } from './cars.entity';
import { VideoGenerationService } from '../video-generation/video-generation.service';

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const humanCode = (prefix: string) => `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
const num = (value: unknown) => Number(value) || 0;

@Injectable()
export class CommerceService implements OnModuleInit {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(CommerceBusiness) private readonly businesses: Repository<CommerceBusiness>,
    @InjectRepository(PropertyFloor) private readonly floors: Repository<PropertyFloor>,
    @InjectRepository(CommerceShopUnit) private readonly shops: Repository<CommerceShopUnit>,
    @InjectRepository(CommerceCategory) private readonly categories: Repository<CommerceCategory>,
    @InjectRepository(KobeNode) private readonly nodes: Repository<KobeNode>,
    @InjectRepository(ProductSnippet) private readonly snippets: Repository<ProductSnippet>,
    @InjectRepository(MerchantOrder) private readonly orders: Repository<MerchantOrder>,
    @InjectRepository(MerchantQuota) private readonly quotas: Repository<MerchantQuota>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    @InjectRepository(CommerceVehicle) private readonly vehicles: Repository<CommerceVehicle>,
    private readonly ai: AiService,
    private readonly videoGeneration: VideoGenerationService,
    private readonly events: PlatformEventsService,
    private readonly notifications: PlatformNotificationService,
    private readonly creatorCommerce: CreatorCommerceService,
    private readonly liveAds: LiveAdsService,
  ) {}

  async onModuleInit() {
    const properties = await this.repo(Property).find({ where: { type: In(['commercial', 'mixed']) } });
    for (const property of properties) {
      try { await this.provisionPropertyMarketplace(property.ownerId, property.id); }
      catch { /* One malformed legacy property must not block API startup. */ }
    }
  }

  private repo<T extends object>(entity: new () => T): Repository<T> { return this.ds.getRepository(entity); }

  async businessForOwner(ownerUserId: string) {
    const row = await this.businesses.findOne({ where: { ownerUserId } });
    if (!row) throw new NotFoundException('Create or link a business first');
    return row;
  }

  async createBusiness(ownerUserId: string, input: { name: string; merchantName?: string; phone?: string; email?: string; publicSlug?: string }) {
    const existing = (await this.businesses.find({ where: { ownerUserId } })).find((business) => business.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    if (existing) { await this.syncBusinessCatalog(existing); return existing; }
    const baseSlug = slugify(input.publicSlug || input.name) || `shop-${randomBytes(3).toString('hex')}`;
    let publicSlug = baseSlug;
    if (await this.businesses.findOne({ where: { publicSlug } })) publicSlug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
    const business = await this.businesses.save(this.businesses.create({
      businessId: humanCode('BUS'), publicSlug, ownerUserId, catalogOwnerId: ownerUserId,
      name: input.name.trim(), merchantName: input.merchantName?.trim() ?? '',
      phone: normalizePhone(input.phone ?? ''), email: input.email?.trim().toLowerCase() ?? '',
      tier: 'FULL', status: 'ACTIVE', websiteEnabled: true, managementTokenHash: '', profile: {},
    }));
    await this.quotas.save(this.quotas.create({ businessId: business.id, freeOrderLimit: LITE_FREE_ORDER_LIMIT, submittedOrders: 0, lockedOrders: 0, activatedAt: new Date() }));
    await this.syncBusinessCatalog(business);
    return business;
  }

  listBusinesses(ownerUserId: string) { return this.businesses.find({ where: { ownerUserId }, order: { createdAt: 'DESC' } }); }

  async publicWebHealth() {
    // Query the actual persistence used by generated property/shop web apps.
    // A successful response proves the schema is migrated and PostgreSQL is
    // reachable; it is intentionally more meaningful than process /health.
    await Promise.all([
      this.repo(Property).find({ take: 1 }),
      this.repo(PropertyUnit).find({ take: 1 }),
      this.floors.find({ take: 1 }),
      this.shops.find({ take: 1 }),
      this.businesses.find({ take: 1 }),
      this.snippets.find({ take: 1 }),
      this.repo(CommerceCart).find({ take: 1 }),
      this.orders.find({ take: 1 }),
    ]);
    return {
      status: 'ok',
      database: 'connected',
      surfaces: ['property-marketplace', 'shop-storefront', 'merchant-claim', 'multi-shop-checkout'],
    };
  }

  private async assignMarketplaceSlug(property: Property) {
    if (property.publicSlug?.trim()) return property.publicSlug;
    const reserved = new Set(['www', 'api', 'app', 'admin', 'desktop', 'staff', 'kobeos', 'docs', 'help', 'status', 'tuma', 'mzigo', 'me', 'track', 'posys', 'cargo', 'cargotz', 'property', 'estate', 'pay', 'contract', 'jumla', 'lala', 'live']);
    const raw = marketplaceSlug(property.name) || `property-${property.id.slice(0, 6)}`;
    const base = reserved.has(raw) ? `${raw}-market` : raw;
    let candidate = base;
    let suffix = 2;
    while (
      await this.repo(Property).findOne({ where: { publicSlug: candidate } }) ||
      await this.businesses.findOne({ where: { publicSlug: candidate } })
    ) candidate = `${base}-${suffix++}`;
    property.publicSlug = candidate;
    return candidate;
  }

  /**
   * Reconcile a commercial/mixed Kobe Property into permanent commerce floors
   * and Shop IDs. Existing claimed shop identities are preserved; new property
   * units become claimable immediately and the property gets a stable subdomain.
   */
  async provisionPropertyMarketplace(ownerId: string, propertyId: string) {
    const propertyRepo = this.repo(Property);
    const unitRepo = this.repo(PropertyUnit);
    const property = await propertyRepo.findOne({ where: { ownerId, id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.type === 'residential') {
      property.marketplaceEnabled = false;
      await propertyRepo.save(property);
      return { enabled: false, property, publicUrl: null, shops: [], floors: [] };
    }

    await this.assignMarketplaceSlug(property);
    property.marketplaceEnabled = property.marketplaceEnabled !== false;
    if (!property.marketplaceTagline) property.marketplaceTagline = `Shop, discover and visit businesses at ${property.name}`;
    if (!property.marketplaceBrandColor) property.marketplaceBrandColor = '#0f766e';
    property.marketplaceEnabled = true;
    await propertyRepo.save(property);

    const units = await unitRepo.find({ where: { ownerId, propertyId }, order: { floor: 'ASC', unitNumber: 'ASC' } });
    // Properties originally built through the commerce floor-builder may not
    // have PropertyUnit rows. Keep those permanent Shop IDs intact.
    if (!units.length) {
      const existingFloors = await this.floors.find({ where: { ownerId, propertyId }, order: { level: 'ASC' } });
      const existingShops = await this.shops.find({ where: { ownerId, propertyId }, order: { publicCode: 'ASC' } });
      property.totalUnits = existingShops.length || property.totalUnits;
      await propertyRepo.save(property);
      return { enabled: true, property, publicUrl: `https://${property.publicSlug}.kobeapptz.com`, floors: existingFloors, shops: existingShops };
    }

    const grouped = new Map<string, PropertyUnit[]>();
    for (const unit of units) {
      const floorName = unit.floor?.trim() || 'Ground';
      grouped.set(floorName, [...(grouped.get(floorName) ?? []), unit]);
    }

    const existingFloors = await this.floors.find({ where: { ownerId, propertyId }, order: { level: 'ASC' } });
    const usedCodes = new Set(existingFloors.map((floor) => floor.code));
    const touchedShopIds = new Set<string>();
    const savedFloors: PropertyFloor[] = [];
    const savedShops: CommerceShopUnit[] = [];
    let floorIndex = 0;

    for (const [floorName, floorUnits] of grouped.entries()) {
      let floor = existingFloors.find((row) => row.name.trim().toLowerCase() === floorName.toLowerCase());
      if (!floor) {
        const preferred = propertyFloorCode(floorName, floorIndex);
        let code = preferred;
        let codeSuffix = 2;
        while (usedCodes.has(code)) code = `${preferred.slice(0, 2)}${codeSuffix++}`.slice(0, 3);
        usedCodes.add(code);
        floor = this.floors.create({ ownerId, propertyId, name: floorName, code, level: floorIndex, shopCount: floorUnits.length });
      }
      floor.name = floorName;
      floor.level = floor.level ?? floorIndex;
      floor.shopCount = floorUnits.length;
      floor = await this.floors.save(floor);
      savedFloors.push(floor);

      for (let index = 0; index < floorUnits.length; index += 1) {
        const unit = floorUnits[index];
        let shop = await this.shops.findOne({ where: { ownerId, propertyId, floorId: floor.id, unitNumber: unit.unitNumber } });
        if (!shop) {
          const baseCode = propertyUnitShopCode(property.name, floor.code, unit.unitNumber, index + 1);
          let publicCode = baseCode;
          let collision = 2;
          while (await this.shops.findOne({ where: { publicCode } })) publicCode = `${baseCode}-${collision++}`;
          shop = this.shops.create({
            ownerId,
            propertyId,
            floorId: floor.id,
            unitNumber: unit.unitNumber,
            publicCode,
            categoryId: '',
            status: unit.status === 'maintenance' || unit.status === 'unavailable' ? 'INACTIVE' : 'AVAILABLE',
            businessId: null,
          });
        } else if (!shop.businessId) {
          shop.status = unit.status === 'maintenance' || unit.status === 'unavailable' ? 'INACTIVE' : 'AVAILABLE';
        }
        shop = await this.shops.save(shop);
        touchedShopIds.add(shop.id);
        savedShops.push(shop);
      }
      floorIndex += 1;
    }

    // Never delete a Shop ID. Units removed from Property are retired, while
    // claimed shops stay intact until their tenancy is explicitly ended.
    const allShops = await this.shops.find({ where: { ownerId, propertyId } });
    for (const stale of allShops) {
      if (!touchedShopIds.has(stale.id) && !stale.businessId && stale.status !== 'INACTIVE') {
        stale.status = 'INACTIVE';
        await this.shops.save(stale);
      }
    }

    property.totalUnits = units.length;
    await propertyRepo.save(property);
    return {
      enabled: true,
      property,
      publicUrl: `https://${property.publicSlug}.kobeapptz.com`,
      floors: savedFloors,
      shops: savedShops,
    };
  }

  async resolvePublicSlug(slug: string) {
    const normalized = marketplaceSlug(slug);
    const property = await this.repo(Property).findOne({ where: { publicSlug: normalized, marketplaceEnabled: true } });
    if (property && property.type !== 'residential') return { kind: 'property' as const, slug: normalized, id: property.id, name: property.name };
    const business = await this.businesses.findOne({ where: { publicSlug: normalized, status: 'ACTIVE' } });
    if (business) return { kind: 'business' as const, slug: normalized, id: business.id, name: business.name, tier: business.tier };
    throw new NotFoundException('Public site not found');
  }

  async publicMarketplace(slug: string, query: { q?: string; category?: string; floor?: string; shop?: string; limit?: string } = {}) {
    const normalized = marketplaceSlug(slug);
    const property = await this.repo(Property).findOne({ where: { publicSlug: normalized, marketplaceEnabled: true } });
    if (!property || property.type === 'residential') throw new NotFoundException('Property marketplace not found');

    const [floors, shops, units] = await Promise.all([
      this.floors.find({ where: { propertyId: property.id }, order: { level: 'ASC', name: 'ASC' } }),
      this.shops.find({ where: { propertyId: property.id }, order: { publicCode: 'ASC' } }),
      this.repo(PropertyUnit).find({ where: { propertyId: property.id }, order: { floor: 'ASC', unitNumber: 'ASC' } }),
    ]);
    const floorMap = new Map(floors.map((floor) => [floor.id, floor]));
    const unitMap = new Map(units.map((unit) => [`${(unit.floor || 'Ground').trim().toLowerCase()}::${unit.unitNumber.toLowerCase()}`, unit]));
    const claimed = shops.filter((shop) => shop.status === 'CLAIMED' && shop.businessId);
    const businessIds = claimed.map((shop) => shop.businessId).filter((id): id is string => Boolean(id));
    const businesses = businessIds.length ? await this.businesses.find({ where: { id: In(businessIds), status: 'ACTIVE' } }) : [];
    const businessMap = new Map(businesses.map((business) => [business.id, business]));
    const shopByBusiness = new Map(claimed.filter((shop) => businessMap.has(shop.businessId!)).map((shop) => [shop.businessId!, shop]));

    let rows: ProductSnippet[] = [];
    if (businessIds.length) {
      const qb = this.snippets.createQueryBuilder('s')
        .where('s.businessId IN (:...ids)', { ids: businessIds })
        .andWhere('s.active = true')
        .andWhere('s.stock > 0');
      if (query.q?.trim()) qb.andWhere('(LOWER(s.name) LIKE :q OR LOWER(s.description) LIKE :q)', { q: `%${query.q.toLowerCase().trim()}%` });
      if (query.category?.trim()) qb.andWhere('LOWER(s.category) = :category', { category: query.category.toLowerCase().trim() });
      rows = await qb.orderBy('s.indexedAt', 'DESC').take(Math.min(200, Math.max(1, Number(query.limit) || 80))).getMany();
      if (query.shop?.trim()) {
        const selected = shops.find((shop) => shop.publicCode.toLowerCase() === query.shop!.toLowerCase());
        rows = selected?.businessId ? rows.filter((row) => row.businessId === selected.businessId) : [];
      }
      if (query.floor?.trim()) {
        const floor = floors.find((row) => row.code.toLowerCase() === query.floor!.toLowerCase() || row.name.toLowerCase() === query.floor!.toLowerCase());
        const floorBusinessIds = new Set(claimed.filter((shop) => shop.floorId === floor?.id && shop.businessId).map((shop) => shop.businessId!));
        rows = rows.filter((row) => floorBusinessIds.has(row.businessId));
      }
    }

    const products = rows.length ? await this.products.find({ where: { id: In(rows.map((row) => row.productId)) } }) : [];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const publicShops = shops.map((shop) => {
      const floor = floorMap.get(shop.floorId);
      const unit = unitMap.get(`${(floor?.name || 'Ground').trim().toLowerCase()}::${shop.unitNumber.toLowerCase()}`);
      const business = shop.businessId ? businessMap.get(shop.businessId) : undefined;
      return {
        id: shop.id,
        publicCode: shop.publicCode,
        unitNumber: shop.unitNumber,
        status: shop.status,
        categoryId: shop.categoryId,
        floor: floor ? { id: floor.id, name: floor.name, code: floor.code, level: floor.level } : null,
        business: business ? {
          id: business.id,
          businessId: business.businessId,
          name: business.name,
          publicSlug: business.publicSlug,
          phone: business.phone,
          tier: business.tier,
          logoUrl: String(business.profile?.logoUrl ?? ''),
          whatsapp: String(business.profile?.whatsapp ?? business.phone ?? ''),
        } : null,
        vacancy: !business && unit ? {
          type: unit.type,
          rentAmount: Number(unit.rentAmount),
          currency: unit.currency,
          sqft: unit.sqft,
          status: unit.status,
        } : null,
      };
    });
    const publicProducts = rows.map((row) => {
      const product = productMap.get(row.productId);
      const business = businessMap.get(row.businessId);
      const shop = shopByBusiness.get(row.businessId);
      const floor = shop ? floorMap.get(shop.floorId) : undefined;
      return {
        ...row,
        imageUrls: product?.imageUrls ?? (row.imageUrl ? [row.imageUrl] : []),
        variants: product?.variants ?? [],
        requiredOptions: Array.isArray(product?.customData?.requiredOptions) ? product.customData.requiredOptions : [],
        business: business ? { id: business.id, name: business.name, publicSlug: business.publicSlug, phone: business.phone, tier: business.tier } : null,
        shop: shop ? { publicCode: shop.publicCode, unitNumber: shop.unitNumber, floor: floor?.name ?? '', floorCode: floor?.code ?? '' } : null,
      };
    });
    const categories = [...new Set(publicProducts.map((product) => product.category).filter(Boolean))].sort();
    return {
      site: {
        id: property.id,
        name: property.name,
        slug: property.publicSlug,
        publicUrl: `https://${property.publicSlug}.kobeapptz.com`,
        address: property.address,
        city: property.city,
        imageUrl: property.imageUrl,
        tagline: property.marketplaceTagline || `Everything at ${property.name}, in one place.`,
        brandColor: property.marketplaceBrandColor || '#0f766e',
      },
      stats: {
        totalShops: shops.filter((shop) => shop.status !== 'INACTIVE').length,
        openBusinesses: publicShops.filter((shop) => shop.business).length,
        availableSpaces: publicShops.filter((shop) => shop.status === 'AVAILABLE').length,
        products: publicProducts.length,
      },
      floors: floors.map((floor) => ({ id: floor.id, name: floor.name, code: floor.code, level: floor.level, shopCount: publicShops.filter((shop) => shop.floor?.id === floor.id && shop.status !== 'INACTIVE').length })),
      categories,
      shops: publicShops,
      products: publicProducts,
    };
  }

  async buildProperty(ownerId: string, propertyId: string, input: { floors: Array<{ name: string; code: string; level?: number; shopCount: number }> }) {
    const property = await this.repo(Property).findOne({ where: { ownerId, id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.type === 'residential') property.type = 'commercial';
    const created: CommerceShopUnit[] = [];
    await this.ds.transaction(async (tx) => {
      await tx.getRepository(Property).save(property);
      for (const f of input.floors) {
        if (!f.name?.trim() || !f.code?.trim() || !Number.isInteger(f.shopCount) || f.shopCount < 1 || f.shopCount > 500) throw new BadRequestException('Each floor needs a name, code and 1-500 shops');
        let floor = await tx.getRepository(PropertyFloor).findOne({ where: { ownerId, propertyId, code: f.code.toUpperCase() } });
        floor ??= tx.getRepository(PropertyFloor).create({ ownerId, propertyId, name: f.name.trim(), code: f.code.toUpperCase(), level: f.level ?? 0, shopCount: f.shopCount });
        floor.shopCount = f.shopCount;
        floor = await tx.getRepository(PropertyFloor).save(floor);
        for (let i = 1; i <= f.shopCount; i += 1) {
          const unitNumber = String(i).padStart(2, '0');
          const exists = await tx.getRepository(CommerceShopUnit).findOne({ where: { ownerId, propertyId, floorId: floor.id, unitNumber } });
          if (exists) { created.push(exists); continue; }
          created.push(await tx.getRepository(CommerceShopUnit).save(tx.getRepository(CommerceShopUnit).create({
            ownerId, propertyId, floorId: floor.id, unitNumber, publicCode: shopCode(property.name, floor.code, i), categoryId: '', status: 'AVAILABLE', businessId: null,
          })));
        }
      }
      property.totalUnits = await tx.getRepository(CommerceShopUnit).count({ where: { ownerId, propertyId } });
      await tx.getRepository(Property).save(property);
    });
    const marketplace = await this.provisionPropertyMarketplace(ownerId, propertyId);
    return { property: marketplace.property, shops: created, totalShops: marketplace.property.totalUnits, marketplace };
  }

  async propertyMap(ownerId: string, propertyId: string) {
    const property = await this.repo(Property).findOne({ where: { ownerId, id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    const floors = await this.floors.find({ where: { ownerId, propertyId }, order: { level: 'ASC' } });
    const shops = await this.shops.find({ where: { ownerId, propertyId }, order: { publicCode: 'ASC' } });
    const businessIds = shops.map((s) => s.businessId).filter((x): x is string => Boolean(x));
    const businesses = businessIds.length ? await this.businesses.find({ where: { id: In(businessIds) } }) : [];
    return { property, floors, shops, businesses: businesses.map(({ managementTokenHash: _secret, ...b }) => b) };
  }

  async publicProperty(publicCode: string) {
    const shop = await this.shops.findOne({ where: { publicCode: publicCode.toUpperCase() } });
    if (!shop) throw new NotFoundException('Shop ID not found');
    const [property, floor] = await Promise.all([
      this.repo(Property).findOne({ where: { id: shop.propertyId } }), this.floors.findOne({ where: { id: shop.floorId } }),
    ]);
    return { property: property && { id: property.id, name: property.name, address: property.address, city: property.city }, floor, shop };
  }

  async claimShop(input: { shopCode: string; businessName: string; merchantName: string; phone: string; categoryId?: string; whatsapp?: string; logoUrl?: string; subcategories?: string[] }) {
    const code = input.shopCode.trim().toUpperCase();
    const shop = await this.shops.findOne({ where: { publicCode: code } });
    if (!shop) throw new NotFoundException('Shop ID not found');
    if (shop.status === 'CLAIMED') throw new ConflictException('This shop is already claimed');
    const token = randomBytes(24).toString('base64url');
    let publicSlug = slugify(input.businessName) || `shop-${randomBytes(3).toString('hex')}`;
    if (await this.businesses.findOne({ where: { publicSlug } })) publicSlug = `${publicSlug}-${randomBytes(2).toString('hex')}`;
    const result = await this.ds.transaction(async (tx) => {
      const businessRepo = tx.getRepository(CommerceBusiness);
      const businessDraft = businessRepo.create({
        businessId: humanCode('BUS'), publicSlug, ownerUserId: null, catalogOwnerId: randomUUID(),
        name: input.businessName.trim(), merchantName: input.merchantName.trim(), phone: normalizePhone(input.phone),
        email: '', tier: 'LITE', status: 'ACTIVE', websiteEnabled: false, managementTokenHash: hash(token),
        profile: { whatsapp: normalizePhone(input.whatsapp || input.phone), logoUrl: input.logoUrl?.trim() ?? '', subcategories: input.subcategories ?? [] },
      });
      // A Lite catalogue owner is the business row itself. Assign after the id exists.
      let business = await businessRepo.save(businessDraft);
      business.catalogOwnerId = business.id;
      business = await businessRepo.save(business);
      shop.status = 'CLAIMED'; shop.businessId = business.id; shop.categoryId = input.categoryId ?? '';
      await tx.getRepository(CommerceShopUnit).save(shop);
      const claim = await tx.getRepository(MerchantClaim).save(tx.getRepository(MerchantClaim).create({
        propertyId: shop.propertyId, shopUnitId: shop.id, businessId: business.id,
        claimantName: input.merchantName.trim(), claimantPhone: normalizePhone(input.phone), categoryId: input.categoryId ?? '', status: 'APPROVED', decidedAt: new Date(),
      }));
      await tx.getRepository(BusinessLocation).save(tx.getRepository(BusinessLocation).create({
        businessId: business.id, propertyId: shop.propertyId, shopUnitId: shop.id, name: code, address: '', latitude: '', longitude: '', active: true,
      }));
      await tx.getRepository(MerchantQuota).save(tx.getRepository(MerchantQuota).create({ businessId: business.id, freeOrderLimit: LITE_FREE_ORDER_LIMIT, submittedOrders: 0, lockedOrders: 0 }));
      return { business, claim };
    });
    await this.events.emit({ eventName: 'shop.claimed', aggregateType: 'CommerceShopUnit', aggregateId: shop.id, payload: { businessId: result.business.id, propertyId: shop.propertyId, shopCode: code } });
    return { ...result, managementToken: token, shopCode: code, freeOrders: LITE_FREE_ORDER_LIMIT };
  }

  async linkExistingBusiness(ownerUserId: string, businessId: string, input: { shopCode: string; categoryId?: string }) {
    const business = await this.businesses.findOne({ where: { id: businessId, ownerUserId } });
    if (!business) throw new NotFoundException('Business not found');
    const publicCode = input.shopCode?.trim().toUpperCase();
    const shop = await this.shops.findOne({ where: { publicCode } });
    if (!shop) throw new NotFoundException('Shop ID not found');
    if (shop.status === 'CLAIMED' && shop.businessId !== business.id) throw new ConflictException('This shop is already claimed');
    const result = await this.ds.transaction(async (tx) => {
      shop.status = 'CLAIMED'; shop.businessId = business.id; shop.categoryId = input.categoryId?.trim() ?? shop.categoryId;
      await tx.getRepository(CommerceShopUnit).save(shop);
      let location = await tx.getRepository(BusinessLocation).findOne({ where: { businessId: business.id, shopUnitId: shop.id } });
      location ??= tx.getRepository(BusinessLocation).create({ businessId: business.id, propertyId: shop.propertyId, shopUnitId: shop.id, name: publicCode, address: '', latitude: '', longitude: '', active: true });
      location = await tx.getRepository(BusinessLocation).save(location);
      let claim = await tx.getRepository(MerchantClaim).findOne({ where: { shopUnitId: shop.id, businessId: business.id } });
      claim ??= tx.getRepository(MerchantClaim).create({ propertyId: shop.propertyId, shopUnitId: shop.id, businessId: business.id, claimantName: business.merchantName || business.name, claimantPhone: business.phone, categoryId: shop.categoryId, status: 'APPROVED', decidedAt: new Date() });
      claim = await tx.getRepository(MerchantClaim).save(claim);
      return { business, shop, location, claim };
    });
    await this.events.emit({ ownerId: ownerUserId, eventName: 'shop.claimed', aggregateType: 'CommerceShopUnit', aggregateId: shop.id, payload: { businessId: business.id, propertyId: shop.propertyId, shopCode: publicCode, linkedExistingBusiness: true } });
    return result;
  }

  async upgradeBusiness(ownerUserId: string, businessId: string, token?: string) {
    const business = await this.businesses.findOne({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');
    if (business.ownerUserId && business.ownerUserId !== ownerUserId) throw new ConflictException('Business is linked to another account');
    if (!business.ownerUserId && business.managementTokenHash && hash(token ?? '') !== business.managementTokenHash) throw new BadRequestException('Valid Lite management token required');
    const oldOwner = business.catalogOwnerId;
    await this.ds.transaction(async (tx) => {
      business.ownerUserId = ownerUserId; business.catalogOwnerId = ownerUserId; business.tier = 'FULL'; business.websiteEnabled = true; business.managementTokenHash = '';
      await tx.getRepository(CommerceBusiness).save(business);
      await tx.getRepository(PosProduct).update({ ownerId: oldOwner }, { ownerId: ownerUserId });
      await tx.getRepository(ProductSnippet).update({ businessId: business.id }, { catalogOwnerId: ownerUserId });
      await tx.getRepository(MerchantOrder).update({ businessId: business.id, merchantLocked: true }, { merchantLocked: false, status: 'SUBMITTED' });
      const quota = await tx.getRepository(MerchantQuota).findOne({ where: { businessId: business.id } });
      if (quota) { quota.lockedOrders = 0; quota.activatedAt = new Date(); await tx.getRepository(MerchantQuota).save(quota); }
    });
    await this.events.emit({ ownerId: ownerUserId, eventName: 'merchant.upgraded', aggregateType: 'CommerceBusiness', aggregateId: business.id, payload: { businessId: business.businessId } });
    return business;
  }

  async seedCategories() {
    const defaults = ['Fashion', 'Electronics', 'Home', 'Beauty', 'Food', 'Hardware', 'Cars', 'Properties', 'Hotel', 'Services'];
    for (let i = 0; i < defaults.length; i += 1) {
      const slug = slugify(defaults[i]);
      if (!await this.categories.findOne({ where: { slug } })) await this.categories.save(this.categories.create({ name: defaults[i], slug, icon: '', active: true, sortOrder: i }));
    }
    return this.categories.find({ where: { active: true }, order: { sortOrder: 'ASC' } });
  }

  listCategories() { return this.categories.find({ where: { active: true }, order: { sortOrder: 'ASC' } }); }

  async quickAdd(ownerUserId: string, input: { name?: string; caption?: string; imageUrl: string; panelCount?: number; category?: string; price?: number; stock?: number }) {
    const business = await this.businessForOwner(ownerUserId);
    return this.quickAddForBusiness(business, input, ownerUserId);
  }

  private async quickAddForBusiness(business: CommerceBusiness, input: { name?: string; caption?: string; imageUrl: string; panelCount?: number; category?: string; price?: number; stock?: number }, actorOwnerId?: string) {
    const crops = panelCrops(input.panelCount ?? 1);
    const extracted = extractCaptionProductMetadata(input.caption);
    const sizeValues = extracted.sizes.length ? extracted.sizes : ['']; const colorValues = extracted.colors.length ? extracted.colors : [''];
    const variants = sizeValues.flatMap((size) => colorValues.map((color) => ({ id: randomUUID(), name: [size && `Size ${size}`, color].filter(Boolean).join(' · ') || 'Default', stock: Math.max(0, Math.floor(num(input.stock))), attributes: { ...(size ? { size } : {}), ...(color ? { color } : {}) } })));
    const requiredOptions = [...(extracted.sizes.length ? ['size'] : []), ...(extracted.colors.length ? ['color'] : [])];
    const created: PosProduct[] = [];
    await this.ds.transaction(async (tx) => {
      for (let i = 0; i < crops.length; i += 1) {
        const panel = crops[i];
        const name = (input.name || extracted.title || 'New product').trim() + (crops.length > 1 ? ` ${i + 1}` : '');
        const product = await tx.getRepository(PosProduct).save(tx.getRepository(PosProduct).create({
          ownerId: business.catalogOwnerId, sku: humanCode('QA'), name, sourceType: 'QUICK_ADD_PHOTO',
          description: input.caption?.trim() ?? '', category: input.category?.trim() || extracted.category || 'Uncategorised',
          price: num(input.price) || extracted.price, currency: 'TZS', unit: 'piece', decimalQuantity: false, taxRate: 0,
          stock: Math.max(0, Math.floor(num(input.stock))), reservedStock: 0, estimatedStock: 0,
          imageUrl: input.imageUrl, imageUrls: [input.imageUrl], variants, tags: extracted.styles,
          customData: { collagePanel: i + 1, collagePanelCount: crops.length, crop: panel, aiExtractionStatus: 'READY_FOR_REVIEW', extracted, requiredOptions },
          jerseyDetails: {}, active: true, featured: false, publishedAt: new Date(), unitsSold: 0,
        }));
        created.push(product);
        await tx.getRepository(CommerceProductMedia).save(tx.getRepository(CommerceProductMedia).create({ productId: product.id, url: input.imageUrl, kind: 'IMAGE', sortOrder: 0, crop: panel }));
        await tx.getRepository(ProductSnippet).save(tx.getRepository(ProductSnippet).create({ businessId: business.id, productId: product.id, catalogOwnerId: business.catalogOwnerId, name: product.name, description: product.description, category: product.category, price: product.price, currency: product.currency, imageUrl: input.imageUrl, stock: product.stock, active: true, indexedAt: new Date() }));
      }
    });
    await Promise.all(created.map((p) => this.events.emit({ ownerId: actorOwnerId, eventName: 'product.created', aggregateType: 'PosProduct', aggregateId: p.id, payload: { businessId: business.id, source: p.sourceType } })));
    return { products: created, productTiles: created.length, requiresReview: true };
  }

  async quickAddUpload(ownerUserId: string, input: { name?: string; caption?: string; panelCount?: number; category?: string; price?: number; stock?: number }, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    const business = await this.businessForOwner(ownerUserId);
    return this.quickAddUploadForBusiness(business, ownerUserId, input, file);
  }

  private async quickAddUploadForBusiness(business: CommerceBusiness, actorOwnerId: string | undefined, input: { name?: string; caption?: string; panelCount?: number; category?: string; price?: number; stock?: number }, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    if (!file?.buffer?.length || !file.mimetype.startsWith('image/')) throw new BadRequestException('Upload one image');
    const metadata = await sharp(file.buffer).metadata();
    const width = metadata.width ?? 0; const height = metadata.height ?? 0;
    if (!width || !height) throw new BadRequestException('Could not read image dimensions');
    let vision: { name?: string; category?: string; description?: string; tags?: string[]; colours?: string[]; sizes?: string[] } = {};
    try { vision = await this.ai.describeProductImage(file.buffer.toString('base64')); } catch { /* Offline caption extraction remains available. */ }
    const effective = { ...input, name: input.name?.trim() || vision.name || '', category: input.category?.trim() || vision.category || '', caption: input.caption?.trim() || vision.description || '' };
    const crops = panelCrops(input.panelCount ?? 1); const products: PosProduct[] = [];
    for (let i = 0; i < crops.length; i += 1) {
      const crop = crops[i]; const left = Math.min(width - 1, Math.max(0, Math.floor(crop.left * width))); const top = Math.min(height - 1, Math.max(0, Math.floor(crop.top * height)));
      const cropWidth = Math.max(1, Math.min(width - left, Math.round(crop.width * width))); const cropHeight = Math.max(1, Math.min(height - top, Math.round(crop.height * height)));
      const binary = await sharp(file.buffer).extract({ left, top, width: cropWidth, height: cropHeight }).rotate().webp({ quality: 88 }).toBuffer();
      const token = randomBytes(24).toString('base64url'); const imageUrl = `/api/commerce-public/media/${token}`;
      const fallbackName = file.originalname.replace(/\.[^.]+$/, '');
      const result = await this.quickAddForBusiness(business, { ...effective, name: (effective.name || fallbackName) + (crops.length > 1 ? ` ${i + 1}` : ''), imageUrl, panelCount: 1 }, actorOwnerId);
      const product = result.products[0]; products.push(product);
      const media = await this.repo(CommerceProductMedia).findOne({ where: { productId: product.id } });
      if (media) { media.publicToken = token; media.mimeType = 'image/webp'; media.contentBinary = binary; media.crop = crop; media.url = imageUrl; await this.repo(CommerceProductMedia).save(media); }
      if (crops.length > 1) {
        const originalToken = randomBytes(24).toString('base64url'); const originalUrl = `/api/commerce-public/media/${originalToken}`;
        await this.repo(CommerceProductMedia).save(this.repo(CommerceProductMedia).create({ productId: product.id, url: originalUrl, kind: 'IMAGE', sortOrder: 1, crop: { isOriginal: 1 }, publicToken: originalToken, mimeType: file.mimetype, contentBinary: file.buffer }));
        product.imageUrls = [imageUrl, originalUrl];
      }
      const extracted = product.customData?.extracted as Record<string, unknown> | undefined;
      product.customData = { ...product.customData, collagePanel: i + 1, collagePanelCount: crops.length, crop, sourceFilename: file.originalname, visionSuggestions: vision, extracted: { ...(extracted ?? {}), vision } };
      await this.products.save(product);
    }
    return { products, productTiles: products.length, requiresReview: true };
  }

  async quickAddMultipleUpload(ownerUserId: string, input: { name?: string; caption?: string; category?: string; price?: number; stock?: number; interpretation?: 'ONE_PRODUCT' | 'MULTIPLE_PRODUCTS' }, files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>) {
    if (!files?.length || files.some((file) => !file.mimetype.startsWith('image/'))) throw new BadRequestException('Upload one or more images');
    if (input.interpretation !== 'ONE_PRODUCT') {
      const results: Array<{ products: PosProduct[]; productTiles: number; requiresReview: boolean }> = [];
      for (const file of files) results.push(await this.quickAddUpload(ownerUserId, { ...input, name: input.name || file.originalname.replace(/\.[^.]+$/, ''), panelCount: 1 }, file));
      return { interpretation: 'MULTIPLE_PRODUCTS', products: results.flatMap((result) => result.products), productTiles: results.reduce((sum, result) => sum + result.productTiles, 0), requiresReview: true };
    }
    const first = await this.quickAddUpload(ownerUserId, { ...input, panelCount: 1 }, files[0]);
    const product = first.products[0];
    for (let i = 1; i < files.length; i += 1) {
      const file = files[i]; const token = randomBytes(24).toString('base64url'); const url = `/api/commerce-public/media/${token}`;
      const binary = await sharp(file.buffer).rotate().webp({ quality: 88 }).toBuffer();
      await this.repo(CommerceProductMedia).save(this.repo(CommerceProductMedia).create({ productId: product.id, url, kind: 'IMAGE', sortOrder: i, crop: {}, publicToken: token, mimeType: 'image/webp', contentBinary: binary }));
      product.imageUrls = [...product.imageUrls, url];
    }
    await this.products.save(product); await this.syncCatalog(ownerUserId);
    return { interpretation: 'ONE_PRODUCT', products: [product], productTiles: 1, imageCount: files.length, requiresReview: true };
  }

  async publicMedia(token: string) {
    const media = await this.repo(CommerceProductMedia).findOne({ where: { publicToken: token } });
    if (media?.contentBinary) return media;
    // Same public media route also serves inline-stored vehicle photos.
    const vehicleMedia = await this.repo(VehicleMedia).findOne({ where: { publicToken: token } });
    if (vehicleMedia?.contentBinary) return vehicleMedia;
    throw new NotFoundException('Image not found');
  }

  /** Attach uploaded photos to a vehicle the dealer owns (webp, inline-served). */
  async addVehicleMedia(ownerUserId: string, vehicleId: string, files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>) {
    const business = await this.businessForOwner(ownerUserId);
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, businessId: business.id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!files?.length || files.some((file) => !file.mimetype?.startsWith('image/'))) throw new BadRequestException('Upload one or more images');
    const existing = await this.repo(VehicleMedia).count({ where: { vehicleId } });
    let sortOrder = existing;
    for (const file of files) {
      const binary = await sharp(file.buffer).rotate().webp({ quality: 88 }).toBuffer();
      const token = randomBytes(24).toString('base64url');
      await this.repo(VehicleMedia).save(this.repo(VehicleMedia).create({ vehicleId, url: `/api/commerce-public/media/${token}`, kind: 'IMAGE', sortOrder: sortOrder++, publicToken: token, mimeType: 'image/webp', contentBinary: binary }));
    }
    return this.repo(VehicleMedia).find({ where: { vehicleId }, order: { sortOrder: 'ASC' } });
  }

  private async authenticateLite(businessId: string, token: string) {
    const business = await this.businesses.findOne({ where: { id: businessId, tier: 'LITE', status: 'ACTIVE' } });
    if (!business || !business.managementTokenHash || hash(token || '') !== business.managementTokenHash) throw new BadRequestException('Invalid Kobe Lite management key');
    return business;
  }

  async liteDashboard(businessId: string, token: string) {
    const business = await this.authenticateLite(businessId, token);
    const [products, orders, quota, locations] = await Promise.all([
      this.products.find({ where: { ownerId: business.catalogOwnerId }, order: { createdAt: 'DESC' } }),
      this.orders.find({ where: { businessId }, order: { createdAt: 'DESC' }, take: 100 }),
      this.quotas.findOne({ where: { businessId } }), this.repo(BusinessLocation).find({ where: { businessId, active: true } }),
    ]);
    const visibleOrders: Array<Record<string, unknown>> = [];
    for (const order of orders) {
      if (order.merchantLocked) { visibleOrders.push({ id: order.id, orderNumber: order.orderNumber, status: order.status, merchantLocked: true, createdAt: order.createdAt }); continue; }
      visibleOrders.push({ ...order, customer: await this.repo(CommerceCustomer).findOne({ where: { id: order.customerId } }), lines: await this.repo(CommerceOrderLine).find({ where: { merchantOrderId: order.id } }) });
    }
    return { business: { ...business, managementTokenHash: undefined }, products, orders: visibleOrders, quota, locations };
  }

  async liteQuickAdd(businessId: string, token: string, input: { name?: string; caption?: string; imageUrl: string; panelCount?: number; category?: string; price?: number; stock?: number }) {
    const business = await this.authenticateLite(businessId, token);
    return this.quickAddForBusiness(business, input);
  }

  async liteQuickAddUpload(businessId: string, token: string, input: { name?: string; caption?: string; panelCount?: number; category?: string; price?: number; stock?: number }, file: { buffer: Buffer; mimetype: string; originalname: string }) {
    const business = await this.authenticateLite(businessId, token);
    return this.quickAddUploadForBusiness(business, business.ownerUserId ?? undefined, input, file);
  }

  async liteUpdateProduct(businessId: string, token: string, productId: string, input: { name?: string; description?: string; category?: string; price?: number; stock?: number; active?: boolean; imageUrl?: string }) {
    const business = await this.authenticateLite(businessId, token);
    const product = await this.products.findOne({ where: { id: productId, ownerId: business.catalogOwnerId } });
    if (!product) throw new NotFoundException('Product not found');
    if (input.name !== undefined) product.name = input.name.trim(); if (input.description !== undefined) product.description = input.description.trim();
    if (input.category !== undefined) product.category = input.category.trim(); if (input.price !== undefined) product.price = Math.max(0, num(input.price));
    if (input.stock !== undefined) product.stock = Math.max(0, Math.floor(num(input.stock))); if (input.active !== undefined) product.active = Boolean(input.active);
    if (input.imageUrl !== undefined) { product.imageUrl = input.imageUrl; product.imageUrls = input.imageUrl ? [input.imageUrl] : []; }
    await this.products.save(product); await this.syncBusinessCatalog(business);
    return product;
  }

  async publicLiteStore(publicSlug: string) {
    const business = await this.businesses.findOne({ where: { publicSlug, tier: 'LITE', status: 'ACTIVE' } });
    if (!business) throw new NotFoundException('Lite store not found');
    const snippets = await this.snippets.find({ where: { businessId: business.id, active: true }, order: { indexedAt: 'DESC' } });
    return { business: { id: business.id, businessId: business.businessId, name: business.name, merchantName: business.merchantName, phone: business.phone, publicSlug: business.publicSlug, profile: business.profile }, products: snippets };
  }

  /** Keep Jumla's lightweight discovery index aligned with the canonical POS catalogue. */
  private async syncBusinessCatalog(business: CommerceBusiness) {
    const [products, indexed, node, businessLocation] = await Promise.all([
      this.products.find({ where: { ownerId: business.catalogOwnerId } }),
      this.snippets.find({ where: { businessId: business.id } }),
      this.nodes.findOne({ where: { businessId: business.id } }),
      this.repo(BusinessLocation).findOne({ where: { businessId: business.id, active: true } }),
    ]);
    const byProduct = new Map(indexed.map((row) => [row.productId, row]));
    const liveIds = new Set(products.map((product) => product.id));
    let changed = 0;
    for (const product of products) {
      let row = byProduct.get(product.id);
      const isNew = !row;
      const wasAvailable = Boolean(row?.active && Number(row?.stock) > 0);
      row ??= this.snippets.create({ businessId: business.id, productId: product.id, catalogOwnerId: business.catalogOwnerId });
      const next = {
        catalogOwnerId: business.catalogOwnerId,
        name: product.name,
        description: product.description ?? '',
        category: product.category ?? '',
        price: product.price,
        currency: product.currency || 'TZS',
        imageUrl: product.imageUrl || product.imageUrls?.[0] || '',
        stock: Math.max(0, Math.floor(num(product.stock))),
        active: Boolean(product.active),
        nodeId: node?.id ?? null,
        merchantWebsite: `/shop/${business.publicSlug}`,
        locationLabel: businessLocation?.name ?? '',
        lastOnlineAt: business.tier === 'LITE' ? new Date() : node?.lastSeenAt ?? null,
        availabilityHint: Number(product.stock) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      };
      const dirty = !row.id || row.name !== next.name || row.description !== next.description || row.category !== next.category || num(row.price) !== num(next.price) || row.currency !== next.currency || row.imageUrl !== next.imageUrl || row.stock !== next.stock || row.active !== next.active || row.catalogOwnerId !== next.catalogOwnerId || row.nodeId !== next.nodeId || row.merchantWebsite !== next.merchantWebsite || row.locationLabel !== next.locationLabel || row.availabilityHint !== next.availabilityHint;
      if (!dirty) continue;
      Object.assign(row, next, { indexedAt: new Date() });
      await this.snippets.save(row);
      changed += 1;
      await this.events.emit({ ownerId: business.ownerUserId ?? undefined, eventName: isNew ? 'product.created' : 'product.updated', aggregateType: 'PosProduct', aggregateId: product.id, payload: { businessId: business.id, source: 'catalog_sync' } });
      const isAvailable = Boolean(row.active && Number(row.stock) > 0);
      if (isNew || wasAvailable !== isAvailable) {
        await this.events.emit({ ownerId: business.ownerUserId ?? undefined, eventName: isAvailable ? 'product.available' : 'product.unavailable', aggregateType: 'PosProduct', aggregateId: product.id, payload: { businessId: business.id, stock: row.stock, source: 'catalog_sync' } });
      }
    }
    for (const orphan of indexed.filter((row) => !liveIds.has(row.productId) && row.active)) {
      orphan.active = false; orphan.stock = 0; orphan.indexedAt = new Date();
      await this.snippets.save(orphan); changed += 1;
      await this.events.emit({ ownerId: business.ownerUserId ?? undefined, eventName: 'product.deleted', aggregateType: 'PosProduct', aggregateId: orphan.productId, payload: { businessId: business.id, source: 'catalog_sync' } });
    }
    return { businessId: business.id, products: products.length, changed };
  }

  async syncCatalog(ownerUserId: string) {
    const business = await this.businessForOwner(ownerUserId);
    return this.syncBusinessCatalog(business);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllCatalogs() {
    const businesses = await this.businesses.find({ where: { status: 'ACTIVE' } });
    let changed = 0;
    for (const business of businesses) changed += (await this.syncBusinessCatalog(business)).changed;
    return { businesses: businesses.length, changed };
  }

  async registerNode(ownerUserId: string, input: { nodeName?: string; version?: string; endpoint?: string; catalogueVersion?: string }) {
    const business = await this.businessForOwner(ownerUserId);
    await this.syncBusinessCatalog(business);
    const key = randomBytes(32).toString('base64url');
    let node = await this.nodes.findOne({ where: { businessId: business.id } });
    node ??= this.nodes.create({ businessId: business.id, nodeName: input.nodeName || `${business.name} KobeOS`, nodeKeyHash: hash(key), status: 'ONLINE', lastSeenAt: new Date(), version: input.version ?? '', endpoint: input.endpoint ?? '', catalogueVersion: input.catalogueVersion ?? '' });
    node.nodeKeyHash = hash(key); node.status = 'ONLINE'; node.lastSeenAt = new Date(); node.version = input.version ?? node.version; node.endpoint = input.endpoint ?? node.endpoint; node.catalogueVersion = input.catalogueVersion ?? node.catalogueVersion;
    node = await this.nodes.save(node);
    await this.events.emit({ ownerId: ownerUserId, eventName: 'node.online', aggregateType: 'KobeNode', aggregateId: node.id, payload: { businessId: business.id } });
    return { node, nodeKey: key };
  }

  async heartbeat(nodeId: string, nodeKey: string, metadata: Record<string, unknown> = {}) {
    const node = await this.nodes.findOne({ where: { id: nodeId } });
    if (!node || hash(nodeKey) !== node.nodeKeyHash) throw new BadRequestException('Invalid node credentials');
    const wasOffline = node.status === 'OFFLINE';
    node.status = 'ONLINE'; node.lastSeenAt = new Date();
    if (typeof metadata.endpoint === 'string') node.endpoint = metadata.endpoint;
    if (typeof metadata.catalogueVersion === 'string') node.catalogueVersion = metadata.catalogueVersion;
    await this.nodes.save(node);
    await this.repo(NodeHeartbeat).save(this.repo(NodeHeartbeat).create({ nodeId: node.id, businessId: node.businessId, receivedAt: new Date(), state: 'ONLINE', metadata }));
    const productSnapshot = Array.isArray(metadata.products) ? metadata.products.slice(0, 5000) as Array<Record<string, unknown>> : [];
    for (const live of productSnapshot) {
      if (typeof live.productId !== 'string') continue;
      const snippet = await this.snippets.findOne({ where: { businessId: node.businessId, productId: live.productId } });
      if (!snippet) continue;
      const wasAvailable = Boolean(snippet.active && Number(snippet.stock) > 0);
      if (Number.isFinite(Number(live.price)) && Number(live.price) >= 0) snippet.price = Number(live.price);
      if (Number.isFinite(Number(live.stock)) && Number(live.stock) >= 0) snippet.stock = Math.floor(Number(live.stock));
      if (typeof live.available === 'boolean') snippet.active = live.available;
      snippet.availabilityHint = snippet.active && snippet.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'; snippet.lastOnlineAt = node.lastSeenAt;
      await this.snippets.save(snippet);
      const isAvailable = Boolean(snippet.active && Number(snippet.stock) > 0);
      if (wasAvailable !== isAvailable) await this.events.emit({ eventName: isAvailable ? 'product.available' : 'product.unavailable', aggregateType: 'PosProduct', aggregateId: snippet.productId, payload: { businessId: node.businessId, stock: snippet.stock, source: 'node_heartbeat' } });
    }
    if (!productSnapshot.length) await this.snippets.update({ businessId: node.businessId }, { lastOnlineAt: node.lastSeenAt });
    if (wasOffline) await this.events.emit({ eventName: 'node.online', aggregateType: 'KobeNode', aggregateId: node.id, payload: { businessId: node.businessId } });
    return { online: true, nextHeartbeatSeconds: 60 };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async markStaleNodesOffline() {
    const online = await this.nodes.find({ where: { status: 'ONLINE' } });
    for (const node of online) {
      if (isNodeOnline(node.lastSeenAt)) continue;
      node.status = 'OFFLINE'; await this.nodes.save(node);
      await this.repo(NodeHeartbeat).save(this.repo(NodeHeartbeat).create({ nodeId: node.id, businessId: node.businessId, receivedAt: new Date(), state: 'OFFLINE', metadata: { reason: 'heartbeat_timeout' } }));
      await this.events.emit({ eventName: 'node.offline', aggregateType: 'KobeNode', aggregateId: node.id, payload: { businessId: node.businessId } });
    }
  }

  async publicItems(query: { q?: string; category?: string; businessId?: string; limit?: string }) {
    const businesses = await this.businesses.find({ where: { status: 'ACTIVE' } });
    const nodes = await this.nodes.find({ where: { businessId: In(businesses.map((b) => b.id)) } });
    const nodeMap = new Map(nodes.map((n) => [n.businessId, n]));
    // Jumla is served from the cloud snippet mirror, so a shop stays visible and
    // orderable even when its KobeOS desktop node is offline — the order is
    // captured in the cloud and delivered when the node reconnects. We surface
    // the live/offline state via nodeStatus rather than hiding the shop, so a
    // merchant who closes their laptop never disappears from the marketplace.
    const visible = businesses;
    const visibleIds = visible.map((b) => b.id);
    if (!visibleIds.length) return [];
    const statusOf = (b?: CommerceBusiness) => !b ? 'CLOUD_OFFLINE' : b.tier === 'LITE' ? 'CLOUD_LITE' : isNodeOnline(nodeMap.get(b.id)?.lastSeenAt) ? 'ONLINE' : 'CLOUD_OFFLINE';
    const qb = this.snippets.createQueryBuilder('s').where('s.businessId IN (:...ids)', { ids: visibleIds }).andWhere('s.active = true').andWhere('s.stock > 0');
    if (query.q?.trim()) qb.andWhere('(LOWER(s.name) LIKE :q OR LOWER(s.description) LIKE :q)', { q: `%${query.q.toLowerCase().trim()}%` });
    if (query.category?.trim()) qb.andWhere('LOWER(s.category) = :category', { category: query.category.toLowerCase().trim() });
    if (query.businessId) qb.andWhere('s.businessId = :businessId', { businessId: query.businessId });
    const rows = await qb.orderBy('s.indexedAt', 'DESC').take(Math.min(200, Math.max(1, Number(query.limit) || 60))).getMany();
    const map = new Map(visible.map((b) => [b.id, b]));
    const [products, locations] = await Promise.all([
      rows.length ? this.products.find({ where: { id: In(rows.map((r) => r.productId)) } }) : [],
      this.repo(BusinessLocation).find({ where: { businessId: In(visibleIds), active: true } }),
    ]);
    const location = new Map(locations.map((row) => [row.businessId, row]));
    const shopIds = locations.map((row) => row.shopUnitId).filter((id): id is string => Boolean(id));
    const shops = shopIds.length ? await this.shops.find({ where: { id: In(shopIds) } }) : [];
    const floorIds = shops.map((row) => row.floorId); const propertyIds = shops.map((row) => row.propertyId);
    const [floors, properties] = await Promise.all([floorIds.length ? this.floors.find({ where: { id: In(floorIds) } }) : [], propertyIds.length ? this.repo(Property).find({ where: { id: In(propertyIds) } }) : []]);
    const productMap = new Map<string, PosProduct>(products.map((p): [string, PosProduct] => [p.id, p]));
    return rows.map((r) => {
      const product = productMap.get(r.productId);
      const business = map.get(r.businessId); const businessLocation = location.get(r.businessId); const shop = shops.find((row) => row.id === businessLocation?.shopUnitId); const floor = floors.find((row) => row.id === shop?.floorId); const property = properties.find((row) => row.id === shop?.propertyId);
      return { ...r, imageUrls: product?.imageUrls ?? (r.imageUrl ? [r.imageUrl] : []), variants: product?.variants ?? [], requiredOptions: Array.isArray(product?.customData?.requiredOptions) ? product.customData.requiredOptions : [], business: { id: r.businessId, businessId: business?.businessId, name: business?.name, publicSlug: business?.publicSlug, tier: business?.tier, phone: business?.phone, whatsapp: String(business?.profile?.whatsapp ?? business?.phone ?? '') }, location: businessLocation ? { property: property?.name ?? '', floor: floor?.name ?? '', shopCode: shop?.publicCode ?? businessLocation.name } : null, nodeStatus: statusOf(business) };
    });
  }

  async publicProperties(query: { q?: string; city?: string; category?: string }) {
    const qb = this.repo(Property).createQueryBuilder('p').where("p.type IN ('commercial','mixed')");
    if (query.q) qb.andWhere('(LOWER(p.name) LIKE :q OR LOWER(p.address) LIKE :q)', { q: `%${query.q.toLowerCase()}%` });
    if (query.city) qb.andWhere('LOWER(p.city) LIKE :city', { city: `%${query.city.toLowerCase()}%` });
    const properties = await qb.orderBy('p.name', 'ASC').take(100).getMany();
    return Promise.all(properties.map(async (property) => {
      const shops = await this.shops.find({ where: { propertyId: property.id, status: 'CLAIMED' }, order: { publicCode: 'ASC' } });
      const filtered = query.category ? shops.filter((s) => s.categoryId.toLowerCase().includes(query.category!.toLowerCase())) : shops;
      const businessIds = filtered.map((s) => s.businessId).filter((id): id is string => Boolean(id));
      const businesses = businessIds.length ? await this.businesses.find({ where: { id: In(businessIds), status: 'ACTIVE' } }) : [];
      return { id: property.id, name: property.name, address: property.address, city: property.city, imageUrl: property.imageUrl, publicSlug: property.publicSlug, marketplaceEnabled: property.marketplaceEnabled, marketplaceUrl: property.publicSlug ? `https://${property.publicSlug}.kobeapptz.com` : null, totalShops: property.totalUnits, claimedShops: filtered.map((shop) => ({ shopCode: shop.publicCode, categoryId: shop.categoryId, business: businesses.find((b) => b.id === shop.businessId) ? { id: shop.businessId, name: businesses.find((b) => b.id === shop.businessId)!.name, publicSlug: businesses.find((b) => b.id === shop.businessId)!.publicSlug, tier: businesses.find((b) => b.id === shop.businessId)!.tier } : null })) };
    }));
  }

  async recordInterest(input: { productId: string; eventType: InterestEvent['eventType']; phone?: string; sessionId?: string; metadata?: Record<string, unknown> }) {
    const snippet = await this.snippets.findOne({ where: { productId: input.productId, active: true } });
    if (!snippet) throw new NotFoundException('Product not found');
    let customerId: string | null = null;
    if (input.phone) customerId = (await this.upsertCustomer({ phone: input.phone })).id;
    const row = await this.repo(InterestEvent).save(this.repo(InterestEvent).create({ productId: snippet.productId, businessId: snippet.businessId, customerId, eventType: input.eventType, sessionId: input.sessionId ?? '', metadata: input.metadata ?? {} }));
    if (input.eventType === 'SWIPE_RIGHT') await this.events.emit({ eventName: 'product.swiped_right', aggregateType: 'PosProduct', aggregateId: snippet.productId, payload: { businessId: snippet.businessId, customerId } });
    return row;
  }

  private async upsertCustomer(input: { phone: string; name?: string; email?: string; address?: string }, tx = this.ds.manager) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BadRequestException('Customer phone is required');
    const repo = tx.getRepository(CommerceCustomer);
    let row = await repo.findOne({ where: { phone } });
    row ??= repo.create({ phone, name: '', email: '', defaultAddress: '', preferences: {} });
    if (input.name) row.name = input.name.trim();
    if (input.email) row.email = input.email.trim().toLowerCase();
    if (input.address) row.defaultAddress = input.address.trim();
    return repo.save(row);
  }

  async submitCart(input: {
    customer: { phone: string; name: string; email?: string }; fulfillment: 'PICKUP' | 'DELIVERY'; deliveryAddress?: string; note?: string;
    lines: Array<{ productId: string; quantity: number; selectedOptions?: Record<string, string> }>;
    attribution?: { code?: string; clickId?: string; promoCode?: string; liveClickVisitId?: string };
  }) {
    const clickId = (input.attribution?.clickId ?? '').trim();
    const promoCode = (input.attribution?.promoCode ?? '').trim();
    const liveClickVisitId = (input.attribution?.liveClickVisitId ?? '').trim();
    // Resolve a promo code to its link code up front so promo-only orders carry
    // the same attributionCode as click orders (status transitions key off it).
    let attributionCode = (input.attribution?.code ?? '').trim();
    if (!attributionCode && promoCode) {
      const promoLink = await this.creatorCommerce.resolvePromoCode(promoCode).catch(() => null);
      if (promoLink) attributionCode = promoLink.code;
    }
    if (!input.lines?.length) throw new BadRequestException('Cart is empty');
    if (input.fulfillment === 'DELIVERY' && !input.deliveryAddress?.trim()) throw new BadRequestException('Delivery address is required');
    const ids = [...new Set(input.lines.map((l) => l.productId))];
    const snippets = await this.snippets.find({ where: { productId: In(ids), active: true } });
    if (snippets.length !== ids.length) throw new BadRequestException('One or more products are unavailable');
    const products = await this.products.find({ where: { id: In(ids) } });
    const productMap = new Map<string, PosProduct>(products.map((p): [string, PosProduct] => [p.id, p]));
    const snippetMap = new Map(snippets.map((s) => [s.productId, s]));
    const businessIds = [...new Set(snippets.map((snippet) => snippet.businessId))];
    const [businesses, nodes] = await Promise.all([this.businesses.find({ where: { id: In(businessIds), status: 'ACTIVE' } }), this.nodes.find({ where: { businessId: In(businessIds) } })]);
    const businessMap = new Map(businesses.map((business) => [business.id, business])); const nodeMap = new Map(nodes.map((node) => [node.businessId, node]));
    for (const line of input.lines) {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new BadRequestException('Every quantity must be greater than zero');
      const p = productMap.get(line.productId);
      const snippet = snippetMap.get(line.productId); const business = snippet && businessMap.get(snippet.businessId);
      if (!business) throw new BadRequestException('Merchant is unavailable');
      if (business.tier === 'FULL' && !isNodeOnline(nodeMap.get(business.id)?.lastSeenAt)) throw new BadRequestException(`${business.name} is offline. Try again when its KobeOS reconnects.`);
      const liveStock = business.tier === 'FULL' ? Math.min(Number(p?.stock ?? 0), Number(snippet?.stock ?? 0)) : Number(p?.stock ?? 0);
      if (!p || !snippet?.active || liveStock < line.quantity) throw new BadRequestException(`${p?.name ?? 'Product'} does not have enough live stock`);
      const required = Array.isArray(p.customData?.requiredOptions) ? p.customData.requiredOptions as string[] : [];
      const missing = missingRequiredOptions(required, line.selectedOptions);
      if (missing.length) throw new BadRequestException(`${p.name}: select ${missing.join(', ')}`);
    }
    const groups = groupByMerchant(input.lines, (line) => snippetMap.get(line.productId)!.businessId);
    const created = await this.ds.transaction(async (tx) => {
      const customer = await this.upsertCustomer({ ...input.customer, address: input.deliveryAddress }, tx);
      const cart = await tx.getRepository(CommerceCart).save(tx.getRepository(CommerceCart).create({ customerId: customer.id, status: 'OPEN', currency: 'TZS' }));
      await tx.getRepository(CommerceCartLine).save(input.lines.map((line) => tx.getRepository(CommerceCartLine).create({ cartId: cart.id, businessId: snippetMap.get(line.productId)!.businessId, productId: line.productId, quantity: line.quantity, selectedOptions: line.selectedOptions ?? {} })));
      const merchantOrders: MerchantOrder[] = [];
      for (const [businessId, lines] of groups) {
        const business = await tx.getRepository(CommerceBusiness).findOne({ where: { id: businessId } });
        if (!business) throw new BadRequestException('Merchant is unavailable');
        let quota = await tx.getRepository(MerchantQuota).findOne({ where: { businessId } });
        quota ??= tx.getRepository(MerchantQuota).create({ businessId, freeOrderLimit: LITE_FREE_ORDER_LIMIT, submittedOrders: 0, lockedOrders: 0 });
        const access = merchantOrderAccess(business.tier, quota.submittedOrders, quota.freeOrderLimit);
        const total = lines.reduce((sum, line) => sum + num(snippetMap.get(line.productId)!.price) * line.quantity, 0);
        const order = await tx.getRepository(MerchantOrder).save(tx.getRepository(MerchantOrder).create({
          orderNumber: humanCode('JML'), businessId, customerId: customer.id, cartId: cart.id, status: access.status,
          fulfillment: input.fulfillment, deliveryAddress: input.deliveryAddress?.trim() ?? '', customerNote: input.note?.trim() ?? '', total, currency: 'TZS', merchantLocked: access.locked, channel: 'jumla',
          attributionCode, clickId,
        }));
        await tx.getRepository(CommerceOrderLine).save(lines.map((line) => {
          const p = productMap.get(line.productId)!;
          const livePrice = snippetMap.get(line.productId)!.price;
          return tx.getRepository(CommerceOrderLine).create({ merchantOrderId: order.id, productId: p.id, productName: p.name, unitPrice: livePrice, quantity: line.quantity, lineTotal: num(livePrice) * line.quantity, selectedOptions: line.selectedOptions ?? {} });
        }));
        quota.submittedOrders += 1;
        if (access.locked) quota.lockedOrders += 1;
        await tx.getRepository(MerchantQuota).save(quota);
        merchantOrders.push(order);
      }
      cart.status = 'SUBMITTED'; await tx.getRepository(CommerceCart).save(cart);
      return { customer, cart, merchantOrders };
    });
    for (const order of created.merchantOrders) {
      const business = await this.businesses.findOne({ where: { id: order.businessId } });
      const quota = await this.quotas.findOne({ where: { businessId: order.businessId } });
      await this.events.emit({ ownerId: business?.ownerUserId, eventName: 'cart.order_submitted', aggregateType: 'MerchantOrder', aggregateId: order.id, payload: { businessId: order.businessId, locked: order.merchantLocked, orderNumber: order.orderNumber } });
      if (business) await this.notifications.send({ ownerId: business.ownerUserId, recipientKey: business.businessId, phone: business.phone, title: 'New Jumla order', body: order.merchantLocked ? `${quota?.lockedOrders ?? 1} orders are waiting. Activate KobeOS to unlock them.` : `New Jumla order ${order.orderNumber}. You have used ${quota?.submittedOrders ?? 0}/${quota?.freeOrderLimit ?? 50} free orders.`, actionUrl: '/commerce', channels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'] });
      if (quota?.submittedOrders === 40) await this.events.emit({ ownerId: business?.ownerUserId, eventName: 'lite.quota_warning', aggregateType: 'MerchantQuota', aggregateId: quota.id, payload: { used: 40, limit: quota.freeOrderLimit } });
      if (quota?.submittedOrders === 48 && business) await this.notifications.send({ ownerId: business.ownerUserId, recipientKey: business.businessId, phone: business.phone, title: 'Only 2 free Jumla orders remain', body: 'You have used 48 of your 50 free orders. Activate KobeOS now to keep full merchant order access.', actionUrl: '/commerce', channels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'] });
      if (quota && quota.submittedOrders === quota.freeOrderLimit) await this.events.emit({ ownerId: business?.ownerUserId, eventName: 'lite.quota_reached', aggregateType: 'MerchantQuota', aggregateId: quota.id, payload: { used: quota.submittedOrders, limit: quota.freeOrderLimit } });
    }
    // Creator attribution is best-effort: a stale or bad code must never block a
    // real order. Each merchant order in a multi-shop cart is attributed to the
    // same creator link (they all came from that one creator click).
    if (attributionCode) {
      for (const order of created.merchantOrders) {
        try {
          await this.creatorCommerce.attributeOrder({ code: attributionCode, clickId, orderId: order.id, revenue: Number(order.total), currency: order.currency });
        } catch { /* attribution is advisory; never fail the order on it */ }
      }
    }
    // Live Ads conversion: a sale that came from a sponsor's live overlay click.
    if (liveClickVisitId) {
      for (const order of created.merchantOrders) {
        try { await this.liveAds.recordConversion(liveClickVisitId, order.id, Number(order.total)); }
        catch { /* advisory */ }
      }
    }
    return { success: true, message: 'Order sent successfully', cartId: created.cart.id, orders: created.merchantOrders.map((o) => ({ orderNumber: o.orderNumber, businessId: o.businessId, status: 'SUBMITTED', total: o.total })) };
  }

  async merchantOrders(ownerUserId: string) {
    const business = await this.businessForOwner(ownerUserId);
    const orders = await this.orders.find({ where: { businessId: business.id }, order: { createdAt: 'DESC' } });
    const visible: Array<Record<string, unknown>> = [];
    for (const order of orders) {
      if (order.merchantLocked) { visible.push({ id: order.id, orderNumber: order.orderNumber, status: order.status, merchantLocked: true, createdAt: order.createdAt }); continue; }
      const [customer, lines] = await Promise.all([this.repo(CommerceCustomer).findOne({ where: { id: order.customerId } }), this.repo(CommerceOrderLine).find({ where: { merchantOrderId: order.id } })]);
      visible.push({ ...order, customer, lines });
    }
    return { business, quota: await this.quotas.findOne({ where: { businessId: business.id } }), orders: visible };
  }

  async updateMerchantOrderStatus(ownerUserId: string, id: string, status: MerchantOrder['status']) {
    const business = await this.businessForOwner(ownerUserId);
    const order = await this.orders.findOne({ where: { id, businessId: business.id } });
    if (!order) throw new NotFoundException('Merchant order not found');
    if (order.merchantLocked) throw new BadRequestException('Activate KobeOS before managing waiting orders');
    const allowed: MerchantOrder['status'][] = ['VIEWED', 'ACCEPTED', 'RESERVED', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'UNAVAILABLE'];
    if (!allowed.includes(status)) throw new BadRequestException('Invalid merchant order status');
    order.status = status; await this.orders.save(order);
    // Drive creator-commission state off the sale lifecycle: a completed sale
    // earns the commission; a cancelled/unavailable order reverses it so no
    // commission is paid for a sale that never happened.
    if (order.attributionCode) {
      try {
        if (status === 'COMPLETED') await this.creatorCommerce.markOrderCompleted(order.id);
        else if (status === 'CANCELLED' || status === 'UNAVAILABLE') await this.creatorCommerce.reverseOrder(order.id, `order_${status.toLowerCase()}`);
      } catch { /* attribution is advisory; never fail the status change on it */ }
    }
    const customer = await this.repo(CommerceCustomer).findOne({ where: { id: order.customerId } });
    if (customer?.phone) await this.notifications.send({ ownerId: business.ownerUserId ?? undefined, recipientKey: customer.id, phone: customer.phone, title: `Order ${order.orderNumber}: ${status.replace(/_/g, ' ')}`, body: `${business.name} updated your order to ${status.replace(/_/g, ' ').toLowerCase()}.`, actionUrl: `/jumla/order/${order.orderNumber}`, channels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'] });
    return order;
  }

  async createVehicle(ownerUserId: string, input: Partial<CommerceVehicle> & { mediaUrls?: string[]; listing?: Partial<VehicleListingMetadata> }) {
    const business = await this.businessForOwner(ownerUserId);
    if (!input.make || !input.model || !input.year || !input.price) throw new BadRequestException('Make, model, year and price are required');
    const vehicle = await this.vehicles.save(this.vehicles.create({
      businessId: business.id, catalogOwnerId: business.catalogOwnerId, stockNumber: input.stockNumber || humanCode('CAR'),
      make: input.make, model: input.model, year: Number(input.year), trim: input.trim ?? '', price: num(input.price), currency: input.currency ?? 'TZS',
      mileage: Number(input.mileage) || 0, transmission: input.transmission ?? '', fuel: input.fuel ?? '', color: input.color ?? '',
      interiorColor: input.interiorColor ?? '', engine: input.engine ?? '', driveType: input.driveType ?? '', bodyType: input.bodyType ?? '',
      vin: input.vin ?? '', registration: input.registration ?? '', dutyStatus: input.dutyStatus ?? '', source: input.source ?? 'LOCAL',
      financingAvailable: Boolean(input.financingAvailable), negotiable: Boolean(input.negotiable), features: input.features ?? [], location: input.location ?? '',
      condition: input.condition ?? 'USED', status: input.status ?? 'AVAILABLE', description: input.description ?? '',
      aiSalesCopy: input.aiSalesCopy || `${input.year} ${input.make} ${input.model} available in ${input.location || 'Tanzania'}. Contact the verified dealer to reserve.`, metadata: input.metadata ?? {},
    }));
    const media = (input.mediaUrls ?? []).map((url, sortOrder) => this.repo(VehicleMedia).create({ vehicleId: vehicle.id, url, kind: /\.(mp4|webm|mov)(?:\?|$)/i.test(url) ? 'VIDEO' : 'IMAGE', sortOrder }));
    if (media.length) await this.repo(VehicleMedia).save(media);
    const listing = await this.repo(VehicleListingMetadata).save(this.repo(VehicleListingMetadata).create({
      vehicleId: vehicle.id, highlights: input.listing?.highlights ?? [vehicle.condition, vehicle.transmission, vehicle.fuel].filter(Boolean),
      keywords: input.listing?.keywords ?? [vehicle.make, vehicle.model, String(vehicle.year)], socialCaption: input.listing?.socialCaption || vehicle.aiSalesCopy,
      verticalVideoUrl: input.listing?.verticalVideoUrl ?? media.find((row) => row.kind === 'VIDEO')?.url ?? '', purchaseCost: num(input.listing?.purchaseCost),
      dutyCost: num(input.listing?.dutyCost), clearingCost: num(input.listing?.clearingCost), transportCost: num(input.listing?.transportCost),
      repairCost: num(input.listing?.repairCost), advertisingCost: num(input.listing?.advertisingCost),
    }));
    return { ...vehicle, media, listing, economics: vehicleEconomics(listing, Number(vehicle.price)) };
  }

  async updateVehicle(ownerUserId: string, id: string, input: Partial<CommerceVehicle> & { listing?: Partial<VehicleListingMetadata> }) {
    const business = await this.businessForOwner(ownerUserId);
    const vehicle = await this.vehicles.findOne({ where: { id, businessId: business.id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const { listing, ...vehiclePatch } = input; delete (vehiclePatch as { id?: string }).id; delete (vehiclePatch as { businessId?: string }).businessId; delete (vehiclePatch as { catalogOwnerId?: string }).catalogOwnerId;
    Object.assign(vehicle, vehiclePatch); await this.vehicles.save(vehicle);
    let listingRow = await this.repo(VehicleListingMetadata).findOne({ where: { vehicleId: vehicle.id } });
    if (listing) { listingRow ??= this.repo(VehicleListingMetadata).create({ vehicleId: vehicle.id, highlights: [], keywords: [], socialCaption: '', verticalVideoUrl: '', purchaseCost: 0, dutyCost: 0, clearingCost: 0, transportCost: 0, repairCost: 0, advertisingCost: 0 }); Object.assign(listingRow, listing, { vehicleId: vehicle.id }); listingRow = await this.repo(VehicleListingMetadata).save(listingRow); }
    return { ...vehicle, listing: listingRow, economics: vehicleEconomics(listingRow ?? {}, Number(vehicle.price)) };
  }

  async vehicleInventory(ownerUserId: string) {
    const business = await this.businessForOwner(ownerUserId);
    const vehicles = await this.vehicles.find({ where: { businessId: business.id }, order: { createdAt: 'DESC' } });
    return Promise.all(vehicles.map(async (vehicle) => { const [media, listing, requests] = await Promise.all([this.repo(VehicleMedia).find({ where: { vehicleId: vehicle.id }, order: { sortOrder: 'ASC' } }), this.repo(VehicleListingMetadata).findOne({ where: { vehicleId: vehicle.id } }), this.repo(VehicleBuyerRequest).count({ where: { vehicleId: vehicle.id } })]); return { ...vehicle, media, listing, requests, economics: vehicleEconomics(listing ?? {}, Number(vehicle.price)) }; }));
  }

  async generateVehicleMarketing(ownerUserId: string, id: string) {
    const business = await this.businessForOwner(ownerUserId);
    const vehicle = await this.vehicles.findOne({ where: { id, businessId: business.id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const media = await this.repo(VehicleMedia).find({ where: { vehicleId: id }, order: { sortOrder: 'ASC' } });
    const fallbackHighlights = [vehicle.condition, vehicle.transmission, vehicle.fuel, vehicle.engine, vehicle.driveType, vehicle.financingAvailable ? 'Financing available' : ''].filter(Boolean);
    const fallbackCaption = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''} · ${Number(vehicle.price).toLocaleString()} ${vehicle.currency}. ${vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} km. ` : ''}${vehicle.location ? `Available in ${vehicle.location}. ` : ''}${vehicle.negotiable ? 'Price negotiable. ' : ''}Contact ${business.name} to buy or reserve.`;
    let generated: { caption?: string; highlights?: string[]; socialCaption?: string; whatsappStatus?: string; voiceoverScript?: string; keywords?: string[] } = {};
    try {
      const raw = await this.ai.complete(
        `Create accurate marketing content for this vehicle. Return ONLY JSON with keys caption, highlights (array, max 6), socialCaption, whatsappStatus, voiceoverScript (30 seconds), keywords (array, max 10). Do not invent facts. Vehicle: ${JSON.stringify({ make: vehicle.make, model: vehicle.model, year: vehicle.year, trim: vehicle.trim, price: vehicle.price, currency: vehicle.currency, mileage: vehicle.mileage, transmission: vehicle.transmission, fuel: vehicle.fuel, engine: vehicle.engine, driveType: vehicle.driveType, bodyType: vehicle.bodyType, condition: vehicle.condition, financingAvailable: vehicle.financingAvailable, negotiable: vehicle.negotiable, features: vehicle.features, location: vehicle.location })}`,
        'You are Kobe Cars marketing assistant for Tanzania. Produce concise, truthful, sales-ready copy and valid JSON only.',
      );
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) generated = JSON.parse(match[0]) as typeof generated;
    } catch {
      generated = {};
    }
    const highlights = Array.isArray(generated.highlights) && generated.highlights.length ? generated.highlights.map(String).slice(0, 6) : fallbackHighlights;
    const keywords = Array.isArray(generated.keywords) && generated.keywords.length ? generated.keywords.map(String).slice(0, 10) : [vehicle.make, vehicle.model, String(vehicle.year), vehicle.bodyType, vehicle.location].filter(Boolean);
    const caption = String(generated.caption || fallbackCaption).slice(0, 4000);
    const socialCaption = String(generated.socialCaption || caption).slice(0, 4000);
    const whatsappStatus = String(generated.whatsappStatus || caption).slice(0, 700);
    const voiceoverScript = String(generated.voiceoverScript || `Meet the ${vehicle.year} ${vehicle.make} ${vehicle.model}. ${highlights.join('. ')}. Contact ${business.name} today to buy or reserve.`).slice(0, 4000);
    vehicle.aiSalesCopy = caption;
    vehicle.metadata = { ...(vehicle.metadata ?? {}), bestCoverUrl: media.find((item) => item.kind === 'IMAGE')?.url ?? media[0]?.url ?? '', whatsappStatus, voiceoverScript, marketingGeneratedAt: new Date().toISOString() };
    await this.vehicles.save(vehicle);
    let listing = await this.repo(VehicleListingMetadata).findOne({ where: { vehicleId: id } });
    listing ??= this.repo(VehicleListingMetadata).create({ vehicleId: id, highlights: [], keywords: [], socialCaption: '', verticalVideoUrl: '', purchaseCost: 0, dutyCost: 0, clearingCost: 0, transportCost: 0, repairCost: 0, advertisingCost: 0 });
    listing.highlights = highlights; listing.keywords = keywords; listing.socialCaption = socialCaption;
    listing = await this.repo(VehicleListingMetadata).save(listing);
    const videoJob = await this.videoGeneration.createJob(ownerUserId, { title: `${vehicle.year} ${vehicle.make} ${vehicle.model} promotion`, topic: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, script: voiceoverScript, aspect: '9:16', count: 1, subtitlesEnabled: true });
    vehicle.metadata = { ...vehicle.metadata, videoJobId: videoJob.id };
    await this.vehicles.save(vehicle);
    return { vehicle, listing, bestCoverUrl: vehicle.metadata.bestCoverUrl, whatsappStatus, voiceoverScript, videoJob };
  }

  async publicVehicles(query: { q?: string; make?: string; model?: string; minYear?: string; maxYear?: string; minPrice?: string; maxPrice?: string; maxMileage?: string; location?: string; transmission?: string; fuel?: string; bodyType?: string; condition?: string; financing?: string; dealer?: string; color?: string }) {
    const businesses = await this.businesses.find({ where: { status: 'ACTIVE' } });
    // Cars stay listed on Jumla whether or not the dealer's KobeOS node is
    // online — the vehicle records live in the cloud, and a buyer enquiry/reserve
    // is captured server-side and reaches the dealer when they reconnect.
    const visibleBusinessIds = businesses.map((business) => business.id);
    if (!visibleBusinessIds.length) return [];
    const qb = this.vehicles.createQueryBuilder('v').where("v.status IN ('AVAILABLE','IN_TRANSIT','COMING_SOON')").andWhere('v.businessId IN (:...visibleBusinessIds)', { visibleBusinessIds });
    if (query.q) {
      qb.andWhere('(LOWER(v.make) LIKE :q OR LOWER(v.model) LIKE :q OR LOWER(v.description) LIKE :q OR LOWER(v.bodyType) LIKE :q)', { q: `%${query.q.toLowerCase()}%` });
      const naturalMax = query.q.match(/(?:below|under|max)\s*(\d+(?:\.\d+)?)\s*(m|million)?/i);
      if (naturalMax) qb.andWhere('v.price <= :naturalMax', { naturalMax: Number(naturalMax[1]) * (naturalMax[2] ? 1_000_000 : 1) });
    }
    if (query.make) qb.andWhere('LOWER(v.make) = :make', { make: query.make.toLowerCase() });
    if (query.model) qb.andWhere('LOWER(v.model) = :model', { model: query.model.toLowerCase() });
    if (query.minYear) qb.andWhere('v.year >= :minYear', { minYear: Number(query.minYear) });
    if (query.maxYear) qb.andWhere('v.year <= :maxYear', { maxYear: Number(query.maxYear) });
    if (query.minPrice) qb.andWhere('v.price >= :minPrice', { minPrice: Number(query.minPrice) });
    if (query.maxPrice) qb.andWhere('v.price <= :maxPrice', { maxPrice: Number(query.maxPrice) });
    if (query.maxMileage) qb.andWhere('v.mileage <= :maxMileage', { maxMileage: Number(query.maxMileage) });
    for (const [field, value] of Object.entries({ location: query.location, transmission: query.transmission, fuel: query.fuel, bodyType: query.bodyType, condition: query.condition, color: query.color })) if (value) qb.andWhere(`LOWER(v.${field}) LIKE :${field}`, { [field]: `%${value.toLowerCase()}%` });
    if (query.financing === 'true') qb.andWhere('v.financingAvailable = true');
    if (query.dealer) { const dealerIds = businesses.filter((business) => business.name.toLowerCase().includes(query.dealer!.toLowerCase())).map((business) => business.id); if (!dealerIds.length) return []; qb.andWhere('v.businessId IN (:...dealerIds)', { dealerIds }); }
    const vehicles = await qb.orderBy('v.createdAt', 'DESC').take(100).getMany();
    return Promise.all(vehicles.map(async (v) => { const listing = await this.repo(VehicleListingMetadata).findOne({ where: { vehicleId: v.id } }); return { ...v, canBuy: v.status === 'AVAILABLE', media: await this.repo(VehicleMedia).find({ where: { vehicleId: v.id }, order: { sortOrder: 'ASC' } }), listing: listing ? { highlights: listing.highlights, socialCaption: listing.socialCaption, verticalVideoUrl: listing.verticalVideoUrl } : null, dealer: await this.businesses.findOne({ where: { id: v.businessId }, select: ['id', 'businessId', 'name', 'publicSlug', 'phone'] }) }; }));
  }

  async vehicleRequest(id: string, input: { customerName: string; customerPhone: string; customerWhatsapp?: string; requestType?: 'OUTRIGHT' | 'RESERVE' | 'FINANCE'; offerAmount?: number; preferredContact?: 'PHONE' | 'WHATSAPP' | 'SMS' | 'EMAIL'; tradeInDetails?: string; message?: string; reserve?: boolean }) {
    const vehicle = await this.vehicles.findOne({ where: { id } });
    if (!vehicle || vehicle.status !== 'AVAILABLE') throw new NotFoundException('Vehicle is not currently available for purchase');
    const requestType = input.requestType ?? (input.reserve ? 'RESERVE' : 'OUTRIGHT');
    if (requestType === 'FINANCE' && !vehicle.financingAvailable) throw new BadRequestException('Financing is not enabled for this vehicle');
    const request = await this.repo(VehicleBuyerRequest).save(this.repo(VehicleBuyerRequest).create({ vehicleId: id, businessId: vehicle.businessId, customerName: input.customerName.trim(), customerPhone: normalizePhone(input.customerPhone), customerWhatsapp: normalizePhone(input.customerWhatsapp || input.customerPhone), requestType, offerAmount: input.offerAmount ? num(input.offerAmount) : null, preferredContact: input.preferredContact ?? 'PHONE', tradeInDetails: input.tradeInDetails?.trim() ?? '', message: input.message?.trim() ?? '', status: 'NEW' }));
    let reservation: VehicleReservation | null = null;
    if (requestType === 'RESERVE') reservation = await this.repo(VehicleReservation).save(this.repo(VehicleReservation).create({ vehicleId: id, businessId: vehicle.businessId, reservationCode: humanCode('VR'), customerName: input.customerName, customerPhone: normalizePhone(input.customerPhone), status: 'HELD', expiresAt: new Date(Date.now() + 30 * 60_000) }));
    const business = await this.businesses.findOne({ where: { id: vehicle.businessId } });
    await this.notifications.send({ ownerId: business?.ownerUserId ?? undefined, recipientKey: vehicle.businessId, phone: business?.phone ?? '', title: `New ${requestType.toLowerCase()} vehicle request`, body: `${input.customerName} requested the ${vehicle.year} ${vehicle.make} ${vehicle.model}.`, actionUrl: '/commerce', channels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'] });
    return { request, reservation };
  }
}
