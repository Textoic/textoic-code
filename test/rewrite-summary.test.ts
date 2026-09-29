import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteAllSummary } from "../src/rewrite-summary.js";

const rewrite = (accepted: boolean, reason?: string) => ({
  original: "Old.",
  replacement: accepted ? "New." : "",
  accepted,
  ...(reason == null ? {} : { reason }),
  before: [1, 2],
  after: [],
});

describe("rewriteAllSummary", () => {
  it("offers the rewrites that passed and names the skipped ones", () => {
    const summary = rewriteAllSummary([
      rewrite(true),
      rewrite(false, "the model returned nothing"),
      rewrite(true),
    ]);
    assert.equal(summary.passed.length, 2);
    assert.equal(
      summary.message,
      "Rewrote 2 paragraphs: 4 problems before, 0 after. Skipped 1 paragraph whose rewrite did not pass (the model returned nothing).",
    );
  });

  it("says so when nothing passed or there was nothing to do", () => {
    assert.equal(
      rewriteAllSummary([rewrite(false, "offline")]).message,
      "No rewrite passed the check: offline.",
    );
    assert.equal(
      rewriteAllSummary([]).message,
      "Textoic found no issues to rewrite.",
    );
  });
});
