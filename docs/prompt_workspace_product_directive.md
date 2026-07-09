# Product Directive: Local-First Prompt Workspace

## 1. Product Summary

Build a fast, local-first desktop application for managing AI/LLM prompt assets stored as plain files.

The app is not a general code editor, not a chat client, and not a full IDE. It is a focused workspace for discovering, editing, previewing, organizing, and validating prompt-related files in a local folder.

The initial app should support folders containing:

- Markdown files: `.md`, `.markdown`
- Text files: `.txt`, `.prompt`
- YAML files: `.yaml`, `.yml`
- JSON files: `.json`

The core user flow is:

> Open a local folder → scan prompt-like files → show a focused prompt inventory → edit files → preview rendered/compiled prompts → inspect variables and metadata → search and compare prompt assets.

The product should feel closer to a lightweight VS Code-like prompt manager than a rich-text Markdown editor.

---

## 2. Product Positioning

### One-line positioning

A local-first workspace for managing, editing, and evolving AI prompts stored as plain files.

### Product promise

Help users understand and maintain a growing prompt library without forcing them into a full programming IDE.

### What makes this different from VS Code

VS Code treats prompt files as generic text/code files. This product treats them as prompt assets.

The app should provide prompt-specific functionality such as:

- Automatic prompt file discovery
- Prompt inventory/index view
- Variable extraction
- Prompt preview and compiled prompt preview
- Metadata extraction from Markdown frontmatter, YAML, and JSON
- Detection of missing variables
- Prompt-oriented search
- Prompt diffing
- Lightweight validation
- Future support for prompt testing/evals

---

## 3. Target Users

The initial product is for technical and semi-technical AI builders who keep prompts in local files or repositories.

Primary users:

- Founders building AI products
- Prompt engineers
- AI product managers
- Developers maintaining prompt libraries
- Content/ops teams editing prompt templates
- AI consultants managing prompt assets across clients

The app should be usable by non-engineers, but it can assume users understand files, folders, and basic prompt concepts.

---

## 4. Guiding Principles

1. **Local-first by default**
   - User files remain on the local machine.
   - Do not require login, cloud sync, or account creation for the MVP.
   - The app should work fully offline.

2. **Plain files, no lock-in**
   - The app should read and write normal Markdown, YAML, JSON, and text files.
   - Do not require a proprietary file format for basic use.
   - Metadata should be optional and should use common patterns such as Markdown frontmatter where possible.

3. **Fast over fancy**
   - Startup, folder scan, search, and editing should feel instant for normal prompt folders.
   - Avoid heavyweight live features that block typing.
   - Heavy operations should be incremental, debounced, cached, or pushed off the UI thread.

4. **Prompt-aware, not code-centric**
   - Do not expose unnecessary IDE complexity.
   - Show prompt assets, variables, metadata, previews, and relationships instead of code project details.

5. **Read existing folders gracefully**
   - Users should be able to open an existing folder without restructuring it.
   - The app should infer useful structure but never force migration.

6. **Small, sharp MVP**
   - Do not build chat execution, model integrations, cloud sync, collaboration, marketplace, or full evals in the first version.

---

## 5. Recommended Tech Stack

Use Electron for the desktop shell.

Recommended stack:

- Electron
- Vite
- React
- TypeScript
- CodeMirror 6 for text editing
- SQLite for local index/cache, or an equivalent embedded local store
- chokidar or native file watching for folder monitoring
- markdown-it, micromark, or unified/remark for Markdown parsing
- yaml package for YAML parsing
- built-in JSON parsing with graceful error handling
- Fuse.js, MiniSearch, SQLite FTS5, or a similar local search layer

Avoid Monaco unless there is a specific need for VS Code-level language tooling. CodeMirror 6 is preferred for a lightweight, focused editor experience.

---

## 6. Core MVP Scope

### 6.1 Folder opening

The app must allow a user to open a local folder.

When a folder is opened:

- Recursively scan for supported files.
- Ignore common noisy folders:
  - `node_modules`
  - `.git`
  - `.next`
  - `dist`
  - `build`
  - `.cache`
  - `vendor`
  - binary/media folders where appropriate
