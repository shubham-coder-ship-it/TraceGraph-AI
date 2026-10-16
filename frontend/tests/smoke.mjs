import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5173";
const launchOptions = {
  headless: true,
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
};
if (process.env.CHROMIUM_RUNTIME_MODULE) {
  const { default: runtime } = await import(
    process.env.CHROMIUM_RUNTIME_MODULE
  );
  launchOptions.executablePath = await runtime.executablePath();
  launchOptions.args = runtime.args;
}
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let passed = 0;
function check(name) {
  console.log("PASS " + ++passed + ": " + name);
}
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Connect the dots. Find the cause." })
    .waitFor();
  await page.getByText("FalkorDB connected", { exact: true }).waitFor();
  await page
    .locator(".metric")
    .first()
    .locator("strong")
    .filter({ hasText: /\S+/ })
    .waitFor();
  check("overview uses seeded API counts and live health");
  if (process.env.UI_SCREENSHOTS)
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/overview.png",
      fullPage: true,
    });
  await page
    .locator("nav")
    .getByText("Investigations", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run investigation", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Checkout API elevated latency",
      exact: true,
    })
    .waitFor();
  await page
    .getByText("Investigation and episodic memory saved to FalkorDB.", {
      exact: true,
    })
    .waitFor();
  check("real investigation renders and saves");
  await page.getByRole("button", { name: /^Evidence/ }).click();
  const historical = page
    .locator(".evidence-card")
    .filter({ hasText: "historical" })
    .first();
  await historical.locator("summary").click();
  assert.match(await historical.innerText(), /priorIncident|priorResolution/);
  check("evidence shows populated historical fields");
  await page
    .getByRole("button", { name: "Memory & feedback", exact: true })
    .click();
  await page
    .getByLabel("Memory type", { exact: true })
    .selectOption("procedural");
  await page
    .getByLabel("Evidence source", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Memory content")
    .fill(
      "Compare checkout latency percentiles and deployment diff before proposing remediation.",
    );
  const [memoryResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/memory"),
    ),
    page.getByRole("button", { name: "Save memory", exact: true }).click(),
  ]);
  assert.equal(memoryResponse.status(), 201, "Procedural memory save failed");
  const createdMemory = await memoryResponse.json();
  assert.equal(typeof createdMemory.id, "string", "Saved memory must have an ID");
  assert.ok(createdMemory.id.length > 0, "Saved memory ID must not be empty");
  assert.equal(createdMemory.type, "procedural");
  await page
    .getByText("Sourced memory saved for review.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Useful", exact: true }).click();
  await page.getByText("Feedback saved: useful", { exact: true }).waitFor();
  check("sourced procedural memory and feedback save");
  await page.locator("nav").getByText("Agent Memory", { exact: true }).click();
  await page.getByRole("button", { name: "procedural", exact: true }).click();
  const memoryCard = page.locator(".memory-card").filter({
    has: page.getByText(createdMemory.id, { exact: true }),
  });
  await memoryCard.waitFor();
  assert.equal(await memoryCard.count(), 1, "Expected the saved memory's exact card");
  await memoryCard.getByText("procedural", { exact: true }).waitFor();
  const reviewButton = memoryCard.getByRole("button", {
    name: "Mark reviewed",
    exact: true,
  });
  const reviewedBadge = memoryCard.locator(".badge.green").filter({
    hasText: /^reviewed$/,
  });
  if (await reviewButton.isDisabled()) {
    // MERGE can return an existing memory whose reviewed status is preserved.
    await reviewedBadge.waitFor();
  } else {
    const [reviewResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname.endsWith(`/memory/${createdMemory.id}`),
      ),
      // Playwright waits for the exact button to be enabled and actionable.
      reviewButton.click(),
    ]);
    assert.equal(reviewResponse.status(), 200, "Memory review failed");
    const reviewedMemory = await reviewResponse.json();
    assert.equal(reviewedMemory.id, createdMemory.id);
    assert.equal(reviewedMemory.status, "reviewed");
    await reviewedBadge.waitFor();
  }
  assert.equal(await reviewButton.isDisabled(), true);
  await page.reload();
  await page.getByRole("button", { name: "procedural", exact: true }).click();
  await reviewedBadge.waitFor();
  assert.equal(await reviewButton.isDisabled(), true);
  check("memory review survives reload");
  await page.goto(base + "/investigations?incident=INC-1001");
  const [investigationResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/investigations"),
    ),
    page.getByRole("button", { name: "Run investigation", exact: true }).click(),
  ]);
  assert.equal(investigationResponse.status(), 201, "Investigation rerun failed");
  const rerunReport = await investigationResponse.json();
  assert.equal(rerunReport.incidentId, "INC-1001");
  assert.ok(Array.isArray(rerunReport.memoriesRetrieved));
  assert.ok(
    rerunReport.memoriesRetrieved.some((memory) => memory.id === createdMemory.id),
    `Investigation ${rerunReport.id} did not retrieve procedural memory ${createdMemory.id}`,
  );
  await page
    .getByRole("heading", {
      name: "Checkout API elevated latency",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Memory & feedback", exact: true })
    .click();
  await page
    .getByText(
      `${rerunReport.memoriesRetrieved.length} prior memories retrieved · ${rerunReport.memoriesCreated.length} episodic memory saved`,
      { exact: true },
    )
    .waitFor();
  check("later investigation retrieves prior graph memory");
  await page.goto(base + "/investigations");
  await page.locator(".saved-button").first().click();
  await page
    .getByRole("heading", {
      name: "Checkout API elevated latency",
      exact: true,
    })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", {
      name: "Checkout API elevated latency",
      exact: true,
    })
    .waitFor();
  check("saved investigation restores by URL after reload");
  await page
    .locator("nav")
    .getByText("Graph Explorer", { exact: true })
    .click();
  await page.locator(".react-flow__node").first().waitFor();
  await page.getByRole("textbox", { name: "Focus node ID" }).fill("INC-1001");
  await page.getByRole("button", { name: "Focus graph", exact: true }).click();
  await page
    .locator(".react-flow__node")
    .filter({ hasText: "SVC-CHECKOUT" })
    .first()
    .click();
  await page.locator(".node-details").waitFor();
  assert.match(await page.locator(".node-details").innerText(), /Checkout API/);
  await page.locator(".react-flow__controls-zoomin").click();
  check("graph focus, node inspection and zoom work");
  if (process.env.UI_SCREENSHOTS)
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/graph.png",
      fullPage: true,
    });
  await page.locator("nav").getByText("Runbooks", { exact: true }).click();
  await page.getByLabel("Search runbooks").fill("NO-SUCH-RUNBOOK");
  await page.getByText("No records found", { exact: true }).waitFor();
  await page.getByLabel("Search runbooks").fill("checkout");
  await page
    .getByRole("heading", { name: "Investigate checkout latency" })
    .waitFor();
  check("runbooks search and empty state work");
  await page.locator("nav").getByText("Settings", { exact: true }).click();
  await page
    .getByText("Connected · verified by query", { exact: true })
    .waitFor();
  check("system settings displays verified health");
  await page.goto(base + "/investigations");
  await page
    .getByRole("button", { name: /Report a new synthetic incident/ })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Synthetic notification backlog");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Unverified synthetic report of notification queue delay.");
  await page
    .getByLabel("Affected service", { exact: true })
    .selectOption("SVC-NOTIFY");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create unverified report", exact: true })
    .click();
  await page
    .getByText(
      "Unverified synthetic report created. Run an investigation to gather evidence.",
    )
    .waitFor();
  assert.match(
    await page
      .getByRole("textbox", { name: "Incident ID", exact: true })
      .inputValue(),
    /^INC-USER-/,
  );
  check("controlled synthetic intake creates unverified report");
  await page.route("**/api/overview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Test database unavailable",
        database: "disconnected",
      }),
    }),
  );
  await page.goto(base);
  await page
    .getByRole("alert")
    .filter({ hasText: "Test database unavailable" })
    .waitFor();
  assert.equal(await page.locator(".metric").count(), 0);
  check("simulated failure renders error with no fabricated counts");
  await page.unroute("**/api/overview");
  await page.route("**/api/memory?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto(base + "/memory");
  await page.getByText("No records found", { exact: true }).waitFor();
  check("simulated empty memory renders empty state");
  await page.unroute("**/api/memory?*");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.locator(".metric").first().waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  check("mobile overview has no horizontal overflow");
  if (process.env.UI_SCREENSHOTS)
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/mobile.png",
      fullPage: true,
    });
  assert.deepEqual(errors, []);
  check("no browser runtime errors");
  console.log(`UI smoke checks: ${passed} passed`);
} finally {
  await browser.close();
}
