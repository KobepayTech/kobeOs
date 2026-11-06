import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import GuidedBusinessSetup from "./GuidedBusinessSetup";
import { api } from "@/lib/api";
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
  getToken: () => "token",
  assetUrl: (s: string) => s,
  apiObject: (v: unknown) => v,
  apiArray: (v: unknown) => (Array.isArray(v) ? v : []),
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
});
afterEach(cleanup);
function setup(photos: unknown[] = []) {
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === "/onboarding/guided") return profile as never;
    if (path === "/media/inbox") return photos as never;
    if (path === "/ai/agents") return [] as never;
    return {} as never;
  });
  render(<GuidedBusinessSetup />);
}
describe("AI business setup", () => {
  it("offers the three business guides and can be postponed", async () => {
    setup();
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Hotel / Lala" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restaurant" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue setup later" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "AI business setup" }),
    ).toBeTruthy();
  });
  it("confirms one photo and advances to the next without inventing price or stock", async () => {
    setup([photo("shirt"), photo("trousers")]);
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: /Prepare my workspace/ }),
    );
    await screen.findByAltText("shirt.jpg");
    expect(screen.getByLabelText("Price (TZS)")).toHaveValue(null);
    fireEvent.change(screen.getByLabelText("Price (TZS)"), {
      target: { value: "25000" },
    });
    fireEvent.change(screen.getByLabelText("Stock quantity"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Size / unit (use Standard if none)"), { target: { value: "Standard" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm & next/ }));
    await screen.findByAltText("trousers.jpg");
    expect(api).toHaveBeenCalledWith(
      "/media/inbox/guided/shirt/confirm",
      expect.objectContaining({
        body: expect.stringContaining('"stock":7'),
        offlineFallback: false,
      }),
    );
  });
  it("keeps a failed confirmation on the current photo for retry", async () => {
    setup([photo("shirt")]);
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: /Prepare my workspace/ }),
    );
    await screen.findByAltText("shirt.jpg");
    vi.mocked(api).mockRejectedValueOnce(new Error("Connection lost"));
    fireEvent.change(screen.getByLabelText("Price (TZS)"), {
      target: { value: "25000" },
    });
    fireEvent.change(screen.getByLabelText("Stock quantity"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Size / unit (use Standard if none)"), { target: { value: "Standard" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm & next/ }));
    await screen.findByRole("alert");
    expect(screen.getByAltText("shirt.jpg")).toBeTruthy();
    expect(screen.getByLabelText("Stock quantity")).toHaveValue(7);
  });
  it("creates only the selected agents on the chosen timezone", async () => {
    setup();
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: /Prepare my workspace/ }),
    );
    await screen.findByRole("button", { name: /Set up my agents/ });
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
