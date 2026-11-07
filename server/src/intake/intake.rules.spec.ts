import {
  INTAKE_KINDS, MAX_IMAGES_PER_SESSION, displayName, progressOf, questionsFor,
  suggestionToAnswers, validateAnswers, validateDiscount, validateRoomNumbers,
  validateVariants, type IntakeItemStatus,
} from './intake.rules';

describe('questionsFor', () => {
  it('asks name, price and stock for a shelf item', () => {
    const fields = questionsFor('SHOP_PRODUCT').map((q) => q.field);
    expect(fields).toEqual(['name', 'size', 'price', 'stock', 'category']);
  });

  it('does not ask a kitchen to count portions', () => {
    // A kitchen does not track stock the way a shelf does; asking would invite
    // a number nothing reads.
    expect(questionsFor('RESTAURANT_MENU_ITEM').map((q) => q.field)).not.toContain('stock');
  });

  it('does not ask a hotel for stock, since bookings decide availability', () => {
    expect(questionsFor('HOTEL_ROOM').map((q) => q.field)).not.toContain('stock');
  });

  it('asks every kind for a name and a price', () => {
    for (const kind of INTAKE_KINDS) {
      const fields = questionsFor(kind).map((q) => q.field);
      expect(fields).toContain('name');
      expect(fields).toContain('price');
    }
  });

  it('requires a name everywhere, because an unnamed entry is unsellable', () => {
    for (const kind of INTAKE_KINDS) {
      const name = questionsFor(kind).find((q) => q.field === 'name');
      expect(name?.required).toBe(true);
    }
  });

  it('asks the name first, so the photo can be identified before anything else', () => {
    for (const kind of INTAKE_KINDS) {
      expect(questionsFor(kind)[0].field).toBe('name');
    }
  });

  it('phrases every question as something a person would be asked', () => {
    for (const kind of INTAKE_KINDS) {
      for (const question of questionsFor(kind)) {
        expect(question.prompt.length).toBeGreaterThan(8);
        expect(question.prompt.endsWith('?')).toBe(true);
      }
    }
  });
});

describe('validateAnswers', () => {
  const shop = (over: Record<string, unknown> = {}) =>
    validateAnswers('SHOP_PRODUCT', { name: 'Soda', price: 1500, stock: 10, ...over });

  it('accepts a complete answer', () => {
    expect(shop()).toEqual([]);
  });

  it('requires the required fields', () => {
    const problems = validateAnswers('SHOP_PRODUCT', {});
    expect(problems.map((p) => p.field)).toEqual(['name', 'price', 'stock']);
  });

  it('reports every problem at once', () => {
    // One screen, one correction. Being told about a second mistake after
    // fixing the first is how people abandon a form.
    const problems = validateAnswers('SHOP_PRODUCT', { name: '', price: 'abc', stock: -2 });
    expect(problems).toHaveLength(3);
  });

  it('treats whitespace as missing', () => {
    expect(shop({ name: '   ' }).map((p) => p.field)).toEqual(['name']);
  });

  it('rejects a negative price and a negative count', () => {
    expect(shop({ price: -1 }).map((p) => p.field)).toEqual(['price']);
    expect(shop({ stock: -1 }).map((p) => p.field)).toEqual(['stock']);
  });

  it('accepts a free price, since giveaways and samples exist', () => {
    expect(shop({ price: 0 })).toEqual([]);
  });

  it('accepts a decimal price but not a decimal count', () => {
    expect(shop({ price: 1500.5 })).toEqual([]);
    expect(shop({ stock: 2.5 }).map((p) => p.message)).toEqual(['Enter a whole number.']);
  });

  it('accepts zero stock, which is how a sold-out item is recorded', () => {
    expect(shop({ stock: 0 })).toEqual([]);
  });

  it('ignores an optional field left blank', () => {
    expect(shop({ size: '', category: undefined })).toEqual([]);
  });

  it('caps a runaway text field', () => {
    expect(shop({ size: 'x'.repeat(200) }).map((p) => p.field)).toEqual(['size']);
  });

  it('requires a room type for a hotel room', () => {
    const problems = validateAnswers('HOTEL_ROOM', { name: '101', price: 45000 });
    expect(problems.map((p) => p.field)).toEqual(['roomType']);
  });

  it('does not invent a stock problem for a dish', () => {
    expect(validateAnswers('RESTAURANT_MENU_ITEM', { name: 'Pilau', price: 8000 })).toEqual([]);
  });
});

