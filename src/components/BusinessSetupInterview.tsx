import { useState } from "react";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import { BUNDLES } from "@/os/bundles";
import {
  BUSINESS_GUIDES,
  type BusinessType,
  type SetupProfile,
} from "@/lib/guided-setup";

const input =
  "w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-white";
const nextButton =
  "inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950";

export default function BusinessSetupInterview({
  profile,
  change,
  finish,
  busy,
  initialQuestion = 0,
  finishLabel = "Prepare my workspace",
}: {
  profile: SetupProfile;
  change: (profile: SetupProfile) => void;
  finish: () => void;
  busy?: boolean;
  initialQuestion?: number;
  finishLabel?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const update = (patch: Partial<SetupProfile>) =>
    change({ ...profile, ...patch });
  const recommended = BUSINESS_GUIDES[profile.businessType].bundle;
  const bundles = BUNDLES.filter(
    (bundle) =>
      showAll || [recommended, "office", "finance"].includes(bundle.id),
  );
  const selected = profile.services ?? [recommended];
  const name = profile.displayName?.trim();
  const questions = [
    "Hi! What name should I call you?",
    `Thanks, ${name || "there"}. What kind of name is that?`,
    "What name should appear on your business documents?",
    "How many employees are on your team?",
    "What kind of business are you setting up?",
    "Which services would help you run your business?",
    "What details should I use for this workspace?",
  ];
  const textField = (
    key:
      | "displayName"
      | "documentName"
      | "businessName"
      | "location"
      | "phone"
      | "currency"
      | "timezone",
    label: string,
    limit: number,
    required = false,
  ) => (
    <label className="block space-y-1 text-sm text-slate-300">
      <span>{label}</span>
      <input
        className={input}
        maxLength={limit}
        required={required}
        value={profile[key] ?? ""}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <form
      className="space-y-5 text-white"
      onSubmit={(e) => {
        e.preventDefault();
        if (question === questions.length - 1) finish();
        else setQuestion((q) => q + 1);
      }}
    >
      <div className="flex items-center gap-3">
        <Sparkles className="text-emerald-300" size={22} />
        <p className="text-sm text-slate-400">
          Kobe AI · Question {question + 1} of {questions.length}
        </p>
      </div>
      <p className="text-xl font-semibold" aria-live="polite">
        {questions[question]}
      </p>
      <fieldset disabled={busy} className="space-y-4">
        {question === 0 &&
          textField("displayName", "Name or nickname", 120, true)}
        {question === 1 && (
          <div className="space-y-2">
            {(
              [
                ["personal", "My personal name"],
                ["business", "My business name"],
                ["username", "A username or nickname"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-3 rounded-xl border border-slate-600 p-3"
              >
                <input
                  required
                  type="radio"
                  name="setup-name-kind"
                  checked={profile.nameKind === value}
                  onChange={() =>
                    update({
                      nameKind: value,
                      ...(value === "business" && !profile.documentName
                        ? { documentName: name }
                        : {}),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        )}
        {question === 2 && (
          <>
            <p className="text-sm text-slate-400">
              I’ll use {name || "your chosen name"} when we talk. If your
              receipts should say KobeTech or another documented name, enter
              that name here. You can leave it blank.
            </p>
            {textField("documentName", "Document name (optional)", 120)}
          </>
        )}
        {question === 3 && (
          <label className="block space-y-1 text-sm text-slate-300">
            <span>Employees (enter 0 if you work alone)</span>
            <input
              type="number"
              min={0}
              max={1000000}
              step={1}
              className={input}
              value={profile.employeeCount ?? ""}
              onChange={(e) =>
                update({
                  employeeCount:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        )}
        {question === 4 && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(BUSINESS_GUIDES) as BusinessType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={profile.businessType === type}
                  className={`rounded-xl border p-3 text-left ${profile.businessType === type ? "border-emerald-400" : "border-slate-600"}`}
                  onClick={() =>
                    update({ businessType: type, services: undefined })
                  }
                >
                  {BUSINESS_GUIDES[type].label}
                </button>
              ))}
            </div>
            {textField("businessName", "Workspace or trading name", 120, true)}
          </>
        )}
        {question === 5 && (
          <>
            <p className="text-sm text-slate-400">
              I’ve selected {BUNDLES.find((b) => b.id === recommended)?.name}{" "}
              for your business. You can change the selection. App Store access
              and subscription terms apply.
            </p>
            {(profile.employeeCount ?? 0) >= 10 && recommended !== "office" && (
              <p className="text-sm text-emerald-200">
                With {profile.employeeCount} employees, consider Office &amp;
                Services for team documents and scheduling.
              </p>
            )}
            {bundles.map((bundle) => (
              <div
                key={bundle.id}
                className="rounded-xl border border-slate-600 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(bundle.id)}
                      onChange={(e) =>
                        update({
                          services: e.target.checked
                            ? [...selected, bundle.id]
                            : selected.filter((id) => id !== bundle.id),
                        })
                      }
                    />
                    {bundle.name}
                  </label>
                  <button
                    type="button"
                    className="flex gap-1 text-sm text-emerald-300"
                    aria-expanded={explaining === bundle.id}
                    onClick={() =>
                      setExplaining(explaining === bundle.id ? null : bundle.id)
                    }
                  >
                    <MessageCircle size={16} /> Explain
                  </button>
                </div>
                {explaining === bundle.id && (
                  <p className="mt-2 text-sm text-slate-300">
                    {bundle.description}
                  </p>
                )}
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-emerald-300"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show recommended services" : "See all services"}
            </button>
          </>
        )}
        {question === 6 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {textField("location", "Business location", 160)}
            {textField("phone", "Business phone", 40)}
            {textField("currency", "Currency code", 3, true)}
            {textField("timezone", "Business timezone", 80, true)}
            <label className="block space-y-1 text-sm text-slate-300">
              Agent language
              <select
                className={input}
                value={profile.language}
                onChange={(e) => update({ language: e.target.value })}
              >
                <option>English</option>
                <option>Kiswahili</option>
              </select>
            </label>
          </div>
        )}
      </fieldset>
      <div className="flex justify-between gap-3">
        <button
          type="button"
          className="text-slate-300"
          disabled={busy || question === 0}
          onClick={() => setQuestion((q) => q - 1)}
        >
          Back
        </button>
        <button disabled={busy} className={nextButton}>
          {question === questions.length - 1 ? finishLabel : "Continue"}{" "}
          <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}
