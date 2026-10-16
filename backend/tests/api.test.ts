import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { Repository } from "../src/repository.js";
import { DatabaseError } from "../src/db.js";
test("API reports database failure as 503 rather than zero counts", async () => {
  const server = createApp(
    new Repository(async () => {
      throw new DatabaseError("Database unavailable");
    }),
  ).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  try {
    const { port } = server.address() as { port: number };
    for (const path of ["/api/health", "/api/overview"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 503);
      const data = await response.json();
      assert.equal(data.database, "disconnected");
      assert.equal(data.nodeCount, undefined);
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
