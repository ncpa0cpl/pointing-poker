import { expect, test, type Page } from "@playwright/test";

/**
 * Full happy-path game:
 * 1. Owner registers a username and creates a room.
 * 2. A second user (separate browser context = separate localStorage) joins
 *    via the room URL.
 * 3. Both vote ("8" and "5"), the owner finishes the round and the results
 *    become visible to both players.
 * 4. The owner starts a new round and a second voting round completes.
 */

test.beforeEach(async ({ request }) => {
  // Safety net: make sure the dockerized server is reachable before driving
  // the UI (the container is normally started via `bun run test:docker:up`).
  const res = await request.get("/api/stats");
  expect(res.ok()).toBe(true);
});

/** Create a room from the join page, retrying on transient server errors. */
async function createRoom(page: Page): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    // The "Create a new Room" button is disabled until the websocket to the
    // server is open — poll instead of sleeping.
    const createRoomBtn = page.getByRole("button", {
      name: "Create a new Room",
    });
    await expect(createRoomBtn).toBeVisible({ timeout: 10_000 });
    await expect(createRoomBtn).toBeEnabled({ timeout: 15_000 });
    await createRoomBtn.click();

    try {
      // The room URL format is /room?roomID=<id>.
      await page.waitForURL(/\/room\?roomID=/, { timeout: 15_000 });
      const roomID = new URL(page.url()).searchParams.get("roomID");
      if (roomID) return roomID;
    } catch {
      // Transient failures route to an error page with a "Home" button.
      const homeBtn = page.getByRole("button", { name: "Home" });
      if (await homeBtn.isVisible().catch(() => false)) {
        await homeBtn.click();
        await page.waitForURL(/\/join/, { timeout: 10_000 });
        continue;
      }
    }
  }
  throw new Error("Room could not be created after 3 attempts.");
}

test("full game: create room, join, vote, finish round, next round", async ({
  browser,
}) => {
  // --- Owner registers and creates a room ---------------------------------
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  await ownerPage.goto("/");

  // Without a stored user, `/` redirects to the registration page.
  const usernameInput = ownerPage.locator("#username");
  await expect(usernameInput).toBeVisible({ timeout: 10_000 });
  await usernameInput.fill("Alice");
  await ownerPage.getByRole("button", { name: "Start Playing" }).click();

  // After registering the user lands on the join page.
  await ownerPage.waitForURL(/\/join/, { timeout: 10_000 });

  const roomID = await createRoom(ownerPage);

  // The room ID display mirrors the roomID from the URL.
  await expect(ownerPage.locator(".room-id-display input")).toHaveValue(
    roomID,
    { timeout: 10_000 },
  );

  // The websocket round state is loaded once the "?" vote option shows up
  // (the loading skeleton only renders options 0,1,2,3,5,8,13).
  const ownerVoteBtn = ownerPage.getByRole("button", {
    name: "8",
    exact: true,
  });
  await expect(
    ownerPage.getByRole("button", { name: "?", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(ownerVoteBtn).toBeEnabled({ timeout: 10_000 });

  // The owner sees themselves in the participants list.
  await expect(ownerPage.locator(".participants")).toContainText(
    "Alice",
    { timeout: 10_000 },
  );

  // --- Second user joins via the room URL ---------------------------------
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();

  // Direct navigation to the room page redirects to /register?roomID=...
  // when no username is stored yet.
  await playerPage.goto(`/room?roomID=${roomID}`);
  await playerPage.waitForURL(/\/register\?roomID=/, { timeout: 10_000 });

  const playerUsername = playerPage.locator("#username");
  await expect(playerUsername).toBeVisible({ timeout: 10_000 });
  await playerUsername.fill("Bob");
  await playerPage.getByRole("button", { name: "Start Playing" }).click();

  await playerPage.waitForURL(/\/room\?roomID=/, { timeout: 10_000 });
  await expect(
    playerPage.getByRole("button", { name: "?", exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  const playerVoteBtn = playerPage.getByRole("button", {
    name: "5",
    exact: true,
  });
  await expect(playerVoteBtn).toBeEnabled({ timeout: 10_000 });

  // Both players are listed for both users.
  await expect(playerPage.locator(".participants")).toContainText(
    "Alice",
    { timeout: 10_000 },
  );
  await expect(playerPage.locator(".participants")).toContainText("Bob");
  await expect(ownerPage.locator(".participants")).toContainText("Bob");

  // --- Round 1: both vote --------------------------------------------------
  await ownerVoteBtn.click();
  await playerVoteBtn.click();

  // Owner finishes the round; results become visible.
  await ownerPage
    .getByRole("button", { name: "Show Results" })
    .click({ timeout: 10_000 });

  // Votes {8, 5} -> votes count 2, mean/median 6.50 (server rounds to 2
  // decimals). Statistics is the default results tab.
  const ownerStats = ownerPage.locator(".statistics");
  await expect(ownerStats).toBeVisible({ timeout: 10_000 });
  await expect(
    ownerStats.getByText("2", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(ownerStats.getByText("6.50").first()).toBeVisible();

  // Vote buttons are disabled once the round is finished (both players).
  await expect(ownerVoteBtn).toBeDisabled({ timeout: 10_000 });
  await expect(playerVoteBtn).toBeDisabled({ timeout: 10_000 });

  // The results propagate to the second player as well.
  const playerStats = playerPage.locator(".statistics");
  await expect(playerStats.getByText("2", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  // --- Round 2 -------------------------------------------------------------
  await ownerPage
    .getByRole("button", { name: "Start Next Round" })
    .click({ timeout: 10_000 });

  // Vote buttons re-enable once the new round is in progress.
  await expect(ownerVoteBtn).toBeEnabled({ timeout: 10_000 });
  await expect(playerVoteBtn).toBeEnabled({ timeout: 10_000 });

  await playerVoteBtn.click();
  await ownerVoteBtn.click();

  await ownerPage
    .getByRole("button", { name: "Show Results" })
    .click({ timeout: 10_000 });

  await expect(
    playerPage.locator(".statistics").getByText("2", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    playerPage.locator(".statistics").getByText("6.50").first(),
  ).toBeVisible({ timeout: 10_000 });

  await ownerContext.close();
  await playerContext.close();
});
