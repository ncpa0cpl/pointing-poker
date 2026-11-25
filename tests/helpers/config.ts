/**
 * Test environment configuration. All test suites import from here.
 */
export const TEST_PORT = Number(process.env.TEST_PORT ?? 6969);
export const TEST_HTTP_PORT = Number(process.env.TEST_HTTP_PORT ?? 6968);
/** nginx terminates TLS; nothing reaches the app except through the proxy */
export const BASE_URL = `https://localhost:${TEST_PORT}`;
/** nginx's port 80 (redirect / 444 default-server behavior) */
export const HTTP_URL = `http://localhost:${TEST_HTTP_PORT}`;
/**
 * must be listed in the server's HOSTNAMES env for non-GET requests to pass;
 * the prod origin is used so the CORS checks behave like production
 */
export const ORIGIN = "https://pointingpoker.work";
export const WS_URL = `wss://localhost:${TEST_PORT}/ws/room`;

/** CA that signed the proxy's certificate; Bun needs it via NODE_EXTRA_CA_CERTS */
export const CA_CERT = new URL("../nginx/certs/ca.crt", import.meta.url).pathname;

export const SUITE_TIMEOUT = 30_000;
