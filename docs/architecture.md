# Architecture and findings: textoic-code

The only place in this repository for prose about the code. Newest entries at
the top, dated, one finding each.

## Log

### 2026-09-30, "Apply all" asks the server for the fixes and applies them itself

The server's code actions carry `textoic.applyAll` with a scope (a case, a
rule, or `{}` for the file). The command asks `enlint/fixAll` for the edits,
offers "Fixes only" and, when a rewrite provider is set and some issues have
no exact fix, "Fixes, then AI rewrites", then applies the edits as one
`WorkspaceEdit` so a single undo takes them back. The rewrite step reuses
"Rewrite all issues" with the same scope; the language client sends the
pending `didChange` before the next request, so the server rewrites the text
with the fixes already in. The quick pick lives in `apply-all.ts`; the
choices and messages live in `apply-all-model.ts`, which does not import
`vscode`, so the tests reach them.

### 2026-09-29, the Issues panel is a tree view in the secondary side bar

`contributes.viewsContainers.secondarySidebar` became a stable contribution
point in VS Code 1.106, so `engines.vscode` is now `^1.106.0`. A tree view
rather than a webview: it takes the theme, keyboard and screen reader support
for free, and inline `view/item/context` buttons carry the per-issue actions.
The view reads the Textoic diagnostics from `languages.getDiagnostics`; the
language client keeps each diagnostic's `data`, which holds the rule and the
case. The "in view" mode follows `onDidChangeTextEditorVisibleRanges`,
debounced by 150 ms. `src/issue-model.ts` holds the grouping and filtering
without importing `vscode`, so the tests reach it.

Ignored instances live in `workspaceState` under the document URI and travel
to the server as `ignoredInstances` in the client settings. Workspace state
fits the request that they stay local; they do not follow the file to other
machines.

Checked in a real VS Code: the view container registers, focusing and
toggling the view and switching modes run without errors, and "Ignore this
instance" on the second of two "very dirty" in one line removes only that
diagnostic.

### 2026-09-29, rewrite all issues shares the single rewrite's preview

The server's `enlint/rewriteAll` does the work for Ollama and OpenRouter and
sends `enlint/rewriteProgress` after each paragraph; the extension turns that
into the progress notification's increments. For the `vscode` provider the
extension runs enlint-lsp's `rewriteDocument` itself, as it does for a single
rewrite. Either way the rewrites that passed become one `Proposal` with one
edit per paragraph, so the diff, the stale check and Apply are the same code
as for one paragraph. Rejected paragraphs are left out and named in the
prompt. `src/rewrite-summary.ts` holds the wording and does not import
`vscode`, so the tests reach it.

Checked in a real VS Code with qwen3.8 through Ollama on a CRLF file with two
flagged paragraphs and a clean one: the code action is listed, and the diff
opened after 10 s with both flagged paragraphs rewritten and the clean one
unchanged.

### 2026-09-29, rewrites open as a diff, not in the Refactor Preview

An edit applied with `needsConfirmation` reaches the Refactor Preview
unticked: VS Code's bulk edit preview calls
`checked.updateChecked(edit, !edit.metadata?.needsConfirmation)`. The preview
showed the old paragraph struck through with no new text, and Apply applied
nothing. The rewrite now opens `vscode.diff` between the file and a
`textoic-rewrite:` document holding the whole file with the paragraph
replaced, asks Apply or Discard in a notification, closes the diff, and
applies a plain `WorkspaceEdit`. It checks the paragraph for changes before
opening the diff and again before applying.

The OpenRouter key is read from secret storage only when OpenRouter is the
provider.

Checked in a real VS Code with `--extensionTestsPath` and qwen3.8 through
Ollama: the diff opened with the rewritten paragraph and nothing else changed,
on LF and CRLF files. A test there cannot click a notification button,
because each extension gets its own `vscode` API object, so Apply was not
exercised end to end.

### 2026-09-29, a code action's command must return at once

VS Code shows a code action as running until its command settles. The first
rewrite command awaited the model, then a warning with a "Preview anyway"
button, then the refactor preview, which settles only when the user applies
or discards it. With qwen3.8 every rewrite came back empty and rejected, so
the command sat on a warning the progress spinner hid, and the rewrite looked
stuck forever. The command now starts the rewrite and returns. The rewrite
runs behind a cancellable progress notification whose token reaches the
server as an LSP cancellation, and the preview opens after it finishes.

### 2026-09-29, the "vscode" provider runs the rewrite in the extension host

`vscode.lm` exists only in the extension host, so the language server cannot
call it. For this provider the extension runs enlint-lsp's `rewritePassage`
itself, with `lint` backed by the server's `enlint/lintText` request (the
document's URI, so project config applies) and `complete` backed by
`LanguageModelChat.sendRequest`. The language model API has no system role,
so `turnsOf` folds the system prompt into the first user turn.

The quick-fix menu's sparkle "Fix" is `CodeAction.isAI`, a proposed API that
Marketplace extensions cannot enable. Routing the rewrite through the same
models is the closest the stable API allows.

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
