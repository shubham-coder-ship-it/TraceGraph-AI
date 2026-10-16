import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5173";
const options = {
  headless: true,
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
};
if (process.env.CHROMIUM_RUNTIME_MODULE) {
  const { default: runtime } = await import(
    process.env.CHROMIUM_RUNTIME_MODULE
  );
  options.executablePath = await runtime.executablePath();
  options.args = runtime.args;
}
const browser = await chromium.launch(options);
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let passed = 0;
const check = (name) => console.log("PASS graph " + ++passed + ": " + name);
const viewport = () =>
  page
    .locator(".react-flow__viewport")
    .getAttribute("transform")
    .then(
      async (t) =>
        t ||
        (await page
          .locator(".react-flow__viewport")
          .evaluate((el) => el.style.transform)),
    );
async function stableViewport() {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let previous = "",
          stable = 0;
        function tick() {
          const next =
            document
              .querySelector(".react-flow__viewport")
              ?.getAttribute("style") || "";
          stable = next === previous ? stable + 1 : 0;
          previous = next;
          if (stable >= 8) resolve(null);
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
  );
}
async function fitted() {
  await page.waitForFunction(() => {
    const flow = document.querySelector(".react-flow");
    if (!flow) return false;
    const canvas = flow.getBoundingClientRect(),
      nodes = [...document.querySelectorAll(".react-flow__node")];
    return (
      nodes.length > 0 &&
      nodes.every((n) => {
        const r = n.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.left >= canvas.left - 2 &&
          r.right <= canvas.right + 2 &&
          r.top >= canvas.top - 2 &&
          r.bottom <= canvas.bottom + 2
        );
      })
    );
  });
  await stableViewport();
}
async function geometry() {
  return page.locator(".react-flow__node").evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        id: n.getAttribute("data-id"),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    }),
  );
}
function noOverlap(nodes) {
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i],
        b = nodes[j];
      assert.ok(
        a.x + a.width <= b.x + 0.5 ||
          b.x + b.width <= a.x + 0.5 ||
          a.y + a.height <= b.y + 0.5 ||
          b.y + b.height <= a.y + 0.5,
        `${a.id} overlaps ${b.id}`,
      );
    }
}
async function readableContext() {
  await page.waitForFunction(() => {
    const canvas = document
      .querySelector(".react-flow")
      ?.getBoundingClientRect();
    if (!canvas) return false;
    return [
      "INC-1001",
      "SVC-CHECKOUT",
      "DEP-104",
      "INC-0932",
      "RES-0932",
    ].every((id) => {
      const node = document.querySelector(`.react-flow__node[data-id="${id}"]`);
      if (!node) return false;
      const r = node.getBoundingClientRect();
      return (
        r.width >= 167 &&
        r.left >= canvas.left - 2 &&
        r.right <= canvas.right + 2 &&
        r.top >= canvas.top - 2 &&
        r.bottom <= canvas.bottom + 2
      );
    });
  });
  await stableViewport();
}
async function screenshot(name) {
  if (process.env.UI_SCREENSHOTS)
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/" + name + ".png",
      fullPage: true,
    });
}
try {
  const returnedNodes = new Set(),
    returnedEdges = new Set(),
    pending = [];
  const collect = (response) => {
    if (
      response.ok() &&
      new URL(response.url()).pathname.startsWith("/api/graph")
    )
      pending.push(
        response.json().then((g) => {
          g.nodes?.forEach((n) => returnedNodes.add(n.id));
          g.edges?.forEach((e) => returnedEdges.add(e.id));
        }),
      );
  };
  page.on("response", collect);
  await page.route("**/api/graph?*", async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ response });
  });
  await page.goto(base + "/graph");
  await readableContext();
  await Promise.all(pending);
  assert.deepEqual(
    (await geometry()).map((n) => n.id).sort(),
    [...returnedNodes].sort(),
  );
  assert.deepEqual(
    (
      await page
        .locator(".react-flow__edge")
        .evaluateAll((es) => es.map((e) => e.getAttribute("data-id")))
    ).sort(),
    [...returnedEdges].sort(),
  );
  noOverlap(await geometry());
  check(
    "default viewport loads readable incident context while retaining every returned node and edge",
  );
  await screenshot("graph-readable-default");
  page.off("response", collect);
  await page.unroute("**/api/graph?*");
  const identitiesBefore = (await geometry()).map((n) => n.id).sort();
  await page
    .getByRole("button", { name: "Show full graph", exact: true })
    .click();
  await fitted();
  assert.deepEqual(
    (await geometry()).map((n) => n.id).sort(),
    identitiesBefore,
  );
  check("Show full graph reveals all loaded records without deleting context");
  await page
    .getByRole("button", { name: "Center investigation", exact: true })
    .click();
  await readableContext();
  check("Center investigation restores a readable viewport");
  await page.getByLabel("Focus node ID").fill("INC-1001");
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        new URL(r.url()).pathname.endsWith("/graph/neighborhood/INC-1001"),
    ),
    page.getByRole("button", { name: "Focus graph", exact: true }).click(),
  ]);
  assert.equal(response.status(), 200);
  const graph = await response.json();
  await readableContext();
  assert.deepEqual(
    (await geometry()).map((n) => n.id).sort(),
    graph.nodes.map((n) => n.id).sort(),
  );
  for (const id of ["INC-1001", "SVC-CHECKOUT", "DEP-104"])
    assert.ok(
      (
        await page
          .locator(`.react-flow__node[data-id="${id}"]`)
          .getAttribute("class")
      ).includes("graph-primary"),
    );
  for (const id of ["INC-0932", "RES-0932"])
    assert.ok(
      (
        await page
          .locator(`.react-flow__node[data-id="${id}"]`)
          .getAttribute("class")
      ).includes("graph-historical"),
    );
  assert.ok(graph.nodes.some((n) => n.label === "Memory"));
  const temporal = page.locator(".graph-edge-temporal");
  assert.ok((await temporal.count()) > 0);
  assert.match(await temporal.first().textContent(), /TRIGGERED_AFTER/);
  assert.match(
    await temporal
      .first()
      .locator(".react-flow__edge-path")
      .getAttribute("style"),
    /stroke-dasharray/,
  );
  await page.getByText(/timing does not establish cause/).waitFor();
  noOverlap(await geometry());
  check(
    "focused primary nodes are highlighted; temporal, historical and memory roles remain distinct",
  );
  await screenshot("graph-readable-focus");
  await page.locator('.react-flow__node[data-id="RES-0932"]').click();
  await page.locator(".node-details").waitFor();
  assert.match(await page.locator(".node-details").innerText(), /Rollback/);
  await page.getByRole("button", { name: "Close details" }).click();
  const resolutionEdge = page
    .locator(".react-flow__edge")
    .filter({
      has: page
        .locator(".react-flow__edge-text")
        .filter({ hasText: /^RESOLVES$/ }),
    })
    .first();
  await resolutionEdge.locator(".react-flow__edge-textbg").click();
  await page.locator(".node-details").waitFor();
  assert.match(await page.locator(".node-details").innerText(), /RESOLVES/);
  await page.getByRole("button", { name: "Close details" }).click();
  check(
    "historical resolution properties and relationships remain inspectable",
  );
  // Supporting edges remain present/clickable even when their labels are deemphasized.
  assert.ok((await page.locator(".graph-edge-memory").count()) > 0);
  await page
    .getByRole("button", { name: "Show full graph", exact: true })
    .click();
  await fitted();
  const memoryNode = graph.nodes.find((n) => n.label === "Memory");
  await page.locator(`.react-flow__node[data-id="${memoryNode.id}"]`).click();
  await page.locator(".node-details").waitFor();
  assert.match(
    await page.locator(".node-details").innerText(),
    new RegExp(memoryNode.id),
  );
  await page.getByRole("button", { name: "Close details" }).click();
  check("secondary memory records stay accessible in the full canvas");
  await page
    .getByRole("button", { name: "Center investigation", exact: true })
    .click();
  await readableContext();
  await page.locator(".react-flow__controls-zoomin").click();
  await stableViewport();
  const zoomed = await viewport();
  await page.locator('.react-flow__node[data-id="SVC-CHECKOUT"]').click();
  await page.locator(".node-details").waitFor();
  await stableViewport();
  assert.equal(await viewport(), zoomed);
  await page.getByRole("button", { name: "Close details" }).click();
  const blank = await page.evaluate(() => {
    const r = document.querySelector(".react-flow").getBoundingClientRect();
    for (let y = r.bottom - 80; y > r.top + 100; y -= 25)
      for (let x = r.left + 100; x < r.right - 220; x += 30)
        if (
          document
            .elementFromPoint(x, y)
            ?.classList.contains("react-flow__pane")
        )
          return { x, y };
    return null;
  });
  assert.ok(blank);
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 65, blank.y - 35, { steps: 8 });
  await page.mouse.up();
  await stableViewport();
  const panned = await viewport();
  assert.notEqual(panned, zoomed);
  await page.getByLabel("Focus node ID").fill("INC-1001 (not submitted)");
  await stableViewport();
  assert.equal(await viewport(), panned);
  check("inspection and ordinary rerenders preserve manual zoom and pan");
  const [filterResponse] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "GET" &&
        new URL(r.url()).pathname.endsWith("/api/graph") &&
        new URL(r.url()).searchParams.get("label") === "Service",
    ),
    page.getByLabel("Node label filter").selectOption("Service"),
  ]);
  const filterGraph = await filterResponse.json();
  await page.waitForFunction(
    (ids) =>
      JSON.stringify(
        [...document.querySelectorAll(".react-flow__node")]
          .map((n) => n.getAttribute("data-id"))
          .sort(),
      ) === JSON.stringify(ids),
    filterGraph.nodes.map((n) => n.id).sort(),
  );
  await stableViewport();
  assert.ok(
    (await page.locator(".react-flow__node small").allTextContents()).every(
      (s) => s === "SERVICE",
    ),
  );
  noOverlap(await geometry());
  check("node-type filter remains intact");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await readableContext();
  assert.equal(await page.getByLabel("Node label filter").inputValue(), "");
  assert.equal(await page.getByLabel("Focus node ID").inputValue(), "");
  check("Reset restores the useful default incident context");
  const stress = Array.from({ length: 80 }, (_, i) => ({
    id: "EV-layout-" + i,
    label: "Evidence",
    properties: {
      id: "EV-layout-" + i,
      title: "Long evidence title from a UI-only layout fixture",
    },
  }));
  await page.route("**/api/graph?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ nodes: stress, edges: [], truncated: false }),
    }),
  );
  await page.getByLabel("Node label filter").selectOption("Evidence");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".react-flow__node").length === 80 &&
      !!document.querySelector('[data-id="EV-layout-0"]'),
  );
  await stableViewport();
  assert.ok((await geometry()).some((n) => n.width >= 167));
  await page
    .getByRole("button", { name: "Show full graph", exact: true })
    .click();
  await fitted();
  assert.equal((await geometry()).length, 80);
  noOverlap(await geometry());
  check(
    "dense same-type data starts readable and remains fully accessible via overview",
  );
  await screenshot("graph-full-evidence-overview");
  assert.deepEqual(errors, []);
  check("no browser runtime errors");
  console.log("Graph UI checks: " + passed + " passed");
} finally {
  await browser.close();
}
