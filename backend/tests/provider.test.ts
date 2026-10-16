import { test } from "node:test";
import assert from "node:assert/strict";
import { rank, buildHypotheses } from "../src/engine.js";
import { config } from "../src/config.js";
test("keyless operation and failed or fabricated provider rankings fall back safely", async () => {
  const previous = config.key,
    original = globalThis.fetch;
  const hypotheses = buildHypotheses([]);
  try {
    config.key = undefined;
    assert.equal((await rank(hypotheses, [])).mode, "deterministic");
    config.key = "unit-test-only";
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    assert.match((await rank(hypotheses, [])).note, /fallback/);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: '{"ids":["invented-hypothesis"]}' } },
          ],
        }),
      );
    assert.equal((await rank(hypotheses, [])).mode, "deterministic");
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ids":["H1"]}' } }],
        }),
      );
    assert.equal((await rank(hypotheses, [])).mode, "LLM-assisted");
  } finally {
    config.key = previous;
    globalThis.fetch = original;
  }
});
