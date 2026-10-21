import { LalaIdentityService } from './lala-identity.service';
import { LalaPhoneChallenge } from './lala-phone-challenge.entity';
function setup() {
  let row: LalaPhoneChallenge | null = null;
  const repo = {
    findOneBy: jest.fn(async (where) => row && Object.entries(where).every(([k, v]) => (row as any)[k] === v) ? { ...row } : null),
    findOne: jest.fn(async () => row ? { ...row } : null),
    save: jest.fn(async (value) => { row = { ...value }; return row; }),
    update: jest.fn(async (_where, value) => { row = { ...row!, ...value }; }),
  };
  const tx = { getRepository: () => repo, query: jest.fn() };
  const ds = { getRepository: () => repo, transaction: async (fn: any) => fn(tx) };
  const sms = { sendSms: jest.fn(async (_phone: string, _message: string) => ({ ok: true })) };
  return { service: new LalaIdentityService(ds as any, sms as any), sms, code: () => sms.sendSms.mock.calls[0][1].match(/\b\d{6}\b/)![0] };
}
describe('Lala phone identity', () => {
  it('requires phone-bound proof and consumes SMS codes once', async () => {
    const { service, code } = setup();
    await expect(service.authorize('0712345678')).rejects.toThrow();
    await service.request('0712345678');
    const result = await service.verify('0712345678', code());
    expect(await service.authorize('+255712345678', result.phoneToken)).toBe('+255712345678');
    await expect(service.authorize('0755123456', result.phoneToken)).rejects.toThrow();
    await expect(service.verify('0712345678', code())).rejects.toThrow();
  });
  it('persists failed attempts and locks out after five failures', async () => {
    const { service, code } = setup();
    await service.request('0712345678');
    for (let i = 0; i < 5; i++) await expect(service.verify('0712345678', '000000')).rejects.toThrow();
    await expect(service.verify('0712345678', code())).rejects.toThrow();
  });
  it('fails closed on SMS delivery failure and enforces resend cooldown', async () => {
    const { service, sms } = setup(); sms.sendSms.mockResolvedValue({ ok: false });
    await expect(service.request('0712345678')).rejects.toThrow('SMS');
    await expect(service.request('0712345678')).rejects.toThrow('one minute');
  });
});
