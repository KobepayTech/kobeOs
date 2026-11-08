import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import GuidedBusinessSetup from "./GuidedBusinessSetup";
import { api, listingApi } from "@/lib/api";
import { openPhotoIntake } from "@/lib/guided-setup";
vi.mock("@/os/registry", () => ({ appCatalogue: [] }));
vi.mock("@/os/bundle-install", () => ({
  installBundles: vi.fn(async () => ({ failed: [], modules: [] })),
}));
vi.mock("@/os/module-installer", () => ({ installBundledModule: vi.fn() }));
vi.mock("@/lib/appMarketplace", () => ({
  installMarketplaceApp: vi.fn(),
  listAppEntitlements: vi.fn(async () => []),
}));
vi.mock("@/os/store", () => ({
  useOSStore: { getState: () => ({ setAppEntitlements: vi.fn() }) },
}));
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  listingApi: vi.fn(),
  listingAssetUrl: (s: string) => s,
  getToken: () => "token",
  assetUrl: (s: string) => s,
  apiObject: (v: unknown) => v,
  apiArray: (v: unknown) => (Array.isArray(v) ? v : []),
}));
vi.mock("@/lib/compress-image", () => ({
  compressImage: async (file: File) => file,
}));
const profile = {
  businessType: "shop",
  businessName: "Kobe shop",
  location: "Dar es Salaam",
  phone: "0700000000",
  currency: "TZS",
  language: "English",
  timezone: "Africa/Dar_es_Salaam",
};
const photo = (id: string) => ({
  id,
  url: "/photo",
  originalName: `${id}.jpg`,
  status: "UNPROCESSED",
  metadata: { guidedBusinessType: "shop" },
  aiSuggestions: { name: id, category: "Clothes" },
});
beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(api).mockReset();
  vi.mocked(listingApi).mockReset();
});
afterEach(cleanup);
function setup(photos: unknown[] = []) {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/onboarding/guided") return profile as never;
    if (path === "/media/inbox") return photos as never;
    if (path === "/ai/agents") return [] as never;
    if (path.endsWith("/confirm"))
      return { entityId: "saved-product", name: "Jeans" } as never;
    return {} as never;
  });
  render(<GuidedBusinessSetup />);
}
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function prepareWorkspace() {
  await screen.findByRole("dialog");
  fill("Name or nickname", "Steve");
  next();
  fireEvent.click(screen.getByLabelText("A username or nickname"));
  next();
  fill("Document name (optional)", "KobeTech");
  next();
  fill(/Employees/, "50");
  next();
  expect(screen.getByRole("button", { name: "Hotel / Lala" })).toBeTruthy();
  next();
  expect(screen.getByText(/With 50 employees/)).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Explain" })[0]);
  expect(screen.getByText(/Shop floor, stock/)).toBeTruthy();
  next();
  fireEvent.click(screen.getByRole("button", { name: /Prepare my workspace/ }));
  const upload = await screen.findByLabelText("Bulk upload photos");
  await waitFor(() => expect(upload).toBeEnabled());
}

function answerPhotoWithVariant() {
  expect(screen.queryByLabelText(/regular price/)).toBeNull();
  fill(/What item is in this photo/, "Jeans");
  next();
  expect(screen.getByLabelText(/regular price/)).toHaveValue(null);
  fill(/regular price/, "60000");
  next();
  fill(/asks for a discount/, "55000");
  next();
  fill("Buying currency", "CNY");
  fill("Buying price per unit", "30");
  fill("TZS per 1 CNY", "360");
  fill("Transport per unit (TZS)", "1200");
  next();
  fill(/Which category/, "Clothes");
  next();
  fireEvent.click(
    screen.getByRole("button", { name: /Add colour or size SKU/ }),
  );
  fill("Colour · SKU 1", "Blue");
  fill("Size · SKU 1", "32");
  fill("Stock · SKU 1", "7");
  next();
}

