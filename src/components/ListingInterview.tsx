import { useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { ListingType, SetupProfile } from "@/lib/guided-setup";

type Field = {
  key: string;
  label: string;
  choices?: string[];
  kind?: "number" | "text" | "long" | "toggle";
  optional?: boolean;
  min?: number;
  max?: number;
  length?: number;
  decimal?: boolean;
};
type Section = { title: string; fields: Field[] };
type Values = Record<string, string | boolean>;
const input =
  "w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-white";
const primary =
  "inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40";

const carSections = (currency: string): Section[] => [
  {
    title: "Which vehicle is in the photo?",
    fields: [
      { key: "make", label: "Make", length: 60 },
      { key: "model", label: "Model", length: 80 },
      {
        key: "year",
        label: "Model year",
        kind: "number",
        min: 1886,
        max: 2100,
      },
      { key: "trim", label: "Trim or grade", optional: true, length: 80 },
      {
        key: "condition",
        label: "Condition",
        choices: ["USED", "NEW", "IMPORTED"],
      },
    ],
  },
  {
    title: "What should buyers know about the car?",
    fields: [
      {
        key: "mileage",
        label: "Odometer (km)",
        kind: "number",
        min: 0,
        max: 10000000,
      },
      {
        key: "transmission",
        label: "Transmission",
        choices: ["Automatic", "Manual", "CVT", "Other"],
      },
      {
        key: "fuel",
        label: "Fuel",
        choices: ["Petrol", "Diesel", "Hybrid", "Electric", "Other"],
      },
      { key: "color", label: "Exterior colour", length: 60 },
      { key: "bodyType", label: "Body style", optional: true, length: 60 },
      { key: "driveType", label: "Drive type", optional: true, length: 60 },
      { key: "engine", label: "Engine", optional: true, length: 80 },
    ],
  },
  {
    title: "What are the price and buying options?",
    fields: [
      {
        key: "price",
        label: `Asking price (${currency})`,
        kind: "number",
        min: 0.01,
        max: 1e12,
        decimal: true,
      },
      { key: "location", label: "Showroom or vehicle location", length: 160 },
      {
        key: "availability",
        label: "Availability",
        choices: ["AVAILABLE", "IN_TRANSIT", "COMING_SOON"],
      },
      { key: "negotiable", label: "Price is negotiable", kind: "toggle" },
      {
        key: "financingAvailable",
        label: "Financing available",
        kind: "toggle",
      },
    ],
  },
  {
    title: "What makes this vehicle stand out?",
    fields: [
      {
        key: "features",
        label: "Features, separated by commas",
        optional: true,
        length: 1000,
      },
      {
        key: "description",
        label: "Public description",
        kind: "long",
        optional: true,
        length: 4000,
      },
    ],
  },
];

const propertySections = (
  currency: string,
  offer: Values[string],
): Section[] => [
  {
    title: "What space are you listing?",
    fields: [
      {
        key: "kind",
        label: "Property type",
        choices: [
          "Apartment",
          "House",
          "Land",
          "Office",
          "Shop",
          "Warehouse",
          "Other",
        ],
      },
      { key: "title", label: "Listing title", length: 120 },
      { key: "offer", label: "Rent or sale", choices: ["RENT", "SALE"] },
      { key: "location", label: "Neighbourhood and city", length: 160 },
    ],
  },
  {
    title: "How large is the space, and what does it cost?",
    fields: [
      {
        key: "price",
        label: `${offer === "SALE" ? "Sale price" : "Monthly rent"} (${currency})`,
        kind: "number",
        min: 0.01,
        max: 1e12,
        decimal: true,
      },
      {
        key: "areaM2",
        label: "Area (m²)",
        kind: "number",
        min: 0.01,
        max: 1e9,
        decimal: true,
        optional: true,
      },
      {
        key: "bedrooms",
        label: "Bedrooms",
        kind: "number",
        min: 0,
        max: 1000,
        optional: true,
      },
      {
        key: "bathrooms",
        label: "Bathrooms",
        kind: "number",
        min: 0,
        max: 1000,
        optional: true,
      },
    ],
  },
  {
    title: "What should someone know before booking a viewing?",
    fields: [
      {
        key: "amenities",
        label: "Amenities, separated by commas",
        optional: true,
        length: 1000,
      },
      {
        key: "description",
        label: "Public description",
        kind: "long",
        optional: true,
        length: 4000,
      },
      {
        key: "contactPhone",
        label: "Public phone for viewing enquiries",
        length: 25,
      },
    ],
  },
];

function commaList(value: Values[string]) {
  return String(value || "")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
}
const display = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/^[A-Z ]+$/, (text) => text.toLowerCase())
    .replace(/^./, (ch) => ch.toUpperCase());

