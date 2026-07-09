# OSS MVP Scope

ClawMD's open-source baseline is a local-first Markdown prompt workspace.

## Included

- Desktop app built with Electron, Vite, React, TypeScript, and CodeMirror.
- Local folder picker and recent folders.
- Markdown-only scanning for `.md` and `.markdown`.
- Hidden/generated folder ignores.
- Collapsible folder tree navigation.
- Markdown editing and save-to-disk behavior.
- Rendered Markdown and compiled prompt tabs.
- `{{variable}}` extraction and sample values.
- Metadata extraction from Markdown frontmatter.
- Inspector drawer for metadata, variables, parse status, and file info.
- Local search.
- File/selection word, character, and approximate token counts.
- Fully offline use with no login, telemetry, cloud sync, or model calls.

## Excluded From OSS MVP

- Built-in chat or prompt execution.
- OpenAI, Anthropic, Gemini, or other model API integrations.
- API key management.
- Prompt version history.
- Git UI or commit workflows.
- Evals, test datasets, or run history.
- Team collaboration.
- Cloud sync or backup.
- Prompt marketplace.
- JSON/YAML prompt asset support.
- Schema-aware prompt packs.
- Visual prompt builders.

## Product Boundary

The OSS product should feel useful on its own, not crippled. Paid or later capabilities should focus on higher-value workflows such as evals, model runs, version history tied to results, team review, and cloud-backed collaboration.

The open-source baseline should stay fast, local, plain-file based, and easy to reason about.