- Build an in-memory and/or local indexed representation of prompt-like files.
- Show scan status without blocking the UI.

The app should remember recently opened folders locally.

### 6.2 Prompt file detection

Supported files:

- `.md`
- `.markdown`
- `.txt`
- `.prompt`
- `.yaml`
- `.yml`
- `.json`

Each file should be represented as a `PromptAsset` whether or not the app can infer all metadata.

Suggested `PromptAsset` shape:

```ts
type PromptAsset = {
  id: string;
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  title: string;
  description?: string;
  tags: string[];
  modelTargets: string[];
  promptType?: 'system' | 'developer' | 'user' | 'assistant' | 'template' | 'eval' | 'unknown';
  variables: PromptVariable[];
  frontmatter?: Record<string, unknown>;
  parseErrors: ParseError[];
  lastModified: number;
  sizeBytes: number;
};
```

Suggested variable shape:

```ts
type PromptVariable = {
  name: string;
  syntax: 'double_curly' | 'single_curly' | 'dollar' | 'angle' | 'unknown';
  occurrences: number;
  examples: string[];
};
```

### 6.3 Main layout

The MVP UI should have four primary regions:

1. **Left sidebar: file/prompt inventory**
   - Folder tree or prompt asset list
   - Filter by file type
   - Filter by prompt type
   - Filter by tag
   - Search field

2. **Center editor**
   - CodeMirror editor
   - Syntax highlighting for Markdown, YAML, JSON, and text
   - Fast editing
   - Save changes to disk
   - Dirty state indicator

3. **Right inspector**
   - Metadata
   - Variables
   - Parse errors
   - File info
   - Prompt type
   - Tags

4. **Preview panel**
   - Rendered Markdown preview for Markdown files
   - Structured preview for YAML/JSON files
   - Compiled prompt preview with sample variable values

The preview panel may be tabbed or toggleable to avoid crowding the UI.

### 6.4 Editing

The editor must support:

- Open file
- Edit file
- Save file
- Unsaved changes indicator
- Reload from disk if changed externally
- Basic syntax highlighting
- Basic keyboard shortcuts:
  - Save
  - Find in file
  - Open command palette or search

Do not build advanced IDE features in the MVP:

- No debugger
- No terminal
- No extension marketplace
- No LSP requirements
- No complex multi-cursor feature requirements beyond what CodeMirror naturally provides

### 6.5 Markdown support

For Markdown files:

- Parse optional frontmatter.
- Render Markdown preview.
- Extract title from, in order:
  1. frontmatter `title`
  2. first H1
  3. filename
- Extract description from, in order:
  1. frontmatter `description`
  2. first paragraph
  3. empty
- Extract tags from frontmatter if present.

Example frontmatter:

```md
---
title: Customer Support System Prompt
description: Main system prompt for the support assistant.
tags: [support, production]
models: [gpt-4.1, claude-3.5-sonnet]
type: system
---

You are a helpful support assistant...
```

### 6.6 YAML and JSON support

For YAML and JSON files:

- Parse the file safely.
- Show parse errors without crashing.
- Display a structured preview.
- Extract known metadata keys where present:
  - `title`
  - `name`
  - `description`
  - `tags`
  - `models`
  - `model`
  - `type`
  - `prompt`
  - `system`
  - `developer`
  - `user`
  - `messages`

The app should not assume a single schema. It should handle arbitrary JSON/YAML gracefully.

### 6.7 Variable extraction

The app should detect common prompt template variables.

Supported MVP syntaxes:

- `{{variable_name}}`
- `{variable_name}`
- `$VARIABLE_NAME`
- `<variable_name>`

Detection should avoid obvious false positives where possible.

For each selected file, show:

- Variable name
- Syntax style
- Number of occurrences
- Example surrounding text
- Sample value input

The compiled prompt preview should replace variables with sample values entered by the user. Missing sample values should be visually indicated.

### 6.8 Search

The app must provide fast local search across indexed prompt files.

