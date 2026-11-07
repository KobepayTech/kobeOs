import { useOSStore } from "@/os/store";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, X, ArrowRight, Upload, Check, Loader2 } from "lucide-react";
import {
  api,
  apiArray,
  apiObject,
  assetUrl,
  getToken,
  listingApi,
  listingAssetUrl,
} from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import {
  BUSINESS_GUIDES,
  type SetupProfile,
  DEFAULT_SETUP,
  LISTING_SAVED,
  OPEN_PHOTO_INTAKE,
  type BusinessType,
  type PhotoIntakeRequest,
} from "@/lib/guided-setup";
import { installBundles } from "@/os/bundle-install";
import { appCatalogue } from "@/os/registry";
import {
  installMarketplaceApp,
  listAppEntitlements,
} from "@/lib/appMarketplace";
import { installBundledModule } from "@/os/module-installer";
import ListingInterview from "./ListingInterview";
import BusinessSetupInterview from "./BusinessSetupInterview";
import PhotoIntakeInterview, {
  EMPTY_PHOTO_ANSWERS,
  type PhotoAnswers,
} from "./PhotoIntakeInterview";

interface Photo {
  id: string;
  url: string;
  originalName: string;
  createdAt?: string;
  status: string;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  aiSuggestions: Record<string, unknown>;
}
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

