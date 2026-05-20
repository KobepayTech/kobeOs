/**
 * global-setup.ts — runs once before all test suites, before any module imports.
 * Sets environment variables that NestJS config validation requires.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

export default async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '.env.test') });
}