Search should support:

- Text search across file contents
- Search by filename
- Search by tag
- Search by variable name
- Search by prompt type
- Search by file extension

Search results should show:

- File title/name
- Relative path
- Matching snippet
- Metadata indicators if available

### 6.9 Prompt inventory view

In addition to the file tree, provide a prompt inventory/table/card view.

Each item should show:

- Title
- Relative path
- File type
- Prompt type
- Tags
- Variables count
- Last modified
- Parse status

This is a key differentiator from a generic editor.

### 6.10 Diff view

MVP should include a lightweight diff capability if feasible.

Minimum useful version:

- Compare current unsaved content with last saved file content.
- Show added/removed lines.

Later versions can support Git history and comparison between prompt variants.

---

## 7. Explicit Non-Goals for MVP

Do not build the following in the first version:

- Built-in chat UI
- Direct OpenAI/Anthropic/Gemini API execution
- Model provider key management
- Cloud sync
- User accounts
- Team collaboration
- Real-time multiplayer editing
- Prompt marketplace
- Full eval framework
- Visual node-based prompt builder
- Proprietary database-first prompt storage
- VS Code extension compatibility
- Terminal
- Git commit UI
- Complex project configuration system

The MVP should remain a local prompt asset browser/editor/previewer.

---

## 8. Performance Requirements

The app should be designed around perceived speed.

Target performance expectations:

- App opens quickly.
- User can open a folder and begin browsing before the full index is complete.
- Typing should never wait on Markdown rendering, parsing, search indexing, or file scanning.
- Preview rendering should be debounced.
- Search index updates should be incremental.
- Large files should not freeze the UI.

Implementation guidance:

- Keep the renderer process responsive.
- Push file scanning, parsing, and indexing into background processes/workers where appropriate.
- Debounce expensive operations.
- Cache parsed metadata and search index data.
- Virtualize long lists.
- Do not reparse or restyle the entire workspace on every edit.
- Do not write to disk on every keystroke unless using a carefully debounced autosave.

---

## 9. Security and Privacy Requirements

The product is local-first and may contain sensitive prompts or business logic.

Requirements:

- Do not send file contents to any external service.
- Do not include analytics that capture prompt contents.
- Do not require login.
- Do not upload opened folder metadata.
- Store recent folder paths locally only.
- Treat prompt contents as private by default.

If telemetry is added later, it must be opt-in and must never include file contents.

---

## 10. Suggested App Architecture

### Main process

Responsibilities:

- Native window lifecycle
- Folder picker
- File system access
- File watching
- IPC bridge to renderer
- Secure preload configuration

### Renderer process

Responsibilities:

- React UI
- Editor surface
- Prompt inventory UI
- Inspector
- Preview
- Search UI

### Background/indexing layer

Responsibilities:

- Recursive file scan
- Metadata extraction
- Variable extraction
- Search index updates
- Parse errors
- Cache updates

This may be implemented using Node workers, Electron utility processes, or another worker-style architecture.

### Local data store

Store derived data only, not canonical prompt content.

Possible stored data:

- Recently opened folders
- Cached file metadata
- Search index
- UI preferences
- Sample variable values per file/folder

Canonical file contents should remain in the user's normal files.

---

## 11. Data Flow

### Open folder

1. User selects folder.
2. Main process validates access.
3. Scanner finds supported files while ignoring noisy folders.
4. Each supported file becomes a `PromptAsset`.
5. Parser extracts metadata, variables, parse errors, and preview hints.
6. Search index is updated incrementally.
7. UI updates progressively as results arrive.

### Edit file

1. User opens file in editor.
2. File content is loaded into CodeMirror.
3. User edits content.
4. Dirty state is tracked.
5. Preview parsing is debounced.
6. Variables and metadata are refreshed after debounce.
7. User saves file.
8. File watcher/index updates asset metadata.

### Compile prompt preview

1. Extract variables from current file content.
2. User enters sample values.
3. Replace variables in preview only.
4. Show missing variables clearly.
5. Do not modify the source file unless the user explicitly edits it.

---

