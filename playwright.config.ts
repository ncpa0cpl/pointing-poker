import { defineConfig } from "@playwright/test";

const TEST_PORT = process.env.TEST_PORT ?? "6969";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `https://localhost:${TEST_PORT}`,
    browserName: "chromium",
    // the proxy terminates TLS with the repo's self-signed test certificate
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
  },
  reporter: [["list"]],
  // the test container must be running: bun run test:docker:up
});
