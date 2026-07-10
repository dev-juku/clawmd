import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePromptMarkdown } from "../src/shared/parser.js";
import type { PromptAsset, RecentFolder } from "../src/types/prompt.js";
import {
  assertInsideRoot,
  isMarkdownFile,
  resolveCreateTarget,
  resolveMoveTarget,
  resolveRenameTarget,
  toFileInfo
} from "./fileOps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const noisyDirectories = new Set([
  ".cache",
  ".claude",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor"
]);

let mainWindow: BrowserWindow | null = null;
let pendingOpenFilePath: string | null = null;

const appStatePath = () => path.join(app.getPath("userData"), "state.json");

type AppState = {
  recentFolders: RecentFolder[];
};

async function readAppState(): Promise<AppState> {
  try {
    const raw = await readFile(appStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { recentFolders: Array.isArray(parsed.recentFolders) ? parsed.recentFolders : [] };
  } catch {
    return { recentFolders: [] };
  }
}

async function writeAppState(state: AppState) {
  await mkdir(path.dirname(appStatePath()), { recursive: true });
  await writeFile(appStatePath(), JSON.stringify(state, null, 2), "utf8");
}

async function rememberFolder(folderPath: string) {
  const state = await readAppState();
  const now = Date.now();
  const next = [
    { path: folderPath, name: path.basename(folderPath), openedAt: now },
    ...state.recentFolders.filter((folder) => folder.path !== folderPath)
  ].slice(0, 8);
  await writeAppState({ recentFolders: next });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "ClawMD",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist-renderer/index.html"));
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function scanDirectory(rootPath: string): Promise<PromptAsset[]> {
  const assets: PromptAsset[] = [];

  async function visit(directoryPath: string) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          if (noisyDirectories.has(entry.name)) return;
          if (entry.name.startsWith(".")) return;
          await visit(absolutePath);
          return;
        }

        if (entry.name.startsWith(".")) return;
        if (!entry.isFile() || !isMarkdownFile(entry.name)) return;

        try {
          const [stats, content] = await Promise.all([stat(absolutePath), readFile(absolutePath, "utf8")]);
          const relativePath = path.relative(rootPath, absolutePath);
          const parsed = parsePromptMarkdown(content, path.basename(absolutePath));
          assets.push({
            id: relativePath,
            absolutePath,
            relativePath,
            fileName: path.basename(absolutePath),
            extension: path.extname(absolutePath).toLowerCase(),
            title: parsed.title,
            description: parsed.description,
            tags: parsed.tags,
            modelTargets: parsed.modelTargets,
            promptType: parsed.promptType,
            variables: parsed.variables,
            frontmatter: parsed.frontmatter,
            parseErrors: parsed.parseErrors,
            lastModified: stats.mtimeMs,
            sizeBytes: stats.size,
            content
          });
        } catch (error) {
          const relativePath = path.relative(rootPath, absolutePath);
          assets.push({
            id: relativePath,
            absolutePath,
            relativePath,
            fileName: path.basename(absolutePath),
            extension: path.extname(absolutePath).toLowerCase(),
            title: path.basename(absolutePath, path.extname(absolutePath)),
            tags: [],
            modelTargets: [],
            promptType: "unknown",
            variables: [],
            parseErrors: [{ message: error instanceof Error ? error.message : "Unable to read file." }],
            lastModified: 0,
            sizeBytes: 0,
            content: ""
          });
        }
      })
    );
  }

  await visit(rootPath);
  return assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function extractMarkdownArg(argv: string[], cwd: string): string | null {
  for (const arg of argv) {
    if (!arg || arg.startsWith("-")) continue;
    if (isMarkdownFile(arg)) return path.isAbsolute(arg) ? arg : path.resolve(cwd, arg);
  }
  return null;
}

function deliverOpenFile(filePath: string) {
  if (!isMarkdownFile(filePath)) return;
  pendingOpenFilePath = filePath;
  const webContents = mainWindow?.webContents;
  if (webContents && !webContents.isLoading()) {
    webContents.send("file:open", filePath);
    pendingOpenFilePath = null;
  }
  focusWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Windows/Linux: a second launch (e.g. "Open with ClawMD") reuses this instance.
app.on("second-instance", (_event, argv, workingDirectory) => {
  if (!mainWindow) createWindow();
  const filePath = extractMarkdownArg(argv, workingDirectory);
  if (filePath) deliverOpenFile(filePath);
  else focusWindow();
});

// macOS: fired when a Markdown file is opened via Finder/dock, possibly before ready.
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (!isMarkdownFile(filePath)) return;
  if (!app.isReady()) {
    pendingOpenFilePath = filePath;
    return;
  }
  if (!mainWindow) createWindow();
  deliverOpenFile(filePath);
});