describe("AI business setup", () => {
  it("can be postponed from the welcome question", async () => {
    setup();
    await screen.findByLabelText("Name or nickname");
    fireEvent.click(
      screen.getByRole("button", { name: "Continue setup later" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "AI business setup" }),
    ).toBeTruthy();
  });

  it("saves separate names and advances to the next photo after recording the discount and variant", async () => {
    setup([photo("shirt"), photo("trousers")]);
    await prepareWorkspace();
    expect(api).toHaveBeenCalledWith(
      "/onboarding/guided",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"documentName":"KobeTech"'),
      }),
    );
    await screen.findByAltText("shirt.jpg");
    answerPhotoWithVariant();
    fireEvent.click(screen.getByRole("button", { name: /Save & next photo/ }));
    await screen.findByAltText("trousers.jpg");
    const call = vi
      .mocked(api)
      .mock.calls.find(
        ([path]) => path === "/media/inbox/guided/shirt/confirm",
      );
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      price: 60000,
      purchaseCost: { unitPrice: 30, currency: "CNY", exchangeRate: 360, transportPerUnit: 1200 },
      discountPrice: 55000,
      stock: 7,
      variants: [{ color: "Blue", size: "32", price: 60000, stock: 7 }],
    });
  });

  it("adds the next image as another colour without repeating the price questions", async () => {
    setup([photo("shirt"), photo("trousers")]);
    await prepareWorkspace();
    answerPhotoWithVariant();
    fireEvent.click(screen.getByRole("button", { name: /Save & next photo/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Same product, another colour/,
      }),
    );
    expect(screen.queryByLabelText(/regular price/)).toBeNull();
    fill("New colour", "Black");
    fill("Size (optional)", "32");
    fill("Stock for this colour and size", "4");
    fireEvent.click(
      screen.getByRole("button", { name: /Save colour & next photo/ }),
    );
    expect(await screen.findByText("Added Black to Jeans.")).toBeTruthy();
    const attach = vi
      .mocked(api)
      .mock.calls.find(
        ([path]) => path === "/media/inbox/guided/trousers/confirm",
      );
    expect(JSON.parse(String(attach?.[1]?.body))).toMatchObject({
      relatedEntityId: "saved-product",
      color: "Black",
      size: "32",
      stock: 4,
    });
  });

  it("keeps a failed confirmation on the current photo for retry", async () => {
    setup([photo("shirt")]);
    await prepareWorkspace();
    answerPhotoWithVariant();
    vi.mocked(api).mockRejectedValueOnce(new Error("Connection lost"));
    fireEvent.click(screen.getByRole("button", { name: /Save & next photo/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost",
    );
    expect(screen.getByAltText("shirt.jpg")).toBeTruthy();
    expect(screen.getByText(/Blue \/ 32/)).toHaveTextContent("7 in stock");
  });

  it("waits for all 60 uploads before asking about the first photo", async () => {
    const photos: unknown[] = [];
    setup(photos);
    await prepareWorkspace();
    const apiMock = vi.mocked(api);
    let uploads = 0;
    let finishLast = () => {};
    const lastUpload = new Promise<void>((resolve) => {
      finishLast = resolve;
    });
    apiMock.mockImplementation(async (path) => {
      if (path.startsWith("/media/inbox/guided/upload")) {
        uploads += 1;
        if (uploads === 12) await lastUpload;
        return [] as never;
      }
      return photos as never;
    });
    const files = Array.from(
      { length: 60 },
      (_, i) => new File(["photo"], `product-${i}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(screen.getByLabelText("Bulk upload photos"), {
      target: { files },
    });
    await waitFor(() => expect(uploads).toBe(12));
    expect(screen.queryByLabelText(/What item is in this photo/)).toBeNull();
    photos.push(...Array.from({ length: 60 }, (_, i) => photo(`product-${i}`)));
    finishLast();
    expect(
      await screen.findByLabelText(/What item is in this photo/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Steve, your 60 photos finished uploading/),
    ).toBeTruthy();
  });

  it("opens the online property interview from Properties and previews before publishing", async () => {
    vi.mocked(listingApi).mockImplementation(async (path) =>
      path === "/media/inbox"
        ? ([
            {
              ...photo("apartment"),
              metadata: { guidedBusinessType: "property" },
            },
          ] as never)
        : ({ entityId: "listing", name: "Mbezi apartment" } as never),
    );
    setup();
    await screen.findByRole("dialog");
    act(() => openPhotoIntake("property"));
    await screen.findByText("What space are you listing?");
    fill("Property type", "Apartment");
    fill("Listing title", "Mbezi apartment");
    fill("Neighbourhood and city", "Mbezi Beach");
    next();
    fill(/Monthly rent/, "800000");
    fill(/Bedrooms/, "2");
    next();
    next();
    expect(screen.getByText("Preview before publishing")).toBeTruthy();
    expect(
      vi
        .mocked(listingApi)
        .mock.calls.some(([path]) => path.endsWith("/confirm")),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));
    expect(await screen.findByText("Published Mbezi apartment.")).toBeTruthy();
    const published = vi
      .mocked(listingApi)
      .mock.calls.find(
        ([path]) => path === "/media/inbox/guided/apartment/confirm",
      );
    expect(JSON.parse(String(published?.[1]?.body))).toMatchObject({
      currency: "TZS",
      property: { offer: "RENT", bedrooms: 2, price: 800000, published: true },
    });
  });

  it("creates only the selected agents on the chosen timezone", async () => {
    setup();
    await prepareWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Set up my agents/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Schedule selected agents/ }),
    );
    await waitFor(() =>
      expect(screen.getByText("Kobe shop is ready")).toBeTruthy(),
    );
    const calls = vi
      .mocked(api)
      .mock.calls.filter(
        ([path, options]) =>
          path === "/ai/agents" && options?.method === "POST",
      );
    expect(calls).toHaveLength(2);
    expect(JSON.parse(String(calls[0][1]?.body))).toMatchObject({
      timezone: "Africa/Dar_es_Salaam",
      allowedTools: [],
      frequency: "DAILY",
      outputDestination: "KOBEOS_INBOX",
    });
  });
});
