import path from "node:path";

export const markdownExtensions = new Set([".md", ".markdown"]);

export type FileInfo = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
};

export function isMarkdownFile(filePath: string): boolean {
  return markdownExtensions.has(path.extname(filePath).toLowerCase());
}

/**
 * Throws if `filePath` resolves to anything outside `rootPath`. This is the
 * safety boundary for every file operation — it must reject `..` traversal and
 * absolute paths that escape the opened workspace.
 */
export function assertInsideRoot(rootPath: string, filePath: string): void {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File access is outside the opened workspace.");
  }
}

/** Trim a user-provided name and guarantee a Markdown extension. */
export function ensureMarkdownName(rawName: string): string {
  const trimmed = String(rawName ?? "").trim();
  if (!trimmed) throw new Error("Name cannot be empty.");
  return markdownExtensions.has(path.extname(trimmed).toLowerCase()) ? trimmed : `${trimmed}.md`;
}

export function toFileInfo(rootPath: string, absolutePath: string): FileInfo {
  return {
    absolutePath,
    relativePath: path.relative(rootPath, absolutePath),
    fileName: path.basename(absolutePath)
  };
}

/** Resolve the absolute target for creating a new file (name may include subfolders). */
export function resolveCreateTarget(rootPath: string, folderRelative: string, rawName: string): string {
  const dir = path.join(rootPath, ...String(folderRelative ?? "").split(/[\\/]/).filter(Boolean));
  const target = path.join(dir, ensureMarkdownName(rawName));
  assertInsideRoot(rootPath, target);
  if (!isMarkdownFile(target)) throw new Error("Only Markdown files can be created.");
  return target;
}

/** Resolve the absolute target for renaming a file within its own directory. */
export function resolveRenameTarget(rootPath: string, filePath: string, rawName: string): string {
  assertInsideRoot(rootPath, filePath);
  const target = path.join(path.dirname(filePath), ensureMarkdownName(rawName));
  assertInsideRoot(rootPath, target);
  if (!isMarkdownFile(target)) throw new Error("Only Markdown files are supported.");
  return target;
}

/** Resolve the absolute target for moving a file into `targetDir`, keeping its basename. */
export function resolveMoveTarget(rootPath: string, filePath: string, targetDir: string): string {
  assertInsideRoot(rootPath, filePath);
  assertInsideRoot(rootPath, targetDir);
  return path.join(targetDir, path.basename(filePath));
}
