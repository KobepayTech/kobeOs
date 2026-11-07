import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Images } from "lucide-react";
import { listingApi, apiArray, listingAssetUrl } from "@/lib/api";
import {
  DEFAULT_SETUP,
  LISTING_SAVED,
  openPhotoIntake,
} from "@/lib/guided-setup";
import type { PropertyListing } from "@/lib/property-listings";
import ListingInterview from "@/components/ListingInterview";

export default function PropertyListings() {
  const [rows, setRows] = useState<PropertyListing[]>([]);
  const [editing, setEditing] = useState<PropertyListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(
        apiArray<PropertyListing>(await listingApi("/property/listings")),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail === "property") void load();
    };
    window.addEventListener(LISTING_SAVED, refresh);
    return () => window.removeEventListener(LISTING_SAVED, refresh);
  }, [load]);

  const update = async (data: Record<string, unknown>) => {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await listingApi(`/property/listings/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          areaM2: data.areaM2 ?? null,
        }),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="h-full overflow-auto p-5 text-slate-900">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Real estate listings</h2>
          <p className="text-sm text-slate-600">
            Prepare homes, land and commercial spaces for Jumla Properties.
          </p>
        </div>
        <button
          onClick={() => openPhotoIntake("property")}
          className="flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white"
        >
          <Images size={16} /> Add from photos
        </button>
      </header>
      {loading && <p role="status">Loading your listings…</p>}
      {error && !editing && (
        <p role="alert" className="text-rose-800">
          {error}
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed p-8 text-center text-slate-600">
          Add property photos to start your first listing.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <article
            key={row.id}
            className="overflow-hidden rounded-2xl border bg-white"
          >
            <img
              alt=""
              className="h-40 w-full object-cover"
              src={listingAssetUrl(row.imageUrls[0])}
            />
            <div className="space-y-2 p-4">
              <p className="text-xs font-bold text-emerald-800">
                {row.published ? "Published" : "Draft"} · {row.kind}
              </p>
              <h3 className="text-lg font-bold">{row.title}</h3>
              <p className="text-sm">
                {row.location} · {row.currency}{" "}
                {Number(row.price).toLocaleString()}
                {row.offer === "RENT" && " / month"}
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-bold">
                <button
                  onClick={() => {
                    setError("");
                    setEditing(row);
                  }}
                >
                  Edit listing
                </button>
                {row.published && (
                  <a
                    className="inline-flex items-center gap-1 text-emerald-800"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://jumla.kobeapptz.com/jumla?listing=${row.id}`}
                  >
                    View on Jumla <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <section
            role="dialog"
            aria-label="Edit property listing"
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-slate-900 p-5 text-white"
          >
            <button
              className="mb-4 text-sm text-slate-300"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setError("");
              }}
            >
              Close
            </button>
            <ListingInterview
              type="property"
              profile={{ ...DEFAULT_SETUP, currency: editing.currency }}
              busy={busy}
              initial={{
                title: editing.title,
                kind: editing.kind,
                offer: editing.offer,
                location: editing.location,
                price: String(editing.price),
                contactPhone: editing.contactPhone,
                description: editing.description,
                amenities: editing.amenities.join(", "),
                bedrooms: String(editing.bedrooms ?? ""),
                bathrooms: String(editing.bathrooms ?? ""),
                areaM2: String(editing.areaM2 ?? ""),
              }}
              save={(data) => void update(data)}
            />
            {error && (
              <p role="alert" className="mt-4 text-rose-200">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
