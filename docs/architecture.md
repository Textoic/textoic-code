# Architecture and findings: textoic-code

The only place in this repository for prose about the code. Newest entries at
the top, dated, one finding each.

## Log

### 2026-09-27, the extension is a thin client; the server is enlint-lsp, bundled

Linting, config resolution, code actions and the rewrite pipeline live in
`@textoic/enlint-lsp`, shared with the desktop app and textoic.com. This
extension starts that server over stdio, forwards `textoic.*` settings to it,
and implements the three commands its code actions carry: ignore a case, turn
off a rule, rewrite a passage. Only the client knows where settings live, so
the commands write user settings and the settings change pushes a
`workspace/didChangeConfiguration`.

`scripts/build.mjs` bundles two files. `dist/extension.js` is CommonJS because
VS Code loads extensions with `require`. `dist/server.mjs` is ESM because
enlint-lsp is, and it gets a `require` shim because `vscode-languageserver` is
CommonJS inside an ESM bundle. The server starts with `--data dist/data`, which
holds artisan's `dictionary.json` and `weights.json`; the bundle never calls
`import.meta.resolve`, which cannot find a package inside a `.vsix`.
`test/server-bundle.test.ts` runs the built server over stdio to catch a
broken bundle before VS Code does.

The package has no `"type"`, so `.js` means CommonJS for VS Code, while
`src/package.json` and `test/package.json` mark those folders as ESM for tsx
and the Node test runner. Node 23 refused to run the tests without them
(`ERR_REQUIRE_CYCLE_MODULE`).

### 2026-09-27, ignore and turn-off edits write only the user's global value

`workspace.getConfiguration().get("rules")` returns the merge of user and
workspace values. Writing that merge back to the user scope would copy a
repository's settings into every other project. The edits read
`inspect("rules").globalValue`, change it, and write it back. Project-wide
choices belong in `textoic.config.json`.

### 2026-09-27, rewrites open in the refactor preview

A rewrite replaces a whole paragraph, and a model can change more than the
problems asked for. The edit carries `needsConfirmation`, so VS Code shows the
diff and the user accepts or discards it. A rewrite the server rejected (empty,
cut off, out of proportion, or with more problems) needs a second click,
"Preview anyway", with the reason shown.