app.whenReady().then(() => {
  ipcMain.handle("app:getRecentFolders", async () => (await readAppState()).recentFolders);

  ipcMain.handle("app:getPendingFile", async () => {
    const filePath = pendingOpenFilePath;
    pendingOpenFilePath = null;
    return filePath;
  });

  ipcMain.handle("workspace:openFolder", async () => {
    const options: OpenDialogOptions = {
      properties: ["openDirectory", "createDirectory"]
    };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) return null;
    const folderPath = result.filePaths[0];
    await rememberFolder(folderPath);
    return folderPath;
  });

  ipcMain.handle("workspace:scan", async (_event, rootPath: string) => {
    const rootStats = await stat(rootPath);
    if (!rootStats.isDirectory()) throw new Error("Workspace root is not a directory.");
    await rememberFolder(rootPath);
    return scanDirectory(rootPath);
  });

  ipcMain.handle("file:read", async (_event, rootPath: string, filePath: string) => {
    assertInsideRoot(rootPath, filePath);
    if (!isMarkdownFile(filePath)) throw new Error("Only Markdown files can be opened.");
    const [stats, content] = await Promise.all([stat(filePath), readFile(filePath, "utf8")]);
    return { content, lastModified: stats.mtimeMs };
  });

  ipcMain.handle("file:write", async (_event, rootPath: string, filePath: string, content: string, expectedModified: number | null) => {
    assertInsideRoot(rootPath, filePath);
    if (!isMarkdownFile(filePath)) throw new Error("Only Markdown files can be saved.");

    const currentStats = await stat(filePath);
    if (expectedModified !== null && Math.abs(currentStats.mtimeMs - expectedModified) > 2) {
      return {
        ok: false,
        reason: "modified_on_disk",
        lastModified: currentStats.mtimeMs
      };
    }

    await writeFile(filePath, content, "utf8");
    const savedStats = await stat(filePath);
    return {
      ok: true,
      lastModified: savedStats.mtimeMs
    };
  });

  ipcMain.handle("file:create", async (_event, rootPath: string, folderRelative: string, rawName: string) => {
    const target = resolveCreateTarget(rootPath, folderRelative, rawName);
    if (await pathExists(target)) throw new Error("A file with that name already exists.");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "", { encoding: "utf8", flag: "wx" });
    return toFileInfo(rootPath, target);
  });

  ipcMain.handle("file:rename", async (_event, rootPath: string, filePath: string, rawName: string) => {
    const target = resolveRenameTarget(rootPath, filePath, rawName);
    if (path.resolve(target) !== path.resolve(filePath) && (await pathExists(target))) {
      throw new Error("A file with that name already exists.");
    }
    await rename(filePath, target);
    return toFileInfo(rootPath, target);
  });

  ipcMain.handle("file:move", async (_event, rootPath: string, filePath: string) => {
    assertInsideRoot(rootPath, filePath);
    const options: OpenDialogOptions = {
      properties: ["openDirectory"],
      defaultPath: path.dirname(filePath),
      title: "Move to folder",
      message: "Choose a folder inside this workspace"
    };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const target = resolveMoveTarget(rootPath, filePath, result.filePaths[0]);
    if (path.resolve(target) === path.resolve(filePath)) return null;
    if (await pathExists(target)) throw new Error("A file with that name already exists in the target folder.");
    await rename(filePath, target);
    return toFileInfo(rootPath, target);
  });

  ipcMain.handle("file:delete", async (_event, rootPath: string, filePath: string) => {
    assertInsideRoot(rootPath, filePath);
    await shell.trashItem(filePath);
    return { ok: true };
  });

  // Cold start via argv (Windows/Linux; macOS delivers through open-file).
  if (!pendingOpenFilePath) {
    const argFile = extractMarkdownArg(process.argv, process.cwd());
    if (argFile) pendingOpenFilePath = argFile;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
