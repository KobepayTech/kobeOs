import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { bootTestApp } from './setup';

/**
 * Scheduled jobs must not run during e2e.
 *
 * A @Cron that fires mid-suite queries the DataSource teardown is closing,
 * TypeORM logs the failure, and jest turns a log after the run into
 * "Cannot log after tests are done" and exits 1 — so a run with every test
 * passing still fails, intermittently, depending on whether a minute
 * boundary happened to land inside the suite. That is exactly how
 * CameraService.checkOfflineCameras failed a release whose 139 tests all
 * passed.
 *
 * bootTestApp drains the registry. This pins that it actually does, so the
 * flake cannot come back by someone registering a new @Cron.
 */
describe('Scheduled jobs are quiesced in e2e', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });

  const isRunning = (job: unknown): boolean => {
    const j = job as { running?: boolean; isActive?: boolean };
    // `running` on cron v2, `isActive` on v3.
    return j.running === true || j.isActive === true;
  };

  it('registers cron jobs but leaves none of them running', () => {
    const registry = app.get(SchedulerRegistry, { strict: false });
    const jobs = [...registry.getCronJobs().entries()];

    // If this is ever 0 the test has stopped proving anything — either the
    // app no longer schedules work, or the registry moved.
    expect(jobs.length).toBeGreaterThan(0);

    const stillRunning = jobs.filter(([, job]) => isRunning(job)).map(([name]) => name);
    expect(stillRunning).toEqual([]);
  });

  it('leaves no intervals or timeouts armed', () => {
    const registry = app.get(SchedulerRegistry, { strict: false });
    expect(registry.getIntervals()).toEqual([]);
    expect(registry.getTimeouts()).toEqual([]);
  });
});
