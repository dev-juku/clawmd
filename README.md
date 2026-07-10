# ClawMD

**A local-first desktop workspace for your Markdown prompt library.**

ClawMD opens a folder of Markdown prompts and gives you a fast, focused place to
edit, preview, inspect, and search them — entirely on your machine. No login, no
telemetry, no cloud, no model API calls. Your prompts never leave your computer.

## Features

- **Open any folder** of Markdown prompts — no import and no restructuring; hidden
  and build folders like `.git` and `node_modules` are skipped automatically.
- **Browse** prompts in a collapsible folder tree with instant local search across
  filenames, tags, variables, and content.
- **Edit** in a fast CodeMirror editor and save straight back to disk, with an
  unsaved-changes indicator and reload-on-external-change protection.
- **Preview** rendered Markdown, or a *compiled* prompt with your `{{variable}}`
  values filled in and missing values flagged.
- **Inspect** frontmatter metadata, extracted variables, parse status, and file info.
- **Count** words, characters, and approximate tokens for the whole file or a selection.
- **Open with ClawMD** — right-click a `.md` file in Finder to open its folder as a
  workspace and jump straight to that file.
- **Fully offline.** Files stay local; nothing is ever uploaded.

## Prompt format

Files work with or without frontmatter. When present, frontmatter can carry a title,
description, tags, target models, and type:

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

Template variables use `{{variable_name}}` syntax and can be previewed with sample
values in the compiled view.

## Getting started

Prebuilt macOS builds will be published to the
[Releases](https://github.com/dev-juku/clawmd/releases) page. To run from source:

```sh
pnpm install     # install dependencies
pnpm dev         # launch the desktop app
```

### Checks and packaging

```sh
pnpm typecheck   # type-check main + renderer
pnpm test        # run unit tests
pnpm build       # production build
pnpm dist:mac    # package a macOS app (see docs/macos-packaging.md)
```

## License

[MIT](LICENSE) © 2026 Rahul Singh
