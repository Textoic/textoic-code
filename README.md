# Textoic for VS Code

Textoic lints English prose in your Markdown and plain-text files as you type,
the way eslint lints code. It flags clichés, filler, hedges, passives, "very
X" where a stronger word exists, and words that give away machine-written
text. Where a rule has a replacement, it offers it as a quick fix.

It runs on your machine. The rules come from
[enlint](https://github.com/Textoic/enlint), the parser from
[artisan](https://github.com/Textoic/artisan), and the language server from
[enlint-lsp](https://github.com/Textoic/enlint-lsp). Nothing leaves VS Code
unless you ask for an AI rewrite.

## Install

Until the extension is on the Marketplace, download `textoic-code-<version>.vsix`
from the [latest release](https://github.com/Textoic/textoic-code/releases/latest)
and run `code --install-extension textoic-code-<version>.vsix`, or use
*Extensions: Install from VSIX…* in the command palette.

## What you get

- **Problems as you type.** The file is linted when it opens and again 750 ms
  after you stop typing. Only the paragraphs you changed are parsed again.
- **Quick fixes** for every replacement a rule offers (`Ctrl+.` on the
  squiggle).
- **An Issues panel** on the right, in the secondary side bar (**Textoic:
  Toggle Issues Panel** opens and closes it). The eye button in its title bar
  switches between two views: the issues in the part of the file you can
  see, which follows you as you scroll, and every issue grouped by rule, the
  biggest group first. Collapse a group, or turn its rule off from the
  group's row. Each issue has buttons to rewrite it with AI, ignore that one
  instance, ignore the case everywhere, or turn the rule off.
- **Ignore one instance.** *Ignore this instance* in the quick fixes or the
  Issues panel hides that problem in that sentence of that file, and nowhere
  else. Textoic keeps the list in the workspace, and it lapses when you edit
  the sentence. **Textoic: Restore Ignored Instances in This File** brings
  them back.
- **Ignore one case.** "very dirty" keeps suggesting "filthy" and you want
  "very dirty"? Choose *Ignore "dirty" everywhere* from the quick fixes.
  The rest of the rule keeps working. This works for the three rules built
  from lists: bad words, "very X" and "not X".
- **Turn a rule off** from the same menu, or pick severities with
  **Textoic: Manage Rules**, which shows each rule's description and examples
  and lets you tick the cases to ignore.
- **AI rewrites** through the language models VS Code already has (GitHub
  Copilot's, or any provider you added to the Chat view), a local model in
  [Ollama](https://ollama.com), or a hosted one through
  [OpenRouter](https://openrouter.ai). Textoic sends the
  paragraph and the problems in it, along with its style guide, then lints the answer. A
  rewrite that comes back empty, cut off, far longer or shorter, or with more
  problems than it started with is flagged before you see it. Every rewrite
  opens as a diff, and nothing changes until you apply it.
- **Apply all** from the quick fixes (for one case such as "dirty", for a
  rule, or for the whole file), from the check-all button on a rule or case in
  the Issues panel and at its top, or with **Textoic: Apply All Fixes…**. Pick
  **Fixes only** to apply every exact fix the rules offer in one undoable
  edit, or **Fixes, then AI rewrites** to apply them and then rewrite the
  parts that still have issues with the model.
- **Rewrite all issues at once** with **Rewrite all issues with AI** in the
  editor's context menu or the command palette. Textoic packs the paragraphs
  with problems into parts of about 500 words, rewrites each part, checks each
  answer on its own, and shows the ones that passed in a single diff. It skips
  a part whose rewrite failed the check and tells you why.

### Rewrites and VS Code's own "Fix"

The sparkle **Fix** in the quick-fix menu belongs to GitHub Copilot, not to
Textoic. VS Code keeps that slot for AI actions through an API that only
Microsoft's own extensions may use, so Textoic cannot put its rewrite there.
Set `textoic.rewrite.provider` to `vscode` instead: **Rewrite this passage
with AI** then runs on the same model Copilot uses, with Textoic's style guide
and the problems in the paragraph, and the linter checks the answer before
you see it. VS Code asks once for your consent to let Textoic use the model.

A rewrite runs in the background. Cancel it from its progress notification.
When it finishes, a diff opens with the rewrite on the right, and a prompt
asks whether to apply it. Nothing changes until you pick **Apply**.

## Settings

| Setting                     | Default                   | What it does                                            |
| --------------------------- | ------------------------- | ------------------------------------------------------- |
| `textoic.enable`            | `true`                    | Lint at all                                             |
| `textoic.languages`         | `["markdown","plaintext"]`| Language ids to lint                                    |
| `textoic.extends`           | `recommended`             | Start from enlint's defaults, or `all` rules            |
| `textoic.locale`            | `en-US`                   | The dialect `no-mixed-dialects` enforces                |
| `textoic.rules`             | `{}`                      | Per-rule severity and ignored cases (see below)         |
| `textoic.debounceMs`        | `750`                     | Delay after the last keystroke                          |
| `textoic.rewrite.provider`  | `off`                     | `vscode`, `ollama`, `openrouter`, or `off`              |
| `textoic.rewrite.model`     | `""`                      | The model; **Textoic: Choose Rewrite Model** lists them |
| `textoic.rewrite.ollamaUrl` | `http://127.0.0.1:11434`  | Your Ollama server                                      |

Store the OpenRouter key in VS Code's secret storage through **Textoic:
Set-OpenRouter-API-Key**, never in `settings.json`.

`textoic.rules` uses eslint's shape:

```json
"textoic.rules": {
  "no-passive-sentences": "off",
  "no-high-lexical-density": "info",
  "no-explained-intensifiers": ["warn", { "ignore": ["dirty"] }]
}
```

### Project config

Commit a `textoic.config.json` (or `.textoicrc.json`) to share settings with a
team. Textoic reads the nearest one above each file and applies it on top of
your user settings; VS Code validates it as you edit it.

```json
{
  "extends": "recommended",
  "locale": "en-GB",
  "rules": { "no-mixed-dialects": "warn" }
}
```

The [enlint plugin for Claude Code and Codex](https://github.com/Textoic/textoic-skill)
reads the same file, so the agents stop flagging what you told the editor to
ignore.

## Commands

- **Textoic: Manage Rules**: severities, descriptions, examples, ignored cases
- **Textoic: Rewrite Selection with AI** (also in the editor's context menu)
- **Textoic: Rewrite All Issues with AI** (also in the editor's context menu)
- **Textoic: Toggle Issues Panel**
- **Textoic: Restore Ignored Instances in This File**
- **Textoic: Choose Rewrite Model**
- **Textoic: Set-OpenRouter-API-Key**
- **Textoic: Lint Current File Now**
- **Textoic: Restart Language Server**

## Development

```sh
npm install
npm run build     # bundles the extension and the server into dist/
npm test          # includes a test that runs the bundled server over stdio
npm run package   # builds textoic-code-<version>.vsix
```

Press F5 in VS Code with this folder open to start an Extension Development
Host. Read [AGENTS.md](AGENTS.md) before changing anything.