export default function GuidedBusinessSetup({
  firstRun = false,
  onComplete,
  onDefer,
}: {
  firstRun?: boolean;
  onComplete?: () => void;
  onDefer?: () => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<SetupProfile>(DEFAULT_SETUP);
  const [step, setStep] = useState(0);
  const [hasInstallAnswers, setHasInstallAnswers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [standalone, setStandalone] = useState<PhotoIntakeRequest | null>(null);
  const [previous, setPrevious] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [attach, setAttach] = useState(false);
  const [details, setDetails] = useState<PhotoAnswers>(EMPTY_PHOTO_ANSWERS);
  const [selectedAgents, setSelectedAgents] = useState([
    "operations",
    "summary",
  ]);
  const [time, setTime] = useState("18:00");
  const businessType = standalone?.type ?? profile.businessType;
  const guide = BUSINESS_GUIDES[businessType];
  const listingType =
    businessType === "dealership" || businessType === "property"
      ? businessType
      : null;
  const photo = photos[index];

  useEffect(() => {
    if (!getToken()) {
      if (firstRun) setOpen(true);
      return;
    }
    let alive = true;
    request("/onboarding/guided")
      .then(async (r) => {
        if (!alive) return;
        const saved = apiObject<SetupProfile>(r);
        if (saved?.businessType) {
          setProfile(saved);
          // An account setup already saved to the server takes precedence.
          await window.kobeOS?.system?.clearInstallSetup?.();
          if (!alive) return;
        } else {
          const installed = await window.kobeOS?.system?.readInstallSetup?.();
          if (!alive) return;
          if (
            installed?.businessType &&
            installed.businessType in BUSINESS_GUIDES
          ) {
            setProfile({ ...DEFAULT_SETUP, ...installed });
            setHasInstallAnswers(true);
          }
        }
        // Offer setup on first authenticated launch without blocking the desktop.
        if (
          firstRun ||
          (!saved?.completed && !sessionStorage.getItem("kobe-guided-later"))
        )
          setOpen(true);
      })
      .catch(() => {
        if (alive && firstRun) setOpen(true);
      });
    return () => {
      alive = false;
    };
  }, [firstRun]);

  useEffect(() => {
    setAttach(false);
    setDetails(
      photo
        ? {
            ...EMPTY_PHOTO_ANSWERS,
            ...(photo.metadata as Partial<PhotoAnswers>),
            name: String(
              photo.metadata.name ||
                photo.aiSuggestions.name ||
                photo.originalName.replace(/\.[^.]+$/, ""),
            ),
            category: String(
              photo.metadata.category || photo.aiSuggestions.category || "",
            ),
          }
        : EMPTY_PHOTO_ANSWERS,
    );
  }, [photo]);

  useEffect(() => {
    if (
      !open ||
      step !== 1 ||
      !photo ||
      listingType ||
      photo.aiSuggestions.name
    )
      return;
    let active = true;
    request("/media/inbox/suggest", "POST", {
      itemIds: [photo.id],
      moduleId: businessType === "shop" ? "erp" : "hotel",
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
  }, [open, step, photo, businessType, listingType]);

  const run = useCallback(async (fn: () => Promise<void>) => {
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
  }, []);
  const loadPhotos = useCallback(async (type: BusinessType) => {
    const online = type === "dealership" || type === "property";
    const all = apiArray<Photo>(
      await (online ? listingApi("/media/inbox") : request("/media/inbox")),
    );
    const pending = all
      .filter(
        (p) =>
          p.metadata.guidedBusinessType === type &&
          ["UNPROCESSED", "FAILED"].includes(p.status),
      )
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    setPhotos(pending);
    setTotalPhotos(pending.length);
    setIndex(0);
    const last = all.find(
      (p) =>
        p.status === "PROCESSED" &&
        p.entityId &&
        p.metadata.guidedBusinessType === type,
    );
    setPrevious(
      last?.entityId
        ? {
            id: last.entityId,
            name: String(last.metadata.name || last.originalName),
          }
        : null,
    );
  }, []);

  useEffect(() => {
    const openIntake = (event: Event) => {
      const intake = (event as CustomEvent<PhotoIntakeRequest>).detail;
      const type = intake?.type;
      if (type !== "property" && type !== "dealership") return;
      setStandalone(intake);
      setPhotos([]);
      setPrevious(null);
      setOpen(true);
      setStep(1);
      void run(() => loadPhotos(type));
    };
    window.addEventListener(OPEN_PHOTO_INTAKE, openIntake);
    return () => window.removeEventListener(OPEN_PHOTO_INTAKE, openIntake);
  }, [loadPhotos, run]);

  const saveProfile = async () => {
    const services = profile.services ?? [guide.bundle];
    await request("/onboarding/guided", "PUT", {
      ...profile,
      services,
      completed: false,
    });
    await request("/store-settings", "PUT", {
      storeName: profile.businessName,
    });
    if (
      profile.businessType === "hotel" ||
      profile.businessType === "restaurant"
    ) {
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
      services,
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
    if (hasInstallAnswers) await window.kobeOS?.system?.clearInstallSetup?.();
    setHasInstallAnswers(false);
    setProfile((p) => ({ ...p, services }));
    useOSStore.getState().setAppEntitlements(await listAppEntitlements());
    if (profile.businessType !== "other") await loadPhotos(businessType);
    setStep(profile.businessType === "other" ? 2 : 1);
    setNotice(
      profile.businessType === "other"
        ? "Your workspace is ready. Choose the agents you want to schedule."
        : "Your business workspace is ready. Add photos now or continue to agents.",
    );
  };
  const upload = async (files: File[]) => {
    if (!files.length) return;
    if (files.some((f) => !f.type.startsWith("image/")))
      throw new Error("Please select images only.");
    let uploaded = 0;
    try {
      for (let offset = 0; offset < files.length; offset += 5) {
        const form = new FormData();
        for (const file of files.slice(offset, offset + 5))
          form.append("files", await compressImage(file));
        const path = `/media/inbox/guided/upload?businessType=${businessType}`;
        if (listingType) await listingApi(path, { method: "POST", body: form });
        else
          await api(path, {
            method: "POST",
            body: form,
            offlineFallback: false,
          });
        uploaded = Math.min(offset + 5, files.length);
        setNotice(`Uploaded ${uploaded} of ${files.length} photos`);
      }
    } catch (error) {
      if (uploaded) await loadPhotos(businessType);
      throw error;
    }
    await loadPhotos(businessType);
    setNotice(
      `${profile.displayName ? `${profile.displayName}, your` : "Your"} ${uploaded} photos finished uploading. Let’s start with the first photo waiting for review.`,
    );
  };
  const suggest = async () => {
    const result = apiArray<{ suggestions: Record<string, unknown> }>(
      await request("/media/inbox/suggest", "POST", {
        itemIds: [photo.id],
        moduleId: businessType === "shop" ? "erp" : "hotel",
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
  const savePhoto = async (data: Record<string, unknown>, message?: string) => {
    const path = `/media/inbox/guided/${photo.id}/confirm`;
    const saved = apiObject<{ entityId: string; name?: string }>(
      await (listingType
        ? listingApi(path, {
            method: "POST",
            body: JSON.stringify({ ...data, currency: profile.currency }),
          })
        : request(path, "POST", data)),
    );

    if (saved?.entityId)
      setPrevious({
        id: saved.entityId,
        name: saved.name || String(data.name),
      });
    if (listingType)
      window.dispatchEvent(
        new CustomEvent(LISTING_SAVED, { detail: listingType }),
      );
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    setIndex(Math.max(0, Math.min(index, photos.length - 2)));
    setNotice(
      message ??
        `Saved ${saved?.name || data.name}.${photos.length === 1 ? " All photos reviewed." : " Here’s the next photo."}`,
    );
  };

  const saveListing = async (
    data: Record<string, unknown>,
    published: boolean,
  ) => {
    if (listingType === "dealership") {
      const businesses = apiArray(await listingApi("/commerce/businesses"));
      if (!businesses.length) {
        const name = standalone?.business?.name || profile.businessName.trim();
        if (!name)
          throw new Error(
            "Create a dealership in Commerce before publishing a vehicle.",
          );
        await listingApi("/commerce/businesses", {
          method: "POST",
          body: JSON.stringify({
            name,
            phone: standalone?.business?.phone || profile.phone,
          }),
        });
      }
    }
    const name =
      listingType === "dealership"
        ? `${data.year} ${data.make} ${data.model}`
        : String(data.title);
    return savePhoto(
      {
        businessType,
        name: name.slice(0, 120),
        category: listingType === "dealership" ? "Vehicle" : String(data.kind),
        price: data.price,
        size: "",
        stock: 0,
        ...(listingType === "dealership"
          ? { vehicle: data }
          : { property: data }),
      },
      published ? `Published ${name}.` : `Saved ${name} as a draft.`,
    );
  };

  const attachPhoto = () =>
    savePhoto(
      {
        businessType,
        relatedEntityId: previous?.id,
        name: (previous?.name || "").slice(0, 120),
        category: "",
        price: 0,
        stock: listingType ? 0 : Number(details.stock),
        size: listingType ? "" : details.size,
        color: listingType ? "" : details.color,
      },
      listingType
        ? `Added a photo to ${previous?.name}.`
        : `Added ${details.color} to ${previous?.name}.`,
    );

  const confirm = async () => {
    const roomNumbers = details.roomNumbers
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const variants = details.variants.map((v) => ({
      size: v.size.trim(),
      color: v.color?.trim(),
      price: Number(v.price),
      stock: Number(v.stock),
    }));
    const stock =
      profile.businessType === "hotel"
        ? roomNumbers.length
        : variants.length
          ? variants.reduce((sum, v) => sum + v.stock, 0)
          : Number(details.stock);
    await savePhoto({
      businessType,
      name: details.name.trim(),
      category: details.category.trim(),
      size: details.size.trim(),
      color: details.color.trim(),
      price: Number(details.price),
      discountPrice:
        details.discountPrice === ""
          ? undefined
          : Number(details.discountPrice),
      stock,
      ...(profile.businessType === "hotel"
        ? { roomNumbers, capacity: Number(details.capacity) }
        : {}),
      variants,
    });
  };
  const skipPhoto = async () => {
    if (!listingType)
      await request(`/media/inbox/${photo.id}`, "PATCH", { metadata: details });
    setPhotos((p) =>
      p.map((x) =>
        x.id === photo.id
          ? { ...x, metadata: { ...x.metadata, ...details } }
          : x,
      ),
    );
    setIndex((i) => (i + 1) % photos.length);
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
        objective: `${key === "operations" ? guide.objective : "Prepare a daily business summary with sales, outstanding issues, and suggested next steps. Do not invent missing data."} Business: ${profile.businessName}. Team size: ${profile.employeeCount ?? "unspecified"}. Selected services: ${(profile.services ?? [guide.bundle]).join(", ") || "none"}. Location: ${profile.location}. Respond in ${profile.language}. Currency: ${profile.currency}.`,
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
  const close = (completed = false) => {
    sessionStorage.setItem("kobe-guided-later", "1");
    setOpen(false);
    if (standalone) {
      setStandalone(null);
      setStep(0);
    }
    if (completed) onComplete?.();
    else onDefer?.();
  };

  return (
    <>
      {!firstRun && (
        <button
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm text-emerald-300 shadow-xl"
          onClick={() => setOpen(true)}
        >
          <Sparkles size={18} /> AI business setup
        </button>
      )}
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
                  {standalone
                    ? `Add ${guide.noun}s from photos`
                    : "Let’s set up together"}
                </h2>
              </div>
              <button
                aria-label="Continue setup later"
                disabled={busy}
                onClick={() => {
                  if (step !== 1 || !photo || listingType) return close();
                  void run(async () => {
                    await request(`/media/inbox/${photo.id}`, "PATCH", {
                      metadata: details,
                    });
                    close();
                  });
                }}
              >
                <X />
              </button>
            </header>
            {!standalone && (
              <div className="flex flex-wrap gap-3 border-b border-slate-700 px-5 py-3 text-sm">
                {[
                  "Your business",
                  "Photos to inventory",
                  "Agents & automations",
                  "Ready",
                ].map((label, i) => (
                  <span
                    key={label}
                    className={
                      step === i ? "text-emerald-300" : "text-slate-400"
                    }
                  >
                    {i + 1}. {label}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-5 p-5 sm:p-8">
              {step === 0 && (
                <BusinessSetupInterview
                  initialQuestion={hasInstallAnswers ? 6 : 0}
                  profile={profile}
                  change={setProfile}
                  busy={busy}
                  finish={() => void run(saveProfile)}
                />
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
                      {listingType && (
                        <p className="mt-1 text-sm text-slate-400">
                          Published listings are hosted on Kobe Cloud. Connect
                          to the internet to upload and publish.
                        </p>
                      )}
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
                          src={
                            listingType
                              ? listingAssetUrl(photo.url)
                              : assetUrl(photo.url)
                          }
                          alt={photo.originalName}
                          className="h-72 w-full rounded-2xl bg-slate-800 object-contain"
                        />
                        <p className="mt-2 text-sm text-slate-400">
                          {totalPhotos - photos.length} of {totalPhotos} saved ·{" "}
                          {photos.length} waiting · {photo.originalName}
                        </p>
                        {!listingType && !attach && (
                          <button
                            disabled={busy}
                            onClick={() => run(suggest)}
                            className="mt-3 rounded-xl border border-emerald-400/50 px-4 py-2 text-emerald-300"
                          >
                            <Sparkles className="mr-2 inline" size={16} />{" "}
                            Suggest from photo
                          </button>
                        )}
                        {previous &&
                          (listingType || businessType === "shop") &&
                          !attach && (
                            <button
                              type="button"
                              disabled={busy}
                              className="mt-3 block rounded-xl border border-slate-600 px-4 py-2 text-left text-sm"
                              onClick={() => setAttach(true)}
                            >
                              {listingType
                                ? "Same listing, another photo"
                                : "Same product, another colour"}
                              <span className="block text-slate-400">
                                {previous.name}
                              </span>
                            </button>
                          )}
                      </div>
                      {attach ? (
                        <form
                          className="space-y-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(attachPhoto);
                          }}
                        >
                          <h3 className="text-lg font-semibold">
                            {previous?.name}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {listingType
                              ? "Add this angle to the existing gallery."
                              : "The product’s name, category and price carry over. Confirm the new colour and stock."}
                          </p>
                          {!listingType && (
                            <div className="space-y-3">
                              <label className="block">
                                New colour
                                <input
                                  className={control}
                                  maxLength={60}
                                  value={details.color}
                                  onChange={(e) =>
                                    setDetails((d) => ({
                                      ...d,
                                      color: e.target.value,
                                    }))
                                  }
                                  required
                                />
                              </label>
                              <label className="block">
                                Size (optional)
                                <input
                                  className={control}
                                  maxLength={60}
                                  value={details.size}
                                  onChange={(e) =>
                                    setDetails((d) => ({
                                      ...d,
                                      size: e.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <label className="block">
                                Stock for this colour and size
                                <input
                                  className={control}
                                  type="number"
                                  min={0}
                                  max={10000000}
                                  value={details.stock}
                                  onChange={(e) =>
                                    setDetails((d) => ({
                                      ...d,
                                      stock: e.target.value,
                                    }))
                                  }
                                  required
                                />
                              </label>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3">
                            <button disabled={busy} className={button}>
                              {listingType
                                ? "Add to gallery"
                                : "Save colour & next photo"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setAttach(false)}
                            >
                              Back
                            </button>
                          </div>
                        </form>
                      ) : listingType ? (
                        <ListingInterview
                          key={photo.id}
                          type={listingType}
                          profile={profile}
                          busy={busy}
                          save={(data, published) =>
                            void run(() => saveListing(data, published))
                          }
                          skip={() => void run(skipPhoto)}
                        />
                      ) : (
                        <PhotoIntakeInterview
                          key={photo.id}
                          profile={profile}
                          answers={details}
                          change={setDetails}
                          busy={busy}
                          confirm={() => void run(confirm)}
                          skip={() => void run(skipPhoto)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-600 p-12 text-center text-slate-300">
                      No photos waiting. Add a batch to begin, or set up your
                      agents.
                    </div>
                  )}
                  {standalone ? (
                    <button
                      disabled={busy}
                      onClick={() => close()}
                      className={button}
                    >
                      Done
                    </button>
                  ) : (
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
                  )}
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
                    <button
                      disabled={busy}
                      onClick={() =>
                        setStep(profile.businessType === "other" ? 0 : 1)
                      }
                    >
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
                        close(true);
                      })
                    }
                  >
                    Open my workspace <ArrowRight size={18} />
                  </button>
                  {profile.businessType !== "other" && (
                    <button
                      disabled={busy}
                      className="ml-4 text-sm"
                      onClick={() => setStep(1)}
                    >
                      Review more photos
                    </button>
                  )}
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
