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
- **Ignore one case.** "very dirty" keeps suggesting "filthy" and you want
  "very dirty"? Choose *Ignore "dirty" everywhere* from the quick fixes.
  The rest of the rule keeps working. This works for the three rules built
  from lists: bad words, "very X" and "not X".
- **Turn a rule off** from the same menu, or pick severities with
  **Textoic: Manage Rules**, which shows each rule's description and examples
  and lets you tick the cases to ignore.
- **AI rewrites** through a local model in [Ollama](https://ollama.com) or a
  hosted one through [OpenRouter](https://openrouter.ai). Textoic sends the
  paragraph and the problems in it, along with its style guide, then lints the answer. A
  rewrite that comes back empty, cut off, far longer or shorter, or with more
  problems than it started with is flagged before you see it. Every rewrite
  opens in VS Code's refactor preview, so nothing changes until you accept.

## Settings

| Setting                     | Default                   | What it does                                            |
| --------------------------- | ------------------------- | ------------------------------------------------------- |
| `textoic.enable`            | `true`                    | Lint at all                                             |
| `textoic.languages`         | `["markdown","plaintext"]`| Language ids to lint                                    |
| `textoic.extends`           | `recommended`             | Start from enlint's defaults, or `all` rules            |
| `textoic.locale`            | `en-US`                   | The dialect `no-mixed-dialects` enforces                |
| `textoic.rules`             | `{}`                      | Per-rule severity and ignored cases (see below)         |
| `textoic.debounceMs`        | `750`                     | Delay after the last keystroke                          |
| `textoic.rewrite.provider`  | `off`                     | `ollama`, `openrouter`, or `off`                        |
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

The [enlint plugin for Claude Code and Codex](https://github.com/Textoic/enlint-skill)
reads the same file, so the agents stop flagging what you told the editor to
ignore.

## Commands

- **Textoic: Manage Rules**: severities, descriptions, examples, ignored cases
- **Textoic: Rewrite Selection with AI** (also in the editor's context menu)
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
