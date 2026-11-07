import { deriveTitle } from './ai-chat.service';

describe('assistant conversation titles', () => {
  it('uses a short opening message as the title', () => {
    expect(deriveTitle('How many rooms are free tonight?')).toBe('How many rooms are free tonight?');
  });

  it('collapses whitespace so a pasted message still reads as one line', () => {
    expect(deriveTitle('  How many   rooms\nare free?  ')).toBe('How many rooms are free?');
  });

  it('names an empty conversation rather than leaving it blank', () => {
    expect(deriveTitle('')).toBe('New conversation');
    expect(deriveTitle('   ')).toBe('New conversation');
  });

  it('cuts a long message at a word boundary, not mid-word', () => {
    const long = 'Please summarise the hotel occupancy for every room type across the last quarter';
    const title = deriveTitle(long);
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(61);
    // The cut must not leave a half-word before the ellipsis.
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
    expect(title.slice(0, -1).trimEnd()).toBe(title.slice(0, -1));
  });

  it('still truncates when there is no space to cut back to', () => {
    const title = deriveTitle('x'.repeat(200));
    expect(title.length).toBe(61);
    expect(title.endsWith('…')).toBe(true);
  });
});
