import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientSettingsOf,
  documentSelectorOf,
  needsRestart,
  providerChoiceOf,
  type ExtensionSettings,
} from "../src/settings.js";

const settings = (
  rewrite: Partial<ExtensionSettings["rewrite"]> = {},
): ExtensionSettings => ({
  enable: true,
  languages: ["markdown"],
  extends: "recommended",
  locale: "en-GB",
  rules: { "no-similes": "off" },
  debounceMs: 500,
  rewrite: {
    provider: "off",
    model: "",
    ollamaUrl: "http://127.0.0.1:11434",
    ...rewrite,
  },
});

describe("clientSettingsOf", () => {
  it("passes the rule config and turns the rewrite action on with a provider", () => {
    assert.deepEqual(clientSettingsOf(settings({ provider: "ollama" })), {
      config: {
        extends: "recommended",
        locale: "en-GB",
        rules: { "no-similes": "off" },
      },
      debounceMs: 500,
      rewrite: true,
    });
    assert.equal(clientSettingsOf(settings()).rewrite, false);
  });
});

describe("providerChoiceOf", () => {
  it("refuses while rewrites are off", () => {
    assert.equal(providerChoiceOf(settings(), undefined).ok, false);
  });

  it("asks for an Ollama model", () => {
    assert.equal(
      providerChoiceOf(settings({ provider: "ollama" }), undefined).ok,
      false,
    );
  });

  it("builds Ollama settings from the URL and model", () => {
    assert.deepEqual(
      providerChoiceOf(
        settings({ provider: "ollama", model: "qwen3:14b" }),
        undefined,
      ),
      {
        ok: true,
        provider: {
          kind: "ollama",
          model: "qwen3:14b",
          baseUrl: "http://127.0.0.1:11434",
        },
      },
    );
  });

  it("asks for the OpenRouter key before the model", () => {
    const choice = providerChoiceOf(settings({ provider: "openrouter" }), " ");
    assert.deepEqual(choice, {
      ok: false,
      problem: "Set your OpenRouter API key first.",
    });
  });

  it("builds OpenRouter settings with the stored key", () => {
    assert.deepEqual(
      providerChoiceOf(settings({ provider: "openrouter", model: "m" }), "sk"),
      { ok: true, provider: { kind: "openrouter", model: "m", apiKey: "sk" } },
    );
  });
});

describe("documentSelectorOf", () => {
  it("covers saved and untitled documents", () => {
    assert.deepEqual(documentSelectorOf(["markdown"]), [
      { scheme: "file", language: "markdown" },
      { scheme: "untitled", language: "markdown" },
    ]);
  });
});

describe("needsRestart", () => {
  it("restarts only when the enabled state or the languages change", () => {
    const base = settings();
    assert.equal(needsRestart(base, { ...base, debounceMs: 100 }), false);
    assert.equal(
      needsRestart(base, { ...base, languages: ["markdown", "latex"] }),
      true,
    );
    assert.equal(needsRestart(base, { ...base, enable: false }), true);
  });
});
