import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GuidedCatalogueDto } from "./dto/guided-catalogue.dto";
import { MediaInboxService } from "./media-inbox.service";
import { MediaInboxItem } from "./media-inbox.entity";
import { PosProduct } from "../pos/pos.entity";
import { HotelRoom } from "../hotel/hotel.entity";

const input = {
  businessType: "shop",
  name: "Shirt",
  category: "Clothes",
  price: 25000,
  stock: 5,
  size: "M",
};
function fixture(itemOverride: Record<string, unknown> = {}) {
  const item = {
    id: "photo",
    ownerId: "owner",
    status: "UNPROCESSED",
    url: "/photo",
    metadata: { guidedBusinessType: "shop" },
    ...itemOverride,
  };
  const inbox = {
    findOne: jest.fn().mockResolvedValue(item),
    save: jest.fn(async (x) => x),
  };
  const products = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: "product" })),
  };
  const rooms = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x) => x),
    save: jest.fn(async (xs) => xs.map((x, i) => ({ ...x, id: `room-${i}` }))),
  };
  const manager = {
    getRepository: jest.fn((entity) =>
      entity === MediaInboxItem
        ? inbox
        : entity === PosProduct
          ? products
          : entity === HotelRoom
            ? rooms
            : { findOne: async () => null },
    ),
    query: jest.fn().mockResolvedValue([{ guidedSetup: { currency: "TZS" } }]),
  };
  const db = {
    options: { host: "localhost" },
    transaction: jest.fn((fn) => fn(manager)),
  };
  const service = new MediaInboxService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    db as any,
    null as any,
  );
  return { service, db, item, inbox, products, rooms };
}
describe("guided photo confirmation", () => {
  it("rejects negative/fractional stock, invalid variants and missing price", async () => {
    for (const changed of [
      { stock: -1 },
      { stock: 1.2 },
      { price: undefined },
      { variants: [{ size: "M", price: -2, stock: 2 }] },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(GuidedCatalogueDto, { ...input, ...changed }),
          )
        ).length,
      ).toBeGreaterThan(0);
    }
  });
  it("locks by owner and sums per-size stock", async () => {
    const f = fixture();
    await f.service.confirmGuided("owner", "photo", {
      ...input,
      variants: [
        { size: "S", price: 20000, stock: 2 },
        { size: "M", price: 25000, stock: 3 },
      ],
    } as GuidedCatalogueDto);
    expect(f.inbox.findOne).toHaveBeenCalledWith({
      where: { ownerId: "owner", id: "photo" },
      lock: { mode: "pessimistic_write" },
    });
    expect(f.products.save).toHaveBeenCalledWith(
      expect.objectContaining({
        stock: 5,
        currency: "TZS",
        variants: expect.arrayContaining([
          expect.objectContaining({ attributes: { size: "S" }, stock: 2 }),
        ]),
      }),
    );
    expect(f.item.status).toBe("PROCESSED");
  });
  it("reuses a confirmed photo after a lost response", async () => {
    const f = fixture({ status: "PROCESSED", entityId: "existing" });
    expect(
      await f.service.confirmGuided(
        "owner",
        "photo",
        input as GuidedCatalogueDto,
      ),
    ).toEqual({ itemId: "photo", entityId: "existing", duplicate: true });
    expect(f.products.save).not.toHaveBeenCalled();
  });
  it("refuses shop image storage on a remote database before upload", async () => {
    const f = fixture();
    f.db.options.host = "example.neon.tech";
    await expect(f.service.guidedUpload("owner", "shop", [])).rejects.toThrow(
      "shop server",
    );
    expect(f.db.transaction).not.toHaveBeenCalled();
  });
  it("rejects a photo assigned to another business type", async () => {
    const f = fixture({ metadata: { guidedBusinessType: "restaurant" } });
    await expect(
      f.service.confirmGuided("owner", "photo", input as GuidedCatalogueDto),
    ).rejects.toThrow("different setup");
  });
  it("rejects room count mismatches and existing room numbers", async () => {
    const f = fixture({ metadata: { guidedBusinessType: "hotel" } });
    const dto = {
      ...input,
      businessType: "hotel",
      capacity: 2,
      roomNumbers: ["101", "102"],
    } as GuidedCatalogueDto;
    await expect(
      f.service.confirmGuided("owner", "photo", dto),
    ).rejects.toThrow("quantity");
    f.rooms.count.mockResolvedValue(1);
    await expect(
      f.service.confirmGuided("owner", "photo", { ...dto, stock: 2 }),
    ).rejects.toThrow("already exists");
  });
  it("creates the individual hotel rooms atomically", async () => {
    const f = fixture({ metadata: { guidedBusinessType: "hotel" } });
    await f.service.confirmGuided("owner", "photo", {
      ...input,
      businessType: "hotel",
      stock: 2,
      capacity: 2,
      roomNumbers: ["101", "102"],
    } as GuidedCatalogueDto);
    expect(f.rooms.save).toHaveBeenCalledWith([
      expect.objectContaining({ roomNumber: "101", capacity: 2 }),
      expect.objectContaining({ roomNumber: "102" }),
    ]);
  });
});