## 12. UX Requirements

The UI should be simple, fast, and calm.

Key UX expectations:

- Opening a folder should be obvious.
- The app should explain that files remain local.
- The main screen should quickly answer: "What prompts exist in this folder?"
- Search should be prominent.
- Prompt metadata should be visible without requiring users to open every file.
- Parse errors should be helpful and non-alarming.
- The app should never destroy or rewrite files unexpectedly.

Recommended initial navigation:

- Welcome screen with “Open Folder” and recent folders
- Main workspace after folder open
- Sidebar toggle between “Files” and “Prompt Inventory”
- Editor/Preview split
- Inspector panel for variables and metadata

---

## 13. Validation and Error Handling

The app should handle imperfect files gracefully.

Examples:

- Invalid YAML: show parse error, keep file editable.
- Invalid JSON: show parse error, keep file editable.
- Huge file: open in plain editor mode if needed.
- Deleted file: remove from index and close tab with notice.
- External file modification: prompt user to reload or keep local unsaved changes.
- Permission error: explain clearly and avoid crash.

Never fail the entire workspace scan because one file cannot be parsed.

---

## 14. Future Roadmap, Not MVP

Potential later features:

- Git integration
- Prompt variant comparison
- Prompt run history
- Model API execution
- Local eval cases
- Dataset/test fixture management
- Prompt linting rules
- Prompt quality checks
- Duplicate instruction detection
- Prompt dependency graph
- Team collaboration
- Cloud backup/sync
- Sharing/export bundles
- Schema-aware prompt packs
- Integration with Cursor, VS Code, Claude Code, Codex, and other AI coding tools

These should not distract from the MVP.

---

## 15. Initial Implementation Milestones

### Milestone 1: Desktop shell and folder scan

- Create Electron + Vite + React + TypeScript app.
- Implement secure Electron preload bridge.
- Add folder picker.
- Recursively scan supported files.
- Ignore noisy folders.
- Display discovered files in sidebar.

### Milestone 2: Editor and file saving

- Add CodeMirror editor.
- Load selected file.
- Edit and save file.
- Track dirty state.
- Add basic syntax highlighting.

### Milestone 3: Metadata and variable extraction

- Parse Markdown frontmatter.
- Parse YAML/JSON safely.
- Extract title, description, tags, model targets, and prompt type.
- Extract variables.
- Show inspector panel.

### Milestone 4: Preview and compiled prompt

- Render Markdown preview.
- Show structured YAML/JSON preview.
- Add variable sample inputs.
- Show compiled prompt preview.

### Milestone 5: Search and inventory

- Add full-text search.
- Add filters by type, tag, variable, and extension.
- Add prompt inventory/table view.
- Add indexed snippets.

### Milestone 6: Polish and performance

- Add recent folders.
- Add file watching.
- Add incremental index updates.
- Add virtualization for large lists.
- Add graceful handling for parse errors and external changes.

---

## 16. Acceptance Criteria for MVP

The MVP is acceptable when a user can:

1. Open a local folder.
2. See all supported prompt-like files.
3. Search across them quickly.
4. Open and edit a file.
5. Save changes back to disk.
6. See extracted metadata.
7. See extracted variables.
8. Enter sample variable values.
9. Preview the compiled prompt.
10. See parse errors without losing editability.
11. Use the app offline without login.

---

## 17. Instruction to Codex

Implement this product incrementally.

Prioritize a working vertical slice over completeness:

1. Electron shell
2. Open folder
3. Scan files
4. Display file list
5. Open file in editor
6. Save file
7. Extract variables
8. Show preview
9. Add search
10. Add metadata/index polish

Avoid speculative architecture and avoid building non-MVP features. Keep the codebase small, typed, modular, and easy to refactor.

Use clear module boundaries:

- `filesystem/`
- `scanner/`
- `parser/`
- `indexer/`
- `editor/`
- `preview/`
- `inspector/`
- `ui/`
- `types/`

Do not send any file contents to remote services. Do not add login, telemetry, cloud sync, model API calls, or chat execution in the MVP.

