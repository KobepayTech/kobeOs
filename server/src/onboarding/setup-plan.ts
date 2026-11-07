/**
 * Turning the setup interview into a working business.
 *
 * The interview already asks what the business is and what it does. Those
 * answers then sat in a column: the owner still had to find the App Store,
 * work out which of fourteen bundles matched the business they had just
 * described, and build their own automations.
 *
 * This closes that gap. It reads the answers and proposes a workspace: the
 * bundles to install, and the recurring agent jobs that make the business
 * report on itself.
 *
 * Three rules this follows, and the reasons they are rules:
 *
 * 1. It proposes; it never installs. Bundles are entitlements, and some are
 *    billed, so acting on an interview answer would charge someone for
 *    answering a question. The owner confirms a list.
 * 2. Every line explains itself. A list someone did not ask for, offering to
 *    change what their business can do, is only trustworthy if each item says
 *    why it is there.
 * 3. Nothing is invented from a blank answer. An interview left half-finished
 *    produces a smaller plan, not a guessed one.
 */

export type BusinessType = 'shop' | 'hotel' | 'restaurant' | 'other';

export interface GuidedAnswers {
  businessType?: string;
  services?: string[];
  employeeCount?: number;
  currency?: string;
  timezone?: string;
  businessName?: string;
}

export interface PlannedBundle {
  bundleId: string;
  why: string;
}

/**
 * A recurring agent job. `objective` is the instruction the agent runs, so it
 * is written as something to do rather than a feature name.
 */
export interface PlannedAutomation {
  key: string;
  name: string;
  objective: string;
  frequency: 'DAILY' | 'WEEKLY';
  timeOfDay: string;
  why: string;
}

export interface SetupPlan {
  businessType: BusinessType;
  bundles: PlannedBundle[];
  automations: PlannedAutomation[];
  timezone: string;
}

export const DEFAULT_TIMEZONE = 'Africa/Dar_es_Salaam';

export function normaliseBusinessType(raw: unknown): BusinessType {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'shop' || value === 'hotel' || value === 'restaurant') return value;
  return 'other';
}

/**
 * The bundle that matches the business the owner described, plus any the
 * services they listed imply.
 *
 * Service matching is deliberately narrow: a word has to clearly name a line
 * of business before it adds a paid bundle. Guessing wide would put charges on
 * the list that the owner never asked about, which is the fastest way to make
 * the whole plan untrustworthy.
 */
export function bundlesFor(answers: GuidedAnswers): PlannedBundle[] {
  const type = normaliseBusinessType(answers.businessType);
  const planned: PlannedBundle[] = [];
  const add = (bundleId: string, why: string) => {
    if (!planned.some((entry) => entry.bundleId === bundleId)) planned.push({ bundleId, why });
  };

  switch (type) {
    case 'shop':
      add('retail', 'You described a shop, so this covers the till, stock and the books.');
      break;
    case 'hotel':
      add('hospitality', 'You described a hotel, so this covers the front desk, rooms and guest billing.');
      break;
    case 'restaurant':
      add('restaurants', 'You described a restaurant, so this covers food service, the till and the books.');
      break;
    default:
      add('office', 'Documents, scheduling and the books, which every business needs.');
      break;
  }

  const services = (answers.services ?? []).map((service) => String(service).toLowerCase());
  const mentions = (...words: string[]) =>
    services.some((service) => words.some((word) => service.includes(word)));

  if (mentions('deliver', 'courier', 'cargo', 'freight', 'shipping')) {
    add('logistics', 'You listed deliveries, so this adds shipments, drivers and consignments.');
  }
  if (mentions('rent', 'tenant', 'letting', 'property')) {
    add('property', 'You listed rentals, so this adds units, tenants and rent collection.');
  }
  if (mentions('mobile money', 'payment', 'remittance', 'forex', 'bureau')) {
    add('finance', 'You listed payments, so this adds wallets, transfers and reconciliation.');
  }
  if (mentions('live sell', 'tiktok', 'instagram', 'social sell', 'content')) {
    add('creators', 'You listed selling on social, so this adds live selling and content tools.');
  }

  return planned;
}

