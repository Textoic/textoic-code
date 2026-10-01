import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appliedMessage,
  modeChoicesFor,
  nothingToApply,
} from "../src/apply-all-model.js";

describe("modeChoicesFor", () => {
  it("offers both modes when there are fixes, leftovers and a model", () => {
    assert.deepEqual(
      modeChoicesFor(3, 2, true).map(({ mode }) => mode),
      ["fixes", "fixesAndRewrites"],
    );
  });

  it("offers only the fixes when rewrites are off or nothing is left", () => {
    assert.deepEqual(
      modeChoicesFor(3, 2, false).map(({ mode }) => mode),
      ["fixes"],
    );
    assert.deepEqual(
      modeChoicesFor(3, 0, true).map(({ mode }) => mode),
      ["fixes"],
    );
  });

  it("offers only the rewrite when no rule has a fix", () => {
    assert.deepEqual(
      modeChoicesFor(0, 4, true).map(({ mode }) => mode),
      ["fixesAndRewrites"],
    );
  });
});

describe("messages", () => {
  it("names the count and the scope", () => {
    assert.equal(appliedMessage(1, "this file"), "Applied 1 fix in this file.");
    assert.equal(
      nothingToApply("“dirty”", 0),
      "Textoic found nothing to apply in “dirty”.",
    );
  });
});
