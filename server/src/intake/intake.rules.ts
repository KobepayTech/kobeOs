/**
 * Guided catalogue intake.
 *
 * A merchant with 80 items photographs them, then faces a form 80 times. The
 * bulk upload that existed applied one price and one stock figure to every
 * image, which is only useful when the items are identical — so in practice
 * people uploaded one at a time anyway.
 *
 * This turns it into a conversation: upload everything, then answer two or
 * three questions per photo while looking at it. The photo is the prompt, so
 * nobody has to remember which item they are describing.
 *
 * Three kinds, because the same shape of work appears in all of them and the
 * questions differ:
 *
 *   SHOP_PRODUCT          a shelf item          size, price, stock
 *   RESTAURANT_MENU_ITEM  a dish                portion, price
 *   HOTEL_ROOM            a room                type, nightly rate, capacity
 *
 * Stock is deliberately absent for a dish and a room: a kitchen does not count
 * portions the way a shelf counts units, and a room's availability comes from
 * its bookings, not a quantity field. Asking anyway would invite a number
 * nothing reads.
 */

export const INTAKE_KINDS = ['SHOP_PRODUCT', 'RESTAURANT_MENU_ITEM', 'HOTEL_ROOM'] as const;
export type IntakeKind = (typeof INTAKE_KINDS)[number];

export type IntakeItemStatus = 'PENDING' | 'DONE' | 'SKIPPED' | 'FAILED';

export const MAX_IMAGES_PER_SESSION = 120;

export interface IntakeQuestion {
  /** Field the answer lands in. */
  field: string;
  /** Asked out loud, next to the photo. */
  prompt: string;
  type: 'text' | 'number' | 'integer' | 'choice';
  required: boolean;
  /** For 'choice'; also offered as suggestions for free text. */
  options?: string[];
  hint?: string;
}

const PRICE = (noun: string): IntakeQuestion => ({
  field: 'price',
  prompt: `What do you charge for this ${noun}?`,
  type: 'number',
  required: true,
  hint: 'Leave the currency out — your shop currency is used.',
});

/**
 * The questions for a kind, in the order they are asked.
 *
 * Name comes first and is required everywhere: a catalogue entry without a
 * name is unsellable and unsearchable, and the AI suggestion gives the person
 * something to accept rather than type.
 */
export function questionsFor(kind: IntakeKind): IntakeQuestion[] {
  switch (kind) {
    case 'RESTAURANT_MENU_ITEM':
      return [
        { field: 'name', prompt: 'What is this dish called?', type: 'text', required: true },
        {
          field: 'portion', prompt: 'What portion or size is this?', type: 'text', required: false,
          options: ['Single', 'Double', 'Half', 'Full', 'Small', 'Large'],
          hint: 'Skip it if there is only one size.',
        },
        PRICE('dish'),
        {
          field: 'category', prompt: 'Which part of the menu?', type: 'text', required: false,
          options: ['Starters', 'Mains', 'Grill', 'Sides', 'Drinks', 'Desserts'],
        },
      ];
    case 'HOTEL_ROOM':
      return [
        { field: 'name', prompt: 'What is this room number?', type: 'text', required: true },
        {
          field: 'roomType', prompt: 'What type of room is it?', type: 'text', required: true,
          options: ['Single', 'Double', 'Twin', 'Triple', 'Suite', 'Family'],
        },
        PRICE('room per night'),
        {
          field: 'capacity', prompt: 'How many guests can sleep here?', type: 'integer',
          required: false, hint: 'Two if you are not sure.',
        },
      ];
    case 'SHOP_PRODUCT':
    default:
      return [
        { field: 'name', prompt: 'What is this item called?', type: 'text', required: true },
        {
          field: 'size', prompt: 'What size or variant is this?', type: 'text', required: false,
          hint: 'Such as 500ml, Large, or UK 9. Skip it if there is only one.',
        },
        PRICE('item'),
        {
          field: 'stock', prompt: 'How many do you have?', type: 'integer', required: true,
          hint: 'Count what is on the shelf now.',
        },
        { field: 'category', prompt: 'What kind of item is it?', type: 'text', required: false },
      ];
  }
}

