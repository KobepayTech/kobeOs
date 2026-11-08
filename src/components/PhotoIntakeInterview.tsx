import { useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { SetupProfile } from "@/lib/guided-setup";

export interface VariantAnswer {
  size: string;
  color?: string;
  price: string;
  stock: string;
}
export interface PhotoAnswers {
  name: string;
  category: string;
  price: string;
  discountPrice: string;
  buyingPrice: string;
  buyingCurrency: "local" | "CNY";
  exchangeRate: string;
  transportPerUnit: string;
  color: string;
  stock: string;
  size: string;
  roomNumbers: string;
  capacity: string;
  variants: VariantAnswer[];
}
export const EMPTY_PHOTO_ANSWERS: PhotoAnswers = {
  name: "",
  category: "",
  price: "",
  discountPrice: "",
  buyingPrice: "",
  buyingCurrency: "local",
  exchangeRate: "",
  transportPerUnit: "",
  color: "",
  stock: "",
  size: "",
  roomNumbers: "",
  capacity: "",
  variants: [],
};

type Field = keyof Omit<PhotoAnswers, "variants">;
const input =
  "w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-white";
const next =
  "inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40";

export default function PhotoIntakeInterview({
  profile,
  answers,
  change,
  confirm,
  skip,
  busy,
}: {
  profile: SetupProfile;
  answers: PhotoAnswers;
  change: (value: PhotoAnswers) => void;
  confirm: () => void;
  skip: () => void;
  busy: boolean;
}) {
  const [question, setQuestion] = useState(0);
  const shop = profile.businessType === "shop";
  const hotel = profile.businessType === "hotel";
  const variants = answers.variants;
  const fields: Array<{
    key: Field | "variants" | "cost";
    label: string;
    optional?: boolean;
    number?: boolean;
  }> = [
    {
      key: "name",
      label: hotel
        ? "What type of room is this?"
        : shop
          ? "What item is in this photo?"
          : "What dish is in this photo?",
    },
    {
      key: "price",
      label: `${hotel ? "What is the nightly rate" : "What is the regular price"}? (${profile.currency})`,
      number: true,
    },
    ...(shop
      ? [
          {
            key: "discountPrice" as const,
            label: `What price can you offer if a customer asks for a discount? (${profile.currency})`,
            optional: true,
            number: true,
          },
        ]
      : []),
    ...(shop ? [{ key: "cost" as const, label: "What did each unit cost you?" }] : []),
    { key: "category", label: "Which category should I put it in?" },
    ...(hotel
      ? [
          {
            key: "roomNumbers" as const,
            label:
              "Which room numbers look like this? Separate them with commas.",
          },
          {
            key: "capacity" as const,
            label: "How many guests fit in each room?",
            number: true,
          },
        ]
      : shop
        ? [
            {
              key: "variants" as const,
              label: "Does this item come in different colours or sizes?",
            },
            ...(variants.length
              ? []
              : [
                  {
                    key: "color" as const,
                    label: "What colour is it?",
                    optional: true,
                  },
                  {
                    key: "size" as const,
                    label: "What size is it?",
                    optional: true,
                  },
                  {
                    key: "stock" as const,
                    label: "How many are in stock?",
                    number: true,
                  },
                ]),
          ]
        : [
            { key: "size" as const, label: "What portion size is it?" },
            {
              key: "stock" as const,
              label: "How many portions are available today?",
              number: true,
            },
          ]),
  ];
  const field = fields[question];
  const review = !field;
  const discountInvalid =
    field?.key === "discountPrice" &&
    answers.discountPrice !== "" &&
    Number(answers.discountPrice) >= Number(answers.price);
  const update = (patch: Partial<PhotoAnswers>) =>
    change({ ...answers, ...patch });
  const money = (value: string) =>
    `${profile.currency} ${Number(value).toLocaleString()}`;
  const imported = answers.buyingCurrency === "CNY";
  const landedCost = answers.buyingPrice === "" ? null :
    Number(answers.buyingPrice) * (imported ? Number(answers.exchangeRate) : 1) + Number(answers.transportPerUnit);
  const stock = variants.length
    ? variants.reduce((sum, row) => sum + Number(row.stock), 0)
    : Number(answers.stock);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (discountInvalid) return;
        if (review) confirm();
        else setQuestion((q) => q + 1);
      }}
    >
      <p className="flex items-center gap-2 text-sm text-emerald-300">
        <Sparkles size={17} /> Kobe AI ·{" "}
        {review
          ? "Review this entry"
          : `Question ${question + 1} of ${fields.length}`}
      </p>
      {field?.key === "cost" ? (
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">{field.label}</legend>
          <p className="text-sm text-slate-400 sm:col-span-2">Optional. Cost is for your team and applies to each SKU in this entry.</p>
          <label className="text-sm">Buying currency
            <select className={input} value={answers.buyingCurrency}
              onChange={(event) => update({ buyingCurrency: event.target.value === "CNY" ? "CNY" : "local" })}>
              <option value="local">{profile.currency}</option>
              {profile.currency !== "CNY" && <option value="CNY">CNY (Chinese yuan)</option>}
            </select>
          </label>
          <label className="text-sm">Buying price per unit
            <input className={input} type="number" min={0} step="any" max={1e12}
              value={answers.buyingPrice} onChange={(event) => update({ buyingPrice: event.target.value })} />
          </label>
          {imported && <label className="text-sm">{profile.currency} per 1 CNY
            <input className={input} type="number" min={0.000001} step="any" max={1e9}
              required={answers.buyingPrice !== ""} value={answers.exchangeRate}
              onChange={(event) => update({ exchangeRate: event.target.value })} />
          </label>}
          <label className="text-sm">Transport per unit ({profile.currency})
            <input className={input} type="number" min={0} step="any" max={1e12}
              disabled={answers.buyingPrice === ""} value={answers.transportPerUnit}
              onChange={(event) => update({ transportPerUnit: event.target.value })} />
          </label>
        </fieldset>
      ) : field?.key === "variants" ? (
        <fieldset disabled={busy} className="space-y-3">
          <legend className="mb-2 text-lg font-semibold">{field.label}</legend>
          <p className="text-sm text-slate-400">
            Add one SKU per colour and size combination, with its own quantity.
            Leave this empty for a single SKU.
          </p>
          {variants.map((variant, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-2 rounded-xl border border-slate-600 p-3"
            >
              {(["color", "size", "price", "stock"] as const).map((key) => (
                <label key={key} className="text-xs text-slate-300">
                  {
                    {
                      color: "Colour",
                      size: "Size",
                      price: `Price (${profile.currency})`,
                      stock: "Stock",
                    }[key]
                  }{" "}
                  · SKU {i + 1}
                  <input
                    className={input}
                    type={
                      key === "price" || key === "stock" ? "number" : "text"
                    }
                    min={0}
                    step={key === "price" ? "any" : 1}
                    maxLength={60}
                    required={key === "price" || key === "stock"}
                    value={variant[key] ?? ""}
                    onChange={(e) =>
                      update({
                        variants: variants.map((row, j) =>
                          i === j ? { ...row, [key]: e.target.value } : row,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="text-left text-sm text-slate-300"
                onClick={() =>
                  update({ variants: variants.filter((_, j) => i !== j) })
                }
              >
                Remove SKU {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={variants.length >= 50}
            className="text-sm text-emerald-300"
            onClick={() =>
              update({
                variants: [
                  ...variants,
                  { color: "", size: "", price: answers.price, stock: "" },
                ],
              })
            }
          >
            + Add colour or size SKU
          </button>
          {variants.some((v) => !v.color?.trim() && !v.size.trim()) && (
            <p className="text-sm text-amber-200">
              Enter a colour or size for every SKU.
            </p>
          )}
        </fieldset>
      ) : field ? (
        <label key={field.key} className="block space-y-2">
          <span className="text-lg font-semibold">{field.label}</span>
          <input
            autoFocus
            className={input}
            disabled={busy}
            required={!field.optional}
            type={field.number ? "number" : "text"}
            min={field.key === "capacity" ? 1 : 0}
            step={
              field.key === "price" || field.key === "discountPrice" ? "any" : 1
            }
            maxLength={
              field.key === "roomNumbers"
                ? 4096
                : field.key === "name"
                  ? 120
                  : 60
            }
            value={answers[field.key]}
            onChange={(e) => update({ [field.key]: e.target.value })}
          />
          {field.optional && (
            <span className="block text-sm text-slate-400">
              Optional.{" "}
              {field.key === "discountPrice"
                ? "Your regular price stays in effect. Kobe AI can use this price when advising staff on a discount."
                : "Leave blank if it doesn’t apply."}
            </span>
          )}
        </label>
      ) : (
        <div className="space-y-2 rounded-xl border border-slate-600 p-4">
          <p className="text-lg font-semibold">{answers.name}</p>
          <p className="text-sm text-slate-300">
            {answers.category} · {money(answers.price)}
            {answers.discountPrice &&
              ` · Discount reference ${money(answers.discountPrice)}`}
          </p>
          {shop && landedCost !== null && (
            <p className="text-sm text-slate-300">
              Landed cost {money(String(landedCost))} / unit
              {variants.length === 0 && ` · Estimated gross profit ${money(String(Number(answers.price) - landedCost))} / unit`}
            </p>
          )}
          {hotel ? (
            <p className="text-sm text-slate-300">
              Rooms {answers.roomNumbers} · {answers.capacity} guests per room
            </p>
          ) : (
            <p className="text-sm text-slate-300">
              {[answers.color, answers.size].filter(Boolean).join(" · ")}{" "}
              {stock} {shop ? "in stock" : "portions available"}
            </p>
          )}
          {variants.map((v, i) => (
            <p className="text-sm text-slate-300" key={i}>
              {[v.color, v.size].filter(Boolean).join(" / ")} · {money(v.price)}{" "}
              · {v.stock} in stock
              {landedCost !== null && ` · Estimated gross profit ${money(String(Number(v.price) - landedCost))} / unit`}
            </p>
          ))}
        </div>
      )}
      {discountInvalid && (
        <p className="text-sm text-amber-200">
          Enter a discount price below the regular price.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={next}
          disabled={
            busy ||
            discountInvalid ||
            (field?.key === "variants" &&
              variants.some((v) => !v.color?.trim() && !v.size.trim()))
          }
        >
          {review ? (
            <>
              Save & next photo <Check size={17} />
            </>
          ) : (
            <>
              Continue <ArrowRight size={17} />
            </>
          )}
        </button>
        <button
          type="button"
          disabled={busy || question === 0}
          onClick={() => setQuestion((q) => q - 1)}
        >
          Back
        </button>
        <button
          type="button"
          disabled={busy}
          className="text-sm text-slate-400"
          onClick={skip}
        >
          Skip photo for now
        </button>
      </div>
    </form>
  );
}
