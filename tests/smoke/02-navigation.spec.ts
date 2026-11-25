import { expect, test } from "@playwright/test";

/**
 * Navigation smoke tests:
 * 1. `/` leads to the registration page for new users and to the join page
 *    (create/join forms) once a username is set.
 * 2. `/about` renders its content.
 * 3. Joining a nonexistent room id lands on a graceful
 *    "room not found" / "room closed" state instead of crashing.
 */

test.beforeEach(async ({ request }) => {
  // Safety net: make sure the dockerized server is reachable.
  const res = await request.get("/api/stats");
  expect(res.ok()).toBe(true);
});

test("join page renders create/join forms after registration", async ({
  page,
}) => {
  // Fresh browser context: no user yet, so `/` redirects to /register.
  await page.goto("/");
  const usernameInput = page.locator("#username");
  await expect(usernameInput).toBeVisible({ timeout: 10_000 });
  await usernameInput.fill("Carol");
  await page.getByRole("button", { name: "Start Playing" }).click();

  // Join page with both forms.
  await page.waitForURL(/\/join/, { timeout: 10_000 });
  await expect(
    page.getByRole("button", { name: "Create a new Room" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText("Join existing Room"),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Room ID")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
});

test("about page renders its content", async ({ page }) => {
  await page.goto("/about");

  await expect(
    page.getByRole("heading", { name: "What is Pointing Poker?" }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByText(
      "Pointing Poker is a simple way to estimate the work needed to complete a task.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How to Start Playing" }),
  ).toBeVisible();
});

test("nonexistent room id shows a graceful not-found state", async ({
  page,
}) => {
  // Without a stored user the room route first redirects to /register.
  await page.goto("/room?roomID=this-room-does-not-exist-123");
  const usernameInput = page.locator("#username");
  await expect(usernameInput).toBeVisible({ timeout: 10_000 });
  await usernameInput.fill("Dora");
  await page.getByRole("button", { name: "Start Playing" }).click();

  // After registering, the client attempts to connect to the (nonexistent)
  // room. The server answers with a room-closed message and the client
  // routes to the graceful state page (either the "room closed" or the
  // "room not found" copy is acceptable).
  const gracefulState = page.getByText(
    /Room with the specified ID could not be found\.|Room you were in has been closed by the host\./,
  );
  await expect(gracefulState).toBeVisible({ timeout: 15_000 });

  // The page remains functional: the user can go back to the join page.
  await page
    .getByRole("button", { name: "Join other Room" })
    .click({ timeout: 10_000 });
  await expect(
    page.getByRole("button", { name: "Create a new Room" }),
  ).toBeVisible({ timeout: 10_000 });
});