/**
 * One sellable combination of a product: a size, optionally a colour, with its
 * own price and count.
 *
 * A shelf holds "Shirt, blue, M" and "Shirt, red, L" as separate things to
 * sell, and a single price and stock figure per photo cannot express that. One
 * photo of a shirt becomes one product with several of these.
 */
export interface VariantAnswer {
  size: string;
  color?: string;
  price: number;
  stock: number;
}

export interface AnswerProblem { field: string; message: string }

/**
 * Check the variants on a shop answer.
 *
 * Every combination must be unique: two rows for "blue / M" are not two things
 * to sell, they are a mistake that would leave the till unable to say which
 * one a customer bought.
 */
export function validateVariants(raw: unknown): AnswerProblem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [{ field: 'variants', message: 'Variants must be a list.' }];
  if (raw.length > 50) return [{ field: 'variants', message: 'Keep it to 50 variants per photo.' }];

  const problems: AnswerProblem[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of raw.entries()) {
    const variant = (entry ?? {}) as Partial<VariantAnswer>;
    const size = String(variant.size ?? '').trim();
    const color = String(variant.color ?? '').trim();
    const where = `variants[${index}]`;

    if (!size && !color) {
      problems.push({ field: where, message: 'Give each variant a size or a colour.' });
      continue;
    }
    const key = `${color.toLowerCase()}|${size.toLowerCase()}`;
    if (seen.has(key)) {
      problems.push({ field: where, message: 'This size and colour is already listed.' });
      continue;
    }
    seen.add(key);

    const price = Number(variant.price);
    if (!Number.isFinite(price) || price < 0) {
      problems.push({ field: `${where}.price`, message: 'Enter a price for this variant.' });
    }
    const stock = Number(variant.stock);
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      problems.push({ field: `${where}.stock`, message: 'Enter a whole count for this variant.' });
    }
  }

  return problems;
}

/**
 * A discount reference is advice for staff, not a second price list, so it has
 * to sit below the price being charged. One at or above it is either a typo or
 * a discount that is not one.
 */
export function validateDiscount(price: unknown, discount: unknown): AnswerProblem[] {
  if (discount === undefined || discount === null || String(discount).trim() === '') return [];
  const value = Number(discount);
  if (!Number.isFinite(value) || value < 0) {
    return [{ field: 'discountPrice', message: 'Enter a number, or leave it blank.' }];
  }
  if (value >= Number(price)) {
    return [{ field: 'discountPrice', message: 'A discount reference has to be below the price.' }];
  }
  return [];
}

/**
 * Check the room numbers behind one photo.
 *
 * A photo is usually of a room *type*, and a hotel has several identical
 * rooms, so one photo becomes several rooms. The numbers have to be unique
 * within the batch: two rooms called 101 cannot both be booked.
 */
export function validateRoomNumbers(raw: unknown): AnswerProblem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [{ field: 'roomNumbers', message: 'Room numbers must be a list.' }];
  if (!raw.length) return [];
  if (raw.length > 100) return [{ field: 'roomNumbers', message: 'Keep it to 100 rooms per photo.' }];

  const numbers = raw.map((value) => String(value ?? '').trim());
  if (numbers.some((number) => !number)) {
    return [{ field: 'roomNumbers', message: 'Every room needs a number.' }];
  }
  const unique = new Set(numbers.map((number) => number.toLowerCase()));
  if (unique.size !== numbers.length) {
    return [{ field: 'roomNumbers', message: 'Two rooms cannot share a number.' }];
  }
  return [];
}

/**
 * Check a set of answers against the questions for a kind.
 *
 * Returns every problem rather than the first, so the person fixes one screen
 * once instead of being told about a second mistake after correcting the
 * first.
 */
