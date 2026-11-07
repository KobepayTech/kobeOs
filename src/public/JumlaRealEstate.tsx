import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Images,
  MapPin,
  Phone,
} from "lucide-react";
import type { PropertyListing } from "@/lib/property-listings";
import { publicApi, publicAssetUrl } from "./api";

const price = (listing: PropertyListing) =>
  `${listing.currency} ${Number(listing.price).toLocaleString()}${listing.offer === "RENT" ? " / month" : ""}`;
const facts = (listing: PropertyListing) =>
  [
    listing.bedrooms != null ? `${listing.bedrooms} beds` : null,
    listing.bathrooms != null ? `${listing.bathrooms} baths` : null,
    listing.areaM2 != null
      ? `${Number(listing.areaM2).toLocaleString()} m²`
      : null,
  ].filter(Boolean);

export default function JumlaRealEstate({ query }: { query: string }) {
  const [rows, setRows] = useState<PropertyListing[]>([]);
  const [offer, setOffer] = useState("");
  const [selectedId, setSelectedId] = useState(() =>
    new URLSearchParams(window.location.search).get("listing"),
  );
  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [photo, setPhoto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const request = selectedId
      ? publicApi<PropertyListing>(
          `/property-public/listings/${encodeURIComponent(selectedId)}`,
        ).then((value) => {
          if (active) setListing(value);
        })
      : publicApi<PropertyListing[]>(
          `/property-public/listings?${new URLSearchParams({ q: query, offer })}`,
        ).then((value) => {
          if (active) setRows(value);
        });
    void request
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load listings",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, offer, selectedId]);

  const select = (id: string | null) => {
    setListing(null);
    setPhoto(0);
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("listing", id);
    else url.searchParams.delete("listing");
    window.history.replaceState(null, "", url);
  };

  return (
    <section className="mt-6">
      {selectedId ? (
        <button
          onClick={() => select(null)}
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800"
        >
          <ArrowLeft size={16} /> All listings
        </button>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Jumla Properties
            </p>
            <h2 className="mt-1 text-2xl font-black">Find a place that fits</h2>
          </div>
          <div className="flex gap-1 rounded-full border bg-white p-1">
            {[
              ["", "All"],
              ["RENT", "Rent"],
              ["SALE", "Buy"],
            ].map(([value, label]) => (
              <button
                key={label}
                aria-pressed={offer === value}
                className={`rounded-full px-4 py-2 text-sm font-bold ${offer === value ? "bg-[#071d18] text-white" : "text-slate-600"}`}
                onClick={() => setOffer(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {loading && (
        <p role="status" className="my-8 text-slate-500">
          Loading listings…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="my-8 rounded-xl bg-rose-50 p-4 text-rose-800"
        >
          {error}
        </p>
      )}
      {!loading && !error && selectedId && listing && (
        <article className="mt-4 overflow-hidden rounded-3xl border bg-white lg:grid lg:grid-cols-2">
          <div className="relative bg-slate-100">
            <img
              src={publicAssetUrl(listing.imageUrls[photo])}
              alt={`${listing.title}, photo ${photo + 1}`}
              className="aspect-[4/3] h-full w-full object-cover"
            />
            {listing.imageUrls.length > 1 && (
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                <button
                  aria-label="Previous photo"
                  className="rounded-full bg-white p-3 shadow"
                  onClick={() =>
                    setPhoto(
                      (p) =>
                        (p + listing.imageUrls.length - 1) %
                        listing.imageUrls.length,
                    )
                  }
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs text-white">
                  {photo + 1} / {listing.imageUrls.length}
                </span>
                <button
                  aria-label="Next photo"
                  className="rounded-full bg-white p-3 shadow"
                  onClick={() =>
                    setPhoto((p) => (p + 1) % listing.imageUrls.length)
                  }
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
          <div className="space-y-4 p-5 sm:p-7">
            <p className="text-xs font-bold uppercase text-emerald-700">
              {listing.kind} · For {listing.offer === "RENT" ? "rent" : "sale"}
            </p>
            <h3 className="text-3xl font-black">{listing.title}</h3>
            <p className="flex items-center gap-2 text-slate-600">
              <MapPin size={16} />
              {listing.location}
            </p>
            <p className="text-xl font-black">{price(listing)}</p>
            <ul className="flex flex-wrap gap-2">
              {facts(listing).map((fact) => (
                <li
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm"
                  key={fact}
                >
                  {fact}
                </li>
              ))}
            </ul>
            <p className="whitespace-pre-wrap break-words text-slate-700">
              {listing.description}
            </p>
            <ul className="flex flex-wrap gap-2">
              {listing.amenities.map((amenity, i) => (
                <li
                  key={i}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
                >
                  {amenity}
                </li>
              ))}
            </ul>
            <a
              href={`tel:${listing.contactPhone.replace(/[^+\d]/g, "")}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#071d18] px-4 py-3 font-bold text-white"
            >
              <Phone size={16} /> Call to arrange a viewing
            </a>
          </div>
        </article>
      )}
      {!loading && !error && !selectedId && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => select(row.id)}
              className="overflow-hidden rounded-3xl border bg-white text-left hover:shadow-md"
            >
              <div className="relative">
                <img
                  src={publicAssetUrl(row.imageUrls[0])}
                  alt=""
                  className="h-48 w-full object-cover"
                />
                <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-950/75 px-3 py-1 text-xs text-white">
                  <Images size={14} /> {row.imageUrls.length}
                </span>
              </div>
              <div className="space-y-2 p-5">
                <p className="text-xs font-bold uppercase text-emerald-700">
                  {row.kind} · For {row.offer === "RENT" ? "rent" : "sale"}
                </p>
                <h3 className="text-lg font-black">{row.title}</h3>
                <p className="text-sm text-slate-600">{row.location}</p>
                {facts(row).length > 0 && (
                  <p className="text-sm text-slate-600">
                    {facts(row).join(" · ")}
                  </p>
                )}
                <p className="flex items-center justify-between font-black">
                  {price(row)} <ArrowRight size={18} />
                </p>
              </div>
            </button>
          ))}
          {rows.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed py-10 text-center text-slate-500">
              <Building2 className="mx-auto mb-2" />
              No properties match this search.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
