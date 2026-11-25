import { $ } from "bun";
import { BASE_URL } from "./config";

const COMPOSE_FILE = "docker-compose.test.yml";

let ensurePromise: Promise<void> | undefined;

async function compose(...args: string[]): Promise<void> {
  const proc = await $`docker compose -f ${COMPOSE_FILE} ${args}`.quiet().nothrow();
  if (proc.exitCode !== 0) {
    throw new Error(
      `docker compose ${args.join(" ")} failed:\n${proc.stderr.toString()}\n${proc.stdout.toString()}`,
    );
  }
}

export async function waitForReadiness(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = undefined;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/stats`);
      if (res.ok) {
        return;
      }
      lastErr = new Error(`status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready: ${lastErr}`);
}

async function isContainerRunning(): Promise<boolean> {
  const proc = await $`docker inspect -f {{.State.Running}} pointing-poker-test`
    .quiet().nothrow();
  return proc.exitCode === 0 && proc.stdout.toString().trim() === "true";
}

/**
 * Starts the test container (building the image if needed) and waits until
 * the server responds. Idempotent — safe to call from every test suite.
 */
export async function ensureServer(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      if (process.env.SKIP_DOCKER) {
        await waitForReadiness();
        return;
      }
      if (await isContainerRunning()) {
        await waitForReadiness();
        return;
      }
      await compose("up", "-d", "--build", "--wait");
      await waitForReadiness();
    })().catch((e) => {
      ensurePromise = undefined;
      throw e;
    });
  }
  return ensurePromise;
}

/**
 * `docker compose restart` — preserves container filesystem
 * (persisted rooms survive).
 */
export async function restartServer(): Promise<void> {
  await compose("restart");
  await waitForReadiness();
}

/**
 * Recreates the container from scratch — wipes the container filesystem
 * (persistent storage, logs) and re-runs the image.
 */
export async function recreateServer(): Promise<void> {
  await compose("down", "--timeout", "5");
  await compose("up", "-d", "--build", "--wait");
  await waitForReadiness();
}

export async function teardownServer(): Promise<void> {
  await compose("down", "--timeout", "5");
}