export default function ListingInterview({
  type,
  profile,
  busy,
  save,
  initial,
  skip,
}: {
  type: ListingType;
  profile: SetupProfile;
  busy: boolean;
  save: (data: Record<string, unknown>, published: boolean) => void;
  initial?: Values;
  skip?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({
    condition: "USED",
    availability: "AVAILABLE",
    offer: "RENT",
    location: profile.location,
    contactPhone: profile.phone,
    ...initial,
  });
  const [error, setError] = useState("");
  const car = type === "dealership";
  const sections = car
    ? carSections(profile.currency)
    : propertySections(profile.currency, values.offer);
  if (!car && !["House", "Apartment", "Other"].includes(String(values.kind))) {
    sections[1].fields = sections[1].fields.filter(
      (field) => !["bedrooms", "bathrooms"].includes(field.key),
    );
  }
  const section = sections[step];
  const update = (key: string, value: Values[string]) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const str = (key: string) => String(values[key] ?? "").trim();
  const title = car
    ? `${str("year")} ${str("make")} ${str("model")}`
    : str("title");
  const saveListing = (published: boolean) => {
    const all = sections.flatMap((group) => group.fields);
    const listKey = car ? "features" : "amenities";
    const features = commaList(values[listKey]);
    if (
      features.length > 30 ||
      features.some((feature) => feature.length > 100)
    ) {
      setError(
        "Enter up to 30 features or amenities, with up to 100 characters each.",
      );
      return;
    }
    const data = Object.fromEntries(
      all.map((field) => {
        if (field.key === listKey) return [field.key, features];
        if (field.kind === "number")
          return [
            field.key,
            str(field.key) ? Number(str(field.key)) : undefined,
          ];
        if (field.kind === "toggle")
          return [field.key, Boolean(values[field.key])];
        return [field.key, str(field.key)];
      }),
    );
    save({ ...data, published }, published);
  };

  return (
    <form
      className="space-y-4 text-white"
      onSubmit={(event) => {
        event.preventDefault();
        if (!section) return;
        if (
          section.fields.some(
            (field) =>
              !field.optional && field.kind !== "toggle" && !str(field.key),
          )
        ) {
          setError("Fill in the required details to continue.");
          return;
        }
        if (
          section.fields.some((field) => field.key === "contactPhone") &&
          !/^\+?[\d ()-]{7,24}$/.test(str("contactPhone"))
        ) {
          setError("Enter a public phone number for viewing enquiries.");
          return;
        }
        setError("");
        setStep(step + 1);
      }}
    >
      <p className="flex items-center gap-2 text-sm text-emerald-300">
        <Sparkles size={16} />{" "}
        {section
          ? `Step ${step + 1} of ${sections.length}`
          : "Preview before publishing"}
      </p>
      {section ? (
        <>
          <h3 className="text-xl font-semibold">{section.title}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields.map((field) => (
              <label
                key={field.key}
                className={`space-y-1 text-sm text-slate-300 ${field.kind === "long" ? "sm:col-span-2" : ""}`}
              >
                {field.kind === "toggle" ? (
                  <>
                    <input
                      className="mr-2"
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      disabled={busy}
                      onChange={(e) => update(field.key, e.target.checked)}
                    />
                    {field.label}
                  </>
                ) : (
                  <>
                    <span>
                      {field.label}
                      {field.optional && " (optional)"}
                    </span>
                    {field.choices ? (
                      <select
                        className={input}
                        required={!field.optional}
                        disabled={busy}
                        value={str(field.key)}
                        onChange={(e) => update(field.key, e.target.value)}
                      >
                        <option value="">Choose</option>
                        {field.choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {display(choice)}
                          </option>
                        ))}
                      </select>
                    ) : field.kind === "long" ? (
                      <textarea
                        className={input}
                        maxLength={field.length}
                        disabled={busy}
                        value={String(values[field.key] ?? "")}
                        onChange={(e) => update(field.key, e.target.value)}
                      />
                    ) : (
                      <input
                        className={input}
                        required={!field.optional}
                        type={
                          field.kind === "number"
                            ? "number"
                            : field.key === "contactPhone"
                              ? "tel"
                              : "text"
                        }
                        min={field.min}
                        max={field.max}
                        step={field.decimal ? "0.01" : 1}
                        maxLength={field.length}
                        disabled={busy}
                        value={String(values[field.key] ?? "")}
                        onChange={(e) => update(field.key, e.target.value)}
                      />
                    )}
                  </>
                )}
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-600 p-4">
          <p className="text-sm text-slate-400">
            {car ? "Dealer site and Jumla Cars" : "Jumla Properties"}
          </p>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-lg font-bold text-emerald-300">
            {profile.currency} {Number(values.price).toLocaleString()}
            {!car && values.offer === "RENT" && " / month"}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {sections
              .flatMap((group) => group.fields)
              .filter(
                (field) =>
                  !["title", "price", "make", "model", "year"].includes(
                    field.key,
                  ) && values[field.key],
              )
              .map((field) => (
                <div
                  key={field.key}
                  className={field.kind === "long" ? "col-span-2" : ""}
                >
                  <dt className="text-slate-400">{field.label}</dt>
                  <dd className="break-words">
                    {values[field.key] === true
                      ? "Yes"
                      : field.choices
                        ? display(str(field.key))
                        : str(field.key)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}
      {error && (
        <p role="alert" className="text-amber-200">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {section ? (
          <button className={primary} disabled={busy}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <>
            <button
              type="button"
              className={primary}
              disabled={busy}
              onClick={() => saveListing(true)}
            >
              Publish listing <Check size={16} />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => saveListing(false)}
            >
              Save draft
            </button>
          </>
        )}
        {step > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setStep(step - 1);
            }}
          >
            Back
          </button>
        )}
        {skip && (
          <button
            type="button"
            disabled={busy}
            className="text-sm text-slate-400"
            onClick={skip}
          >
            Skip photo
          </button>
        )}
      </div>
    </form>
  );
}