const SALES_SUMMARY = (noun: string): Omit<PlannedAutomation, 'why'> => ({
  key: 'daily-sales-summary',
  name: 'Daily sales summary',
  objective:
    `Summarise today's ${noun}: total taken, number of transactions, and anything that looks unusual `
    + 'compared with the past week. Keep it to a few lines.',
  frequency: 'DAILY',
  // After close, so the day being summarised is finished.
  timeOfDay: '20:30',
});

/**
 * The recurring jobs worth proposing for this kind of business.
 *
 * Deliberately few. An owner who finds five unexplained agents running on
 * their data turns them all off, so each one here has to be something they
 * would have asked for: what did I take today, and what needs attention
 * tomorrow morning.
 *
 * All of them report and none of them act. A job that changed stock or prices
 * on a schedule is not something to switch on for someone during setup.
 */
export function automationsFor(answers: GuidedAnswers): PlannedAutomation[] {
  const type = normaliseBusinessType(answers.businessType);

  switch (type) {
    case 'shop':
      return [
        { ...SALES_SUMMARY('sales'), why: 'So you know what the shop took without opening a report.' },
        {
          key: 'low-stock-morning',
          name: 'Low stock before opening',
          objective:
            'List the products that are out of stock or nearly out, worst first, so they can be '
            + 'reordered today. Say nothing if everything is well stocked.',
          frequency: 'DAILY',
          // Before opening, while there is still time to reorder.
          timeOfDay: '07:00',
          why: 'So you reorder before you sell out, not after a customer asks.',
        },
      ];
    case 'hotel':
      return [
        {
          key: 'occupancy-morning',
          name: 'Occupancy and arrivals',
          objective:
            "Report today's occupancy, the arrivals and departures expected, and any room still "
            + 'marked uncleaned.',
          frequency: 'DAILY',
          timeOfDay: '07:00',
          why: 'So the front desk starts the day knowing who is coming and which rooms are ready.',
        },
        { ...SALES_SUMMARY('room and food revenue'), why: 'So you see the day take without opening a report.' },
      ];
    case 'restaurant':
      return [
        { ...SALES_SUMMARY('sales'), why: 'So you know what the kitchen took without opening a report.' },
        {
          key: 'menu-performance-weekly',
          name: 'Weekly menu performance',
          objective:
            'Rank menu items by how much they sold this week, and name the few that barely moved, '
            + 'so the menu can be adjusted.',
          frequency: 'WEEKLY',
          timeOfDay: '09:00',
          why: 'So the menu follows what people actually order.',
        },
      ];
    default:
      return [
        {
          key: 'business-health-weekly',
          name: 'Weekly business health',
          objective:
            'Summarise income and expenses for the week, with anything that changed sharply from '
            + 'the week before.',
          frequency: 'WEEKLY',
          timeOfDay: '09:00',
          why: 'A weekly read on the books, without building a report.',
        },
      ];
  }
}

/** The whole proposal for a set of interview answers. */
export function planFor(answers: GuidedAnswers): SetupPlan {
  return {
    businessType: normaliseBusinessType(answers.businessType),
    bundles: bundlesFor(answers),
    automations: automationsFor(answers),
    // The interview asks for a timezone, and these jobs run at a time of day,
    // so a wrong one would deliver the morning list in the afternoon.
    timezone: String(answers.timezone ?? '').trim() || DEFAULT_TIMEZONE,
  };
}

/**
 * Keep only what the owner ticked.
 *
 * An empty selection means they ticked nothing, which is a valid answer and
 * must not be read as "install everything". Unknown keys are dropped rather
 * than rejected, so a stale screen cannot install something that is no longer
 * offered.
 */
export function selectFromPlan(
  plan: SetupPlan,
  chosen: { bundleIds?: string[]; automationKeys?: string[] },
): { bundles: PlannedBundle[]; automations: PlannedAutomation[] } {
  const bundleIds = new Set(chosen.bundleIds ?? []);
  const automationKeys = new Set(chosen.automationKeys ?? []);
  return {
    bundles: plan.bundles.filter((bundle) => bundleIds.has(bundle.bundleId)),
    automations: plan.automations.filter((automation) => automationKeys.has(automation.key)),
  };
}
