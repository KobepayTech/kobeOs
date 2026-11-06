import { useOSStore } from "@/os/store";
import { useEffect, useState } from "react";
import { Sparkles, X, ArrowRight, Upload, Check, Loader2 } from "lucide-react";
import { api, apiArray, apiObject, assetUrl, getToken } from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import {
  BUSINESS_GUIDES,
  type SetupProfile,
  type BusinessType,
} from "@/lib/guided-setup";
import { installBundles } from "@/os/bundle-install";
import { appCatalogue } from "@/os/registry";
import {
  installMarketplaceApp,
  listAppEntitlements,
} from "@/lib/appMarketplace";
import { installBundledModule } from "@/os/module-installer";

interface Photo {
  id: string;
  url: string;
  originalName: string;
  status: string;
  metadata: Record<string, unknown>;
  aiSuggestions: Record<string, unknown>;
}
interface Variant {
  size: string;
  price: string;
  stock: string;
}
interface Details {
  name: string;
  category: string;
  price: string;
  stock: string;
  size: string;
  roomNumbers: string;
  capacity: string;
  variants: Variant[];
}
const empty: Details = {
  name: "",
  category: "",
  price: "",
  stock: "",
  size: "",
  roomNumbers: "",
  capacity: "",
  variants: [],
};
const defaults: SetupProfile = {
  businessType: "shop",
  businessName: "",
  location: "",
  phone: "",
  language: "English",
  currency: "TZS",
  timezone: "Africa/Dar_es_Salaam",
};
const request = async (path: string, method = "GET", data?: unknown) =>
  api<unknown>(path, {
    method,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    offlineFallback: false,
  });
const control =
  "mt-1 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-white";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40";