export function validateAnswers(
  kind: IntakeKind,
  answers: Record<string, unknown>,
): AnswerProblem[] {
  const problems: AnswerProblem[] = [];

  for (const question of questionsFor(kind)) {
    const raw = answers?.[question.field];
    const missing = raw === undefined || raw === null || String(raw).trim() === '';

    if (missing) {
      if (question.required) problems.push({ field: question.field, message: `${question.prompt} This one is needed.` });
      continue;
    }

    if (question.type === 'number' || question.type === 'integer') {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        problems.push({ field: question.field, message: 'Enter a number.' });
      } else if (value < 0) {
        problems.push({ field: question.field, message: 'This cannot be negative.' });
      } else if (question.type === 'integer' && !Number.isInteger(value)) {
        problems.push({ field: question.field, message: 'Enter a whole number.' });
      }
    } else if (String(raw).trim().length > 180) {
      problems.push({ field: question.field, message: 'Keep this under 180 characters.' });
    }
  }

  if (kind === 'SHOP_PRODUCT') {
    problems.push(...validateVariants(answers?.variants));
    problems.push(...validateDiscount(answers?.price, answers?.discountPrice));
  }
  if (kind === 'HOTEL_ROOM') {
    problems.push(...validateRoomNumbers(answers?.roomNumbers));
  }

  return problems;
}

/**
 * Fold a size or portion into the name, so the catalogue shows "Soda 500ml"
 * rather than two entries both called "Soda".
 *
 * Done here rather than at the call site because every kind needs it and the
 * duplicate-name problem is the one people notice last, after the catalogue is
 * already full.
 */
export function displayName(kind: IntakeKind, answers: Record<string, unknown>): string {
  const base = String(answers?.name ?? '').trim();
  // A room is identified by its number, so nothing is folded in: "101 Large"
  // is not a room number, and its variant is the room type, kept separately.
  const variant = kind === 'HOTEL_ROOM' ? ''
    : String((kind === 'RESTAURANT_MENU_ITEM' ? answers?.portion : answers?.size) ?? '').trim();
  if (!base) return '';
  if (!variant || base.toLowerCase().includes(variant.toLowerCase())) return base;
  return `${base} ${variant}`;
}

export interface IntakeProgress {
  total: number;
  done: number;
  skipped: number;
  failed: number;
  remaining: number;
  complete: boolean;
}

export function progressOf(statuses: readonly IntakeItemStatus[]): IntakeProgress {
  const count = (status: IntakeItemStatus) => statuses.filter((s) => s === status).length;
  const done = count('DONE');
  const skipped = count('SKIPPED');
  const failed = count('FAILED');
  const remaining = count('PENDING');
  return {
    total: statuses.length,
    done,
    skipped,
    failed,
    remaining,
    // Failed items still need attention, so a session with one is not finished.
    complete: statuses.length > 0 && remaining === 0 && failed === 0,
  };
}

/**
 * Turn the AI's reading of a photo into prefilled answers.
 *
 * Only fields the model can actually see are taken. Price and stock are never
 * suggested: a wrong price that looks authoritative is worse than an empty
 * box, because it will be accepted without thinking and then sold at.
 */
export function suggestionToAnswers(
  kind: IntakeKind,
  suggestion: { name?: string; category?: string; sizes?: string[] } | null | undefined,
): Record<string, string> {
  if (!suggestion) return {};
  const answers: Record<string, string> = {};
  const name = String(suggestion.name ?? '').trim();
  if (name) answers.name = name.slice(0, 180);

  const category = String(suggestion.category ?? '').trim();
  if (category && kind !== 'HOTEL_ROOM') answers.category = category.slice(0, 180);

  const size = (suggestion.sizes ?? []).map((s) => String(s).trim()).find(Boolean);
  if (size) {
    if (kind === 'SHOP_PRODUCT') answers.size = size.slice(0, 180);
    else if (kind === 'RESTAURANT_MENU_ITEM') answers.portion = size.slice(0, 180);
  }
  return answers;
}
