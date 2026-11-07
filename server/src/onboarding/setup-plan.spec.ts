import {
  DEFAULT_TIMEZONE, automationsFor, bundlesFor, normaliseBusinessType, planFor, selectFromPlan,
} from './setup-plan';

const ids = (answers: Parameters<typeof bundlesFor>[0]) =>
  bundlesFor(answers).map((bundle) => bundle.bundleId);

describe('normaliseBusinessType', () => {
  it('accepts the three kinds the interview offers', () => {
    expect(normaliseBusinessType('shop')).toBe('shop');
    expect(normaliseBusinessType('HOTEL')).toBe('hotel');
    expect(normaliseBusinessType(' restaurant ')).toBe('restaurant');
  });

  it('treats anything else as other rather than guessing', () => {
    for (const value of ['saloon', '', undefined, null, 42]) {
      expect(normaliseBusinessType(value)).toBe('other');
    }
  });
});

describe('bundlesFor', () => {
  it('matches the business the owner described', () => {
    expect(ids({ businessType: 'shop' })).toEqual(['retail']);
    expect(ids({ businessType: 'hotel' })).toEqual(['hospitality']);
    expect(ids({ businessType: 'restaurant' })).toEqual(['restaurants']);
  });

  it('still proposes something useful for a business it has no category for', () => {
    expect(ids({ businessType: 'barber shop chain' })).toEqual(['office']);
  });

  it('adds a bundle for a service the owner listed', () => {
    expect(ids({ businessType: 'shop', services: ['Deliveries around town'] }))
      .toEqual(['retail', 'logistics']);
    expect(ids({ businessType: 'shop', services: ['We rent out two units'] }))
      .toEqual(['retail', 'property']);
    expect(ids({ businessType: 'shop', services: ['Mobile money agent'] }))
      .toEqual(['retail', 'finance']);
    expect(ids({ businessType: 'shop', services: ['Live selling on TikTok'] }))
      .toEqual(['retail', 'creators']);
  });

  it('adds each bundle once however many services imply it', () => {
    expect(ids({ businessType: 'shop', services: ['delivery', 'courier', 'freight'] }))
      .toEqual(['retail', 'logistics']);
  });

  it('does not add a paid bundle for a word that merely appears', () => {
    // Guessing wide puts charges on a list the owner never asked about, which
    // is the fastest way to make the whole plan untrustworthy.
    expect(ids({ businessType: 'shop', services: ['Friendly service', 'Fast'] })).toEqual(['retail']);
  });

  it('proposes a smaller plan for a half-finished interview, not a guessed one', () => {
    expect(ids({})).toEqual(['office']);
    expect(ids({ businessType: 'shop', services: [] })).toEqual(['retail']);
  });

  it('explains every bundle it proposes', () => {
    // A list the owner did not ask for is only trustworthy if each line says
    // why it is there.
    for (const type of ['shop', 'hotel', 'restaurant', 'other']) {
      for (const bundle of bundlesFor({ businessType: type, services: ['deliveries', 'rentals'] })) {
        expect(bundle.why.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('automationsFor', () => {
  it('gives a shop a sales summary and a stock warning', () => {
    const keys = automationsFor({ businessType: 'shop' }).map((a) => a.key);
    expect(keys).toEqual(['daily-sales-summary', 'low-stock-morning']);
  });

  it('gives a hotel its arrivals before the day starts', () => {
    const [first] = automationsFor({ businessType: 'hotel' });
    expect(first.key).toBe('occupancy-morning');
    expect(first.timeOfDay).toBe('07:00');
  });

  it('summarises the day after close, not during it', () => {
    // A summary written at midday describes half a day.
    for (const type of ['shop', 'hotel', 'restaurant']) {
      const summary = automationsFor({ businessType: type })
        .find((a) => a.key === 'daily-sales-summary');
      expect(Number(summary?.timeOfDay.slice(0, 2))).toBeGreaterThanOrEqual(18);
    }
  });

  it('warns about stock before opening, while there is time to reorder', () => {
    const stock = automationsFor({ businessType: 'shop' })
      .find((a) => a.key === 'low-stock-morning');
    expect(Number(stock?.timeOfDay.slice(0, 2))).toBeLessThanOrEqual(8);
  });

  it('proposes few enough that an owner will read them', () => {
    // Five unexplained agents running on someone's data get turned off as a
    // group, including the useful ones.
    for (const type of ['shop', 'hotel', 'restaurant', 'other']) {
      expect(automationsFor({ businessType: type }).length).toBeLessThanOrEqual(3);
      expect(automationsFor({ businessType: type }).length).toBeGreaterThan(0);
    }
  });

  it('only proposes jobs that report, never ones that act', () => {
    // A job that changed stock or prices on a schedule is not something to
    // switch on for someone during setup.
    for (const type of ['shop', 'hotel', 'restaurant', 'other']) {
      for (const automation of automationsFor({ businessType: type })) {
        expect(automation.objective).toMatch(/summar|report|list|rank/i);
        expect(automation.objective).not.toMatch(/\b(set|change|adjust|update|delete|refund)\b/i);
      }
    }
  });

  it('writes a valid time of day for every job', () => {
    for (const type of ['shop', 'hotel', 'restaurant', 'other']) {
      for (const automation of automationsFor({ businessType: type })) {
        expect(automation.timeOfDay).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      }
    }
  });

  it('explains every job it proposes', () => {
    for (const type of ['shop', 'hotel', 'restaurant', 'other']) {
      for (const automation of automationsFor({ businessType: type })) {
        expect(automation.why.length).toBeGreaterThan(20);
        expect(automation.name.length).toBeGreaterThan(4);
      }
    }
  });

  it('gives each job a distinct key, since the key is what gets ticked', () => {
    for (const type of ['shop', 'hotel', 'restaurant', 'other']) {
      const keys = automationsFor({ businessType: type }).map((a) => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('planFor', () => {
  it('carries the timezone from the interview, since these run at a time of day', () => {
    // A wrong timezone delivers the morning stock list in the afternoon.
    expect(planFor({ businessType: 'shop', timezone: 'Africa/Nairobi' }).timezone)
      .toBe('Africa/Nairobi');
  });

  it('falls back to a sensible timezone rather than an empty one', () => {
    expect(planFor({ businessType: 'shop' }).timezone).toBe(DEFAULT_TIMEZONE);
    expect(planFor({ businessType: 'shop', timezone: '  ' }).timezone).toBe(DEFAULT_TIMEZONE);
  });

  it('describes a whole workspace for a described business', () => {
    const plan = planFor({ businessType: 'hotel', services: ['Airport transfers'], timezone: 'Africa/Dar_es_Salaam' });
    expect(plan.businessType).toBe('hotel');
    expect(plan.bundles.length).toBeGreaterThan(0);
    expect(plan.automations.length).toBeGreaterThan(0);
  });
});

describe('selectFromPlan', () => {
  const plan = planFor({ businessType: 'shop', services: ['deliveries'] });

  it('keeps only what was ticked', () => {
    const chosen = selectFromPlan(plan, {
      bundleIds: ['retail'], automationKeys: ['low-stock-morning'],
    });
    expect(chosen.bundles.map((b) => b.bundleId)).toEqual(['retail']);
    expect(chosen.automations.map((a) => a.key)).toEqual(['low-stock-morning']);
  });

  it('treats nothing ticked as nothing wanted, not as everything', () => {
    // An owner who unticks the lot has answered; installing anyway would be
    // charging them for declining.
    expect(selectFromPlan(plan, {})).toEqual({ bundles: [], automations: [] });
    expect(selectFromPlan(plan, { bundleIds: [], automationKeys: [] }))
      .toEqual({ bundles: [], automations: [] });
  });

  it('ignores a choice the plan does not offer', () => {
    // A stale screen must not be able to install something withdrawn since.
    const chosen = selectFromPlan(plan, {
      bundleIds: ['retail', 'games'], automationKeys: ['low-stock-morning', 'make-me-coffee'],
    });
    expect(chosen.bundles.map((b) => b.bundleId)).toEqual(['retail']);
    expect(chosen.automations.map((a) => a.key)).toEqual(['low-stock-morning']);
  });

  it('keeps the explanation with the choice, so the confirmation can show it', () => {
    const chosen = selectFromPlan(plan, { bundleIds: ['logistics'] });
    expect(chosen.bundles[0].why).toMatch(/deliveries/i);
  });
});
