import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BeemService } from '../src/notifications/beem.service';
export async function verifiedLalaPhone(app: INestApplication, phone: string) {
  let code = '';
  const spy = jest.spyOn(app.get(BeemService), 'sendSms').mockImplementationOnce(async (_phone, message) => {
    code = message.match(/\b\d{6}\b/)![0]; return { ok: true };
  });
  try {
    await request(app.getHttpServer()).post('/api/lala-public/phone/request').send({ phone }).expect(201);
    const result = await request(app.getHttpServer()).post('/api/lala-public/phone/verify').send({ phone, code }).expect(201);
    return result.body.phoneToken as string;
  } finally { spy.mockRestore(); }
}
