# macOS Packaging Notes

This project uses `electron-builder` to create unsigned local macOS builds.

## Working Commands

Create an unsigned `.app` bundle:

```sh
pnpm icon:mac
pnpm pack:mac
```

Create unsigned DMG and ZIP artifacts:

```sh
pnpm icon:mac
pnpm dist:mac
```

Generated files are written to `release/`:

```text
release/mac-arm64/ClawMD.app
release/ClawMD-0.1.0-arm64.dmg
release/ClawMD-0.1.0-arm64.zip
```

## Required Setup

- Keep `electron` in `devDependencies`, not `dependencies`.
- Keep `electron-builder` in `devDependencies`.
- Keep `main` pointed at the compiled Electron entry:

```json
"main": "dist-electron/electron/main.js"
```

- Keep the preload path in `electron/main.ts` aligned with `tsconfig.node.json` output:

```ts
preload: path.join(__dirname, "preload.js")
```

- Use this unsigned local-build config:

```json
"build": {
  "appId": "app.clawmd.desktop",
  "productName": "ClawMD",
  "artifactName": "${productName}-${version}-${arch}.${ext}",
  "asar": true,
  "directories": {
    "output": "release"
  },
  "files": [
    "dist-electron/**/*",
    "dist-renderer/**/*",
    "package.json"
  ],
  "mac": {
    "category": "public.app-category.productivity",
    "identity": null
  },
  "dmg": {
    "artifactName": "${productName}-${version}-${arch}.${ext}"
  }
}
```

## Gotchas Avoided

- `electron-builder` fails if `electron` is listed under `dependencies`.
- `electron-builder@26` does not accept a root-level `zip` config block.
- `identity: null` intentionally skips macOS code signing for local unsigned builds.
- The first packaging run may need network access to download Electron packaging assets from GitHub.
- If pnpm reports an unexpected store location, use the same store as the existing `node_modules`, or reinstall dependencies consistently.
- `release/` should stay ignored by git.

## Current Limitations

- The app uses the default Electron icon until a real `.icns` is added.
- Rebuild `assets/icon.icns` from `assets/icon.svg` with `pnpm icon:mac` after icon changes.
- Builds are unsigned and not notarized, so macOS Gatekeeper may warn on first launch.
- Public distribution should add Developer ID signing, hardened runtime, notarization, and a signed DMG.
