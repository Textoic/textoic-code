# Changelog

## 0.2.0

- New Issues panel in the secondary side bar, with two views: the issues in view as you scroll, or all issues grouped by rule, the biggest group first. Each issue can be rewritten, ignored once, ignored as a case, or have its rule turned off. Needs VS Code 1.106 or later.
- New quick fix *Ignore this instance*, which hides one problem in one sentence of one file.
- New command **Rewrite All Issues with AI**, in the quick fixes, the editor's context menu and the command palette. It rewrites every paragraph with a problem, shows the rewrites that passed in one diff, and applies them together.

- Rewrites no longer hang. The quick fix returns at once and the rewrite runs behind a progress notification you can cancel.
- A finished rewrite opens as a diff with an Apply or Discard prompt. The Refactor Preview used before left the edit unticked, so it showed only struck-through text and Apply did nothing.
- In files with Windows line endings, a rewrite covers only the paragraph with the problem, not the whole file, and it keeps the file's final newline.
- Ollama rewrites work with thinking models such as qwen3: the request turns thinking off, which had used the whole answer budget and returned an empty rewrite.
- New provider `vscode`: rewrite with the language models VS Code already has, such as GitHub Copilot's.

## 0.1.0

- First release: live prose linting over enlint-lsp, quick fixes, ignorable cases, rule management, and AI rewrites through Ollama or OpenRouter.
