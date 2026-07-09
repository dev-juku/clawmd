# ClawMD

ClawMD is a local-first desktop workspace for Markdown prompt files.

It opens a local folder, scans Markdown files, and gives you a focused place to edit, preview, inspect, and search prompt assets without sending file contents anywhere.

## Open-source MVP

The open-source version is intentionally small:

- Open a local folder.
- Scan `.md` and `.markdown` files.
- Ignore hidden and generated folders such as `.git`, `.claude`, `.cursor`, `.next`, `node_modules`, `dist`, and `build`.
- Navigate prompts in a collapsible folder tree.
- Edit Markdown in CodeMirror.
- Save changes back to disk.
- Preview rendered Markdown.
- Preview compiled prompts by replacing `{{variable}}` values.
- Inspect frontmatter metadata, variables, parse status, and file info.
- Search locally across indexed Markdown files.
- See file and selection word/character/approximate-token counts.
- Use the app offline without login, telemetry, cloud sync, or model API calls.

## Markdown Convention

Files work with or without frontmatter. When present, frontmatter may include:

```md
---
title: Support Triage System Prompt
description: Routes incoming support messages.
tags: [support, triage]
models: [gpt-4.1]
type: system
---

You are a support triage assistant.

Customer message:
{{customer_message}}
```

Supported prompt variable syntax in the OSS MVP is `{{variable_name}}`.

## Development

Install dependencies:

```sh
pnpm install
```

Run the desktop app:

```sh
pnpm dev
```

Run checks:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Package an unsigned macOS app:

```sh
pnpm icon:mac
pnpm pack:mac
pnpm dist:mac
```

See [docs/macos-packaging.md](docs/macos-packaging.md) for packaging notes and gotchas.

## Non-goals

The OSS MVP does not include model execution, API key management, chat UI, evals, prompt version history, collaboration, cloud sync, marketplace features, JSON/YAML prompt packs, or Git commit workflows.

Those workflows may be explored later, but the core product remains plain-file, local-first Markdown prompt management.
