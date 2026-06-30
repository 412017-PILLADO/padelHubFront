import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra el stack real. Pre-requisitos antes de correr `npx playwright test`:
 *   1. MySQL arriba (docker compose up -d en padelBack) — idealmente reseteado (scripts/reset-demo).
 *   2. Backend en :8090  →  PORT=8090 ./mvnw spring-boot:run  (con DB_URL al MySQL :3308).
 *   3. El front lo levanta este config (webServer) si no está ya corriendo.
 *
 * Tenancy por host: la reserva pública vive en demo.localhost:4200 y el panel en localhost:4200.
 * `allowedHosts: ['.localhost']` ya está en angular.json.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4400',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Puerto 4400: el 4200/4300 los ocupan otros proyectos del entorno. No reusar un server ajeno.
  webServer: {
    command: 'npm start -- --port 4400 --host localhost',
    url: 'http://localhost:4400',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
