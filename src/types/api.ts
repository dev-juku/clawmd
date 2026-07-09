import type { PromptAsset, RecentFolder } from "./prompt.js";

export type PromptWorkspaceApi = {
  getRecentFolders: () => Promise<RecentFolder[]>;
  openFolder: () => Promise<string | null>;
  scanWorkspace: (rootPath: string) => Promise<PromptAsset[]>;
  readFile: (rootPath: string, filePath: string) => Promise<{ content: string; lastModified: number }>;
  writeFile: (
    rootPath: string,
    filePath: string,
    content: string,
    expectedModified: number | null
  ) => Promise<{ ok: true; lastModified: number } | { ok: false; reason: "modified_on_disk"; lastModified: number }>;
};
