import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { turnsOf } from "../src/language-model-turns.js";

describe("turnsOf", () => {
  it("folds the system prompt into the first user turn", () => {
    assert.deepEqual(
      turnsOf([
        { role: "system", content: "Edit by the guide." },
        { role: "user", content: "The passage." },
      ]),
      [{ role: "user", content: "Edit by the guide.\n\nThe passage." }],
    );
  });

  it("keeps assistant turns and opens with the instructions when no user turn leads", () => {
    assert.deepEqual(
      turnsOf([
        { role: "system", content: "Rules." },
        { role: "assistant", content: "Ready." },
        { role: "user", content: "Go." },
      ]),
      [
        { role: "user", content: "Rules." },
        { role: "assistant", content: "Ready." },
        { role: "user", content: "Go." },
      ],
    );
  });

  it("passes a conversation without a system prompt through", () => {
    assert.deepEqual(turnsOf([{ role: "user", content: "Hi." }]), [
      { role: "user", content: "Hi." },
    ]);
  });
});
