import { expect, it } from 'vitest';
import { isExpectedOAuthMessage } from './oauth-flow';

it.each(['google', 'meta', 'tiktok'] as const)('accepts the hosted %s callback from the opened signup window', provider => {
  const popup = {} as Window;
  const event = { origin: 'https://kobeos-app.pages.dev', source: popup, data: { type: 'kobeos-oauth-complete', provider, accessToken: 'access', refreshToken: 'refresh' } };
  expect(isExpectedOAuthMessage(event, popup, provider)).toBe(true);
  expect(isExpectedOAuthMessage({ ...event, source: {} as Window }, popup, provider)).toBe(false);
  expect(isExpectedOAuthMessage({ ...event, origin: 'https://kobeos-app.pages.dev.attacker.example' }, popup, provider)).toBe(false);
  expect(isExpectedOAuthMessage({ ...event, data: { ...event.data, provider: 'other' } }, popup, provider)).toBe(false);
  expect(isExpectedOAuthMessage({ ...event, data: { ...event.data, refreshToken: '' } }, popup, provider)).toBe(false);
});