describe('displayName', () => {
  it('folds the size into the name, so two sodas are distinguishable', () => {
    expect(displayName('SHOP_PRODUCT', { name: 'Soda', size: '500ml' })).toBe('Soda 500ml');
  });

  it('uses the portion for a dish', () => {
    expect(displayName('RESTAURANT_MENU_ITEM', { name: 'Pilau', portion: 'Full' })).toBe('Pilau Full');
  });

  it('does not repeat a size already in the name', () => {
    expect(displayName('SHOP_PRODUCT', { name: 'Soda 500ml', size: '500ml' })).toBe('Soda 500ml');
    expect(displayName('SHOP_PRODUCT', { name: 'Soda 500ML', size: '500ml' })).toBe('Soda 500ML');
  });

  it('returns the bare name when there is no variant', () => {
    expect(displayName('SHOP_PRODUCT', { name: 'Bucket' })).toBe('Bucket');
  });

  it('trims, and returns empty for no name at all', () => {
    expect(displayName('SHOP_PRODUCT', { name: '  Bucket  ' })).toBe('Bucket');
    expect(displayName('SHOP_PRODUCT', {})).toBe('');
  });

  it('ignores a size on a hotel room, which has a type instead', () => {
    expect(displayName('HOTEL_ROOM', { name: '101', size: 'Large' })).toBe('101');
  });
});

describe('progressOf', () => {
  const statuses = (...s: IntakeItemStatus[]) => s;

  it('counts each outcome', () => {
    const p = progressOf(statuses('DONE', 'DONE', 'SKIPPED', 'PENDING', 'FAILED'));
    expect(p).toMatchObject({ total: 5, done: 2, skipped: 1, failed: 1, remaining: 1 });
  });

  it('is complete when nothing is pending and nothing failed', () => {
    expect(progressOf(statuses('DONE', 'SKIPPED')).complete).toBe(true);
  });

  it('is not complete while something failed, since that needs attention', () => {
    expect(progressOf(statuses('DONE', 'FAILED')).complete).toBe(false);
  });

  it('is not complete with work still pending', () => {
    expect(progressOf(statuses('DONE', 'PENDING')).complete).toBe(false);
  });

  it('treats an empty session as not complete rather than finished', () => {
    // An upload that produced no items is a failure to report, not a success.
    expect(progressOf([]).complete).toBe(false);
  });
});

describe('suggestionToAnswers', () => {
  it('prefills what the model can see', () => {
    expect(suggestionToAnswers('SHOP_PRODUCT', {
      name: 'Blue cotton shirt', category: 'Clothing', sizes: ['L'],
    })).toEqual({ name: 'Blue cotton shirt', category: 'Clothing', size: 'L' });
  });

  it('never suggests a price or a stock figure', () => {
    // A wrong price that looks authoritative is worse than an empty box: it
    // gets accepted without thinking and then sold at.
    const answers = suggestionToAnswers('SHOP_PRODUCT', {
      name: 'Shirt', category: 'Clothing', sizes: ['L'],
    }) as Record<string, unknown>;
    expect(answers.price).toBeUndefined();
    expect(answers.stock).toBeUndefined();
  });

  it('puts a size under portion for a dish', () => {
    expect(suggestionToAnswers('RESTAURANT_MENU_ITEM', { name: 'Pilau', sizes: ['Full'] }))
      .toEqual({ name: 'Pilau', portion: 'Full' });
  });

  it('offers no category or size for a room', () => {
    expect(suggestionToAnswers('HOTEL_ROOM', { name: '101', category: 'Lodging', sizes: ['Large'] }))
      .toEqual({ name: '101' });
  });

  it('returns nothing when the model was unavailable', () => {
    // No AI must mean an empty form, not a blocked flow.
    expect(suggestionToAnswers('SHOP_PRODUCT', null)).toEqual({});
    expect(suggestionToAnswers('SHOP_PRODUCT', undefined)).toEqual({});
  });

  it('drops empty and whitespace suggestions rather than prefilling blanks', () => {
    expect(suggestionToAnswers('SHOP_PRODUCT', { name: '  ', category: '', sizes: ['', ' '] }))
      .toEqual({});
  });

  it('takes the first usable size when the model offers several', () => {
    expect(suggestionToAnswers('SHOP_PRODUCT', { name: 'Shirt', sizes: ['', 'M', 'L'] }).size).toBe('M');
  });

  it('caps a long suggestion so it cannot fail validation it caused', () => {
    const answers = suggestionToAnswers('SHOP_PRODUCT', { name: 'x'.repeat(500) });
    expect(validateAnswers('SHOP_PRODUCT', { ...answers, price: 1, stock: 1 })).toEqual([]);
  });
});

describe('session bounds', () => {
  it('caps a session, so one upload cannot become an endless queue', () => {
    expect(MAX_IMAGES_PER_SESSION).toBeGreaterThan(20);
    expect(MAX_IMAGES_PER_SESSION).toBeLessThanOrEqual(200);
  });
});

