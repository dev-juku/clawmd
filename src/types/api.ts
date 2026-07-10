import type { PromptAsset, RecentFolder } from "./prompt.js";

export type FileInfo = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
};

export type PromptWorkspaceApi = {
  getRecentFolders: () => Promise<RecentFolder[]>;
  openFolder: () => Promise<string | null>;
  scanWorkspace: (rootPath: string) => Promise<PromptAsset[]>;
  readFile: (rootPath: string, filePath: string) => Promise<{ content: string; lastModified: number }>;
  getPendingFile: () => Promise<string | null>;
  onOpenFile: (callback: (filePath: string) => void) => () => void;
  writeFile: (
    rootPath: string,
    filePath: string,
    content: string,
    expectedModified: number | null
  ) => Promise<{ ok: true; lastModified: number } | { ok: false; reason: "modified_on_disk"; lastModified: number }>;
  createFile: (rootPath: string, folderRelative: string, name: string) => Promise<FileInfo>;
  renameFile: (rootPath: string, filePath: string, newName: string) => Promise<FileInfo>;
  moveFile: (rootPath: string, filePath: string) => Promise<FileInfo | null>;
  deleteFile: (rootPath: string, filePath: string) => Promise<{ ok: true }>;
};