export default function GuidedBusinessSetup() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<SetupProfile>(defaults);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<Details>(empty);
  const [selectedAgents, setSelectedAgents] = useState([
    "operations",
    "summary",
  ]);
  const [time, setTime] = useState("18:00");
  const guide = BUSINESS_GUIDES[profile.businessType];
  const photo = photos[index];

  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    request("/onboarding/guided")
      .then((r) => {
        if (!alive) return;
        const saved = apiObject<SetupProfile>(r);
        if (saved?.businessType) setProfile(saved);
        // Offer setup on first authenticated launch without blocking the desktop.
        if (!saved?.completed && !sessionStorage.getItem("kobe-guided-later"))
          setOpen(true);
      })
      .catch(() => {
        /* The desktop remains usable while the server is offline. */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setDetails(
      photo
        ? {
            ...empty,
            ...(photo.metadata as Partial<Details>),
            name: String(
              photo.metadata.name ||
                photo.aiSuggestions.name ||
                photo.originalName.replace(/\.[^.]+$/, ""),
            ),
            category: String(
              photo.metadata.category || photo.aiSuggestions.category || "",
            ),
          }
        : empty,
    );
  }, [photo?.id]);

  useEffect(() => {
    if (!photo || photo.aiSuggestions.name) return;
    let active = true;
    request("/media/inbox/suggest", "POST", {
      itemIds: [photo.id],
      moduleId: profile.businessType === "shop" ? "erp" : "hotel",
    })
      .then((r) => {
        if (!active) return;
        const suggestion = apiArray<{ suggestions: Record<string, unknown> }>(
          r,
        )[0]?.suggestions;
        if (!suggestion) return;
        setDetails((d) => ({
          ...d,
          name:
            d.name === photo.originalName.replace(/\.[^.]+$/, "")
              ? String(suggestion.name || d.name)
              : d.name,
          category: d.category || String(suggestion.category || ""),
        }));
      })
      .catch(() => {
        /* Manual entry stays available when AI is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [photo?.id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const loadPhotos = async () => {
    const all = apiArray<Photo>(await request("/media/inbox"));
    const pending = all.filter(
      (p) =>
        p.metadata.guidedBusinessType === profile.businessType &&
        ["UNPROCESSED", "FAILED"].includes(p.status),
    );
    setPhotos(pending);
    setIndex(0);
  };
  const saveProfile = async () => {
    await request("/onboarding/guided", "PUT", {
      ...profile,
      completed: false,
    });
    await request("/store-settings", "PUT", {
      storeName: profile.businessName,
    });
    if (profile.businessType !== "shop") {
      const existing = apiObject<{ slug: string }>(
        await request("/hotel/tenant"),
      );
      const payload = {
        name: profile.businessName,
        location: profile.location,
        phone: profile.phone,
        currency: profile.currency,
      };
      if (existing?.slug) await request("/hotel/tenant", "PATCH", payload);
      else {
        // Stable per-account suffix avoids collisions and remains unchanged on retries.
        const user = JSON.parse(
          localStorage.getItem("kobeos_auth_user") || "{}",
        ) as { id?: string };
        if (!user.id)
          throw new Error("Sign in again to create your business profile.");
        const slug = `${
          profile.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 22)
            .replace(/^-|-$/g, "") || "business"
        }-${user.id.replace(/-/g, "").slice(0, 12)}`;
        await request("/hotel/tenant", "POST", { ...payload, slug });
      }
    }
    const result = await installBundles(
      [guide.bundle],
      appCatalogue,
      {
        entitle: async (id) => {
          await installMarketplaceApp(id);
        },
        installApp: async (app) => {
          await installBundledModule(app, (p) => setNotice(p.message));
        },
      },
      (p) => setNotice(p.message),
    );
    if (result.failed.length)
      throw new Error(
        result.modules
          .filter((m) => m.status === "failed")
          .map((m) => `${m.name}: ${m.error}`)
          .join("; "),
      );
    useOSStore.getState().setAppEntitlements(await listAppEntitlements());
    await loadPhotos();
    setStep(1);
    setNotice(
      "Your business workspace is ready. Add photos now or continue to agents.",
    );
  };
  const upload = async (files: File[]) => {
    if (!files.length) return;
    if (files.some((f) => !f.type.startsWith("image/")))
      throw new Error("Please select images only.");
    for (let offset = 0; offset < files.length; offset += 5) {
      const form = new FormData();
      for (const file of files.slice(offset, offset + 5))
        form.append("files", await compressImage(file));
      await api(
        `/media/inbox/guided/upload?businessType=${profile.businessType}`,
        { method: "POST", body: form, offlineFallback: false },
      );
      setNotice(
        `Uploaded ${Math.min(offset + 5, files.length)} of ${files.length} photos`,
      );
    }
    await loadPhotos();
  };
  const suggest = async () => {
    const result = apiArray<{ suggestions: Record<string, unknown> }>(
      await request("/media/inbox/suggest", "POST", {
        itemIds: [photo.id],
        moduleId: profile.businessType === "shop" ? "erp" : "hotel",
      }),
    );
    const suggestion = result[0]?.suggestions;
    if (suggestion)
      setDetails((d) => ({
        ...d,
        name: String(suggestion.name || d.name),
        category: String(suggestion.category || d.category),
      }));
    setNotice(
      "Check the suggested name and category. Please confirm the price and quantity yourself.",
    );
  };
  const confirm = async () => {
    if (!String(details.price).trim() || !String(details.stock).trim())
      throw new Error(
        "Enter the price and quantity, including 0 when appropriate.",
      );
    if (
      profile.businessType === "hotel" &&
      Number(details.stock) !==
        details.roomNumbers
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean).length
    )
      throw new Error("The room quantity must match the room numbers entered.");
    const payload = {
      businessType: profile.businessType,
      name: details.name,
      category: details.category,
      size: details.size,
      price: Number(details.price),
      stock: Number(details.stock),
      ...(profile.businessType === "hotel"
        ? {
            roomNumbers: details.roomNumbers
              .split(",")
              .map((n) => n.trim())
              .filter(Boolean),
            capacity: Number(details.capacity),
          }
        : {}),
      variants: details.variants.map((v) => {
        if (!v.size.trim() || !v.price.trim() || !v.stock.trim())
          throw new Error("Enter a size, price, and stock for each variant.");
        return { size: v.size, price: Number(v.price), stock: Number(v.stock) };
      }),
    };
    await request(`/media/inbox/guided/${photo.id}/confirm`, "POST", payload);
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    setIndex(0);
    setNotice(`Saved ${details.name}. Ready for the next photo.`);
  };
  const createAgents = async () => {
    const existing = apiArray<{ name: string }>(await request("/ai/agents"));
    for (const key of selectedAgents) {
      const name =
        key === "operations"
          ? `Setup · ${guide.label} operations`
          : "Setup · Daily business summary";
      if (existing.some((a) => a.name === name)) continue;
      await request("/ai/agents", "POST", {
        name,
        objective: `${key === "operations" ? guide.objective : "Prepare a daily business summary with sales, outstanding issues, and suggested next steps. Do not invent missing data."} Business: ${profile.businessName}. Location: ${profile.location}. Respond in ${profile.language}. Currency: ${profile.currency}.`,
        frequency: "DAILY",
        timeOfDay: time,
        timezone: profile.timezone,
        allowedModules: [...guide.modules],
        allowedTools: [],
        approvalMode: "DRAFT_ONLY",
        outputDestination: "KOBEOS_INBOX",
        enabled: true,
      });
    }
    setStep(3);
    setNotice(
      "Selected agents are scheduled. Their reports will appear in your KobeOS inbox.",
    );
  };
  const field = (
    label: string,
    key: keyof Omit<Details, "variants">,
    type = "text",
  ) => (
    <label className="block text-sm text-slate-300">
      {label}
      <input
        className={control}
        type={type}
        step={key === "price" ? "any" : "1"}
        value={details[key]}
        min={type === "number" ? 0 : undefined}
        onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))}
        required
      />
    </label>
  );
  const close = () => {
    sessionStorage.setItem("kobe-guided-later", "1");
    setOpen(false);
  };

  return (
    <>
      <button
        className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm text-emerald-300 shadow-xl"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={18} /> AI business setup
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-title"
            className="max-h-[94vh] w-full max-w-4xl overflow-auto rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-700 p-5">
              <div>
                <p className="text-xs uppercase tracking-[.2em] text-emerald-300">
                  Kobe AI · Your business starts here
                </p>
                <h2 id="guided-title" className="mt-1 text-2xl font-semibold">
                  Let’s set up together
                </h2>
              </div>
              <button
                aria-label="Continue setup later"
                disabled={busy}
                onClick={close}
              >
                <X />
              </button>
            </header>
            <div className="flex flex-wrap gap-3 border-b border-slate-700 px-5 py-3 text-sm">
              {[
                "Your business",
                "Photos to inventory",
                "Agents & automations",
                "Ready",
              ].map((label, i) => (
                <span
                  key={label}
                  className={step === i ? "text-emerald-300" : "text-slate-400"}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>
            <div className="space-y-5 p-5 sm:p-8">
              {step === 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(saveProfile);
                  }}
                  className="space-y-5"
                >
                  <p className="text-slate-300">
                    Tell me about your business. I’ll prepare the right
                    workspace, then help you add your first items and choose
                    your agents.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(Object.keys(BUSINESS_GUIDES) as BusinessType[]).map(
                      (type) => (
                        <button
                          type="button"
                          key={type}
                          onClick={() =>
                            setProfile((p) => ({ ...p, businessType: type }))
                          }
                          className={`rounded-2xl border p-5 text-left ${profile.businessType === type ? "border-emerald-400 bg-emerald-400/10" : "border-slate-600"}`}
                        >
                          {BUSINESS_GUIDES[type].label}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        "businessName",
                        "location",
                        "phone",
                        "currency",
                        "timezone",
                      ] as const
                    ).map((key) => (
                      <label key={key} className="text-sm text-slate-300">
                        {
                          {
                            businessName: "What is your business called?",
                            location: "Where is it located?",
                            phone: "Business phone number",
                            currency: "Currency code",
                            timezone: "Business timezone",
                          }[key]
                        }
                        <input
                          className={control}
                          required
                          maxLength={
                            key === "businessName"
                              ? 120
                              : key === "phone"
                                ? 40
                                : key === "currency"
                                  ? 3
                                  : 160
                          }
                          value={profile[key]}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, [key]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                    <label className="text-sm text-slate-300">
                      Which language should your agents use?
                      <select
                        className={control}
                        value={profile.language}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            language: e.target.value,
                          }))
                        }
                      >
                        <option>English</option>
                        <option>Kiswahili</option>
                      </select>
                    </label>
                  </div>
                  <p className="text-sm text-slate-400">
                    Recommended workspace: {guide.bundle}. Your current App
                    Store access and subscription terms apply.
                  </p>
                  <button className={button} disabled={busy}>
                    Prepare my workspace <ArrowRight size={18} />
                  </button>
                </form>
              )}
              {step === 1 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl">
                        Turn your photos into {guide.noun}s
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Upload a batch. We’ll work through each photo together.
                        You can return later.
                      </p>
                    </div>
                    <label className={`${button} cursor-pointer`}>
                      <Upload size={18} /> Add photos
                      <input
                        aria-label="Bulk upload photos"
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={busy}
                        className="sr-only"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          e.target.value = "";
                          void run(() => upload(files));
                        }}
                      />
                    </label>
                  </div>
                  {photo ? (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <img
                          src={assetUrl(photo.url)}
                          alt={photo.originalName}
                          className="h-72 w-full rounded-2xl bg-slate-800 object-contain"
                        />
                        <p className="mt-2 text-sm text-slate-400">
                          {index + 1} of {photos.length} waiting ·{" "}
                          {photo.originalName}
                        </p>
                        <button
                          disabled={busy}
                          onClick={() => run(suggest)}
                          className="mt-3 rounded-xl border border-emerald-400/50 px-4 py-2 text-emerald-300"
                        >
                          <Sparkles className="mr-2 inline" size={16} /> Suggest
                          from photo
                        </button>
                      </div>
                      <form
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run(confirm);
                        }}
                      >
                        <p className="text-emerald-200">{guide.question}</p>
                        {field(
                          profile.businessType === "hotel"
                            ? "Room type"
                            : "Name",
                          "name",
                        )}
                        {field("Category", "category")}
                        <div className="grid grid-cols-2 gap-3">
                          {field(
                            `${profile.businessType === "hotel" ? "Nightly rate" : "Price"} (${profile.currency})`,
                            "price",
                            "number",
                          )}
                          {field(
                            profile.businessType === "hotel"
                              ? "Number of rooms in this photo group"
                              : profile.businessType === "restaurant"
                                ? "Portions available today"
                                : "Stock quantity",
                            "stock",
                            "number",
                          )}
                        </div>
                        {profile.businessType === "hotel" ? (
                          <>
                            {field(
                              "Room numbers, separated by commas",
                              "roomNumbers",
                            )}
                            {field("Guests per room", "capacity", "number")}
                          </>
                        ) : (
                          field(
                            profile.businessType === "shop"
                              ? "Size / unit (use Standard if none)"
                              : "Portion size",
                            "size",
                          )
                        )}
                        {profile.businessType === "shop" && (
                          <div className="space-y-2">
                            {details.variants.map((v, i) => (
                              <div
                                key={i}
                                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2"
                              >
                                {(["size", "price", "stock"] as const).map(
                                  (k) => (
                                    <input
                                      key={k}
                                      aria-label={`Variant ${i + 1} ${k}`}
                                      placeholder={k}
                                      required
                                      min={k === "size" ? undefined : 0}
                                      type={k === "size" ? "text" : "number"}
                                      className={control}
                                      value={v[k]}
                                      onChange={(e) =>
                                        setDetails((d) => ({
                                          ...d,
                                          variants: d.variants.map((row, j) =>
                                            j === i
                                              ? { ...row, [k]: e.target.value }
                                              : row,
                                          ),
                                        }))
                                      }
                                    />
                                  ),
                                )}
                                <button
                                  type="button"
                                  aria-label="Remove size"
                                  onClick={() =>
                                    setDetails((d) => ({
                                      ...d,
                                      variants: d.variants.filter(
                                        (_, j) => j !== i,
                                      ),
                                    }))
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setDetails((d) => ({
                                  ...d,
                                  variants: [
                                    ...d.variants,
                                    { size: "", price: d.price, stock: "" },
                                  ],
                                }))
                              }
                              className="text-sm text-emerald-300"
                            >
                              + Add sizes with individual prices and stock
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button disabled={busy} className={button}>
                            Confirm & next <Check size={18} />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await request(
                                  `/media/inbox/${photo.id}`,
                                  "PATCH",
                                  { metadata: details },
                                );
                                setPhotos((p) =>
                                  p.map((x) =>
                                    x.id === photo.id
                                      ? {
                                          ...x,
                                          metadata: {
                                            ...x.metadata,
                                            ...details,
                                          },
                                        }
                                      : x,
                                  ),
                                );
                                setIndex((i) => (i + 1) % photos.length);
                              })
                            }
                            className="px-3 text-sm"
                          >
                            Skip for now
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-600 p-12 text-center text-slate-300">
                      No photos waiting. Add a batch to begin, or set up your
                      agents.
                    </div>
                  )}
                  <div className="flex justify-between">
                    <button disabled={busy} onClick={() => setStep(0)}>
                      Back
                    </button>
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => setStep(2)}
                    >
                      Set up my agents <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <h3 className="text-xl">What should AI handle each day?</h3>
                  <p className="text-slate-300">
                    Choose your scheduled agents. Reports and suggested actions
                    will appear in your inbox. You can change schedules in Kobe
                    AI.
                  </p>
                  {[
                    [
                      "operations",
                      `${guide.label} operations`,
                      guide.objective,
                    ],
                    [
                      "summary",
                      "Daily business summary",
                      "Sales, outstanding issues, and next steps in one daily report.",
                    ],
                  ].map(([id, title, description]) => (
                    <label
                      key={id}
                      className="flex gap-3 rounded-2xl border border-slate-600 p-5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(id)}
                        onChange={(e) =>
                          setSelectedAgents((a) =>
                            e.target.checked
                              ? [...a, id]
                              : a.filter((x) => x !== id),
                          )
                        }
                      />
                      <div>
                        <p className="font-semibold">{title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {description}
                        </p>
                      </div>
                    </label>
                  ))}
                  <label className="block max-w-xs text-sm">
                    What time should they run? ({profile.timezone})
                    <input
                      type="time"
                      required
                      className={control}
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </label>
                  <div className="flex justify-between">
                    <button disabled={busy} onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button
                      disabled={busy || !time}
                      onClick={() => run(createAgents)}
                      className={button}
                    >
                      {selectedAgents.length
                        ? "Schedule selected agents"
                        : "Continue without agents"}{" "}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="rounded-2xl bg-emerald-400/10 p-7">
                    <Check className="mb-3 text-emerald-300" size={32} />
                    <h3 className="text-2xl">
                      {profile.businessName} is ready
                    </h3>
                    <p className="mt-3 text-slate-300">
                      Your business settings are saved. Confirmed photos are in
                      your inventory, rooms, or menu. You can reopen this guide
                      whenever you add another batch.
                    </p>
                    {profile.businessType === "restaurant" && (
                      <p className="mt-3 text-sm text-slate-400">
                        Portion quantity records today’s setup availability.
                        Ingredient recipes and stock deductions are configured
                        in the restaurant inventory tools.
                      </p>
                    )}
                    {photos.length > 0 && (
                      <p className="mt-3 text-amber-300">
                        {photos.length} photos are waiting for your review.
                      </p>
                    )}
                  </div>
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      run(async () => {
                        await request("/onboarding/guided", "PUT", {
                          ...profile,
                          completed: true,
                        });
                        setProfile((p) => ({ ...p, completed: true }));
                        close();
                      })
                    }
                  >
                    Open my workspace <ArrowRight size={18} />
                  </button>
                  <button
                    disabled={busy}
                    className="ml-4 text-sm"
                    onClick={() => setStep(1)}
                  >
                    Review more photos
                  </button>
                </>
              )}
              {busy && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-emerald-300"
                >
                  <Loader2 className="animate-spin" size={18} />{" "}
                  {notice || "Working on your setup…"}
                </p>
              )}
              {!busy && notice && (
                <p role="status" className="text-sm text-emerald-300">
                  {notice}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-400/10 p-4 text-red-200"
                >
                  {error}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
