import { Module } from '@nestjs/common';
import { BeemService } from './beem.service';

/**
 * BeemService lives in its own module so there is exactly one instance of it.
 *
 * It used to be listed in the `providers` of four modules — notifications,
 * customer-portal, mzigo and push — which gives Nest four separate instances.
 * Nothing broke at runtime (the client is stateless), but anything that
 * substitutes the provider through DI reaches only one of them. That is how
 * the Lala OTP e2e tests failed: `app.get(BeemService)` returns the LAST
 * registered instance, so the spy landed on Mzigo's copy while
 * LalaIdentityService held the notifications copy, the real sendSms ran with
 * no credentials, and phone verification answered 503.
 *
 * PushModule cannot import NotificationsModule (NotificationsModule imports
 * PushModule), so the shared provider needs a leaf module of its own.
 */
@Module({
  providers: [BeemService],
  exports: [BeemService],
})
export class BeemModule {}