describe('validateVariants', () => {
  const ok = [{ size: 'M', color: 'Blue', price: 25000, stock: 4 }];

  it('accepts a list of distinct combinations', () => {
    expect(validateVariants([
      { size: 'M', color: 'Blue', price: 25000, stock: 4 },
      { size: 'L', color: 'Red', price: 27000, stock: 2 },
    ])).toEqual([]);
  });

  it('accepts no variants at all, which is the common case', () => {
    expect(validateVariants(undefined)).toEqual([]);
    expect(validateVariants([])).toEqual([]);
  });

  it('rejects the same size and colour twice', () => {
    // Two rows for "blue / M" are not two things to sell; they leave the till
    // unable to say which one a customer bought.
    const problems = validateVariants([ok[0], { size: 'm', color: 'blue', price: 1, stock: 1 }]);
    expect(problems.map((p) => p.field)).toEqual(['variants[1]']);
  });

  it('accepts a size with no colour, and a colour with no size', () => {
    expect(validateVariants([{ size: 'M', price: 1, stock: 1 }])).toEqual([]);
    expect(validateVariants([{ size: '', color: 'Blue', price: 1, stock: 1 }])).toEqual([]);
  });

  it('requires a size or a colour to tell variants apart', () => {
    expect(validateVariants([{ size: '  ', color: '', price: 1, stock: 1 }])
      .map((p) => p.field)).toEqual(['variants[0]']);
  });

  it('requires a usable price and a whole count on each', () => {
    expect(validateVariants([{ size: 'M', price: -1, stock: 1 }])
      .map((p) => p.field)).toEqual(['variants[0].price']);
    expect(validateVariants([{ size: 'M', price: 1, stock: 1.5 }])
      .map((p) => p.field)).toEqual(['variants[0].stock']);
  });

  it('refuses a list that is not a list, and caps a runaway one', () => {
    expect(validateVariants('blue').map((p) => p.field)).toEqual(['variants']);
    const many = Array.from({ length: 51 }, (_, i) => ({ size: `S${i}`, price: 1, stock: 1 }));
    expect(validateVariants(many).map((p) => p.field)).toEqual(['variants']);
  });
});

describe('validateDiscount', () => {
  it('accepts a reference below the price', () => {
    expect(validateDiscount(10000, 8000)).toEqual([]);
  });

  it('accepts none, since most products have none', () => {
    expect(validateDiscount(10000, undefined)).toEqual([]);
    expect(validateDiscount(10000, '')).toEqual([]);
  });

  it('refuses one at or above the price', () => {
    // A discount reference is advice for staff, not a second price list. One
    // at or above the price is a typo or not a discount.
    expect(validateDiscount(10000, 10000).map((p) => p.field)).toEqual(['discountPrice']);
    expect(validateDiscount(10000, 12000).map((p) => p.field)).toEqual(['discountPrice']);
  });

  it('refuses a non-number', () => {
    expect(validateDiscount(10000, 'cheap').map((p) => p.field)).toEqual(['discountPrice']);
  });
});

describe('validateRoomNumbers', () => {
  it('accepts a batch of distinct numbers', () => {
    expect(validateRoomNumbers(['101', '102', '103'])).toEqual([]);
  });

  it('accepts none, which makes one room from the answer', () => {
    expect(validateRoomNumbers(undefined)).toEqual([]);
    expect(validateRoomNumbers([])).toEqual([]);
  });

  it('refuses two rooms sharing a number', () => {
    // Two rooms called 101 cannot both be booked.
    expect(validateRoomNumbers(['101', '101']).map((p) => p.field)).toEqual(['roomNumbers']);
    expect(validateRoomNumbers(['101', ' 101 ']).map((p) => p.field)).toEqual(['roomNumbers']);
  });

  it('refuses a blank number', () => {
    expect(validateRoomNumbers(['101', '  ']).map((p) => p.field)).toEqual(['roomNumbers']);
  });

  it('caps a runaway batch', () => {
    expect(validateRoomNumbers(Array.from({ length: 101 }, (_, i) => String(i)))
      .map((p) => p.field)).toEqual(['roomNumbers']);
  });
});

describe('validateAnswers with the ported fields', () => {
  it('checks variants and discounts on a shop answer', () => {
    const problems = validateAnswers('SHOP_PRODUCT', {
      name: 'Shirt', price: 10000, stock: 5,
      discountPrice: 20000,
      variants: [{ size: 'M', price: 1, stock: 1 }, { size: 'M', price: 1, stock: 1 }],
    });
    expect(problems.map((p) => p.field)).toEqual(
      expect.arrayContaining(['discountPrice', 'variants[1]']),
    );
  });

  it('checks room numbers on a hotel answer', () => {
    expect(validateAnswers('HOTEL_ROOM', {
      name: '101', roomType: 'Twin', price: 50000, roomNumbers: ['101', '101'],
    }).map((p) => p.field)).toEqual(['roomNumbers']);
  });

  it('does not apply shop checks to a dish', () => {
    // A kitchen has no variant matrix and no discount reference.
    expect(validateAnswers('RESTAURANT_MENU_ITEM', {
      name: 'Pilau', price: 8000, discountPrice: 99999, variants: 'nonsense',
    })).toEqual([]);
  });
});
