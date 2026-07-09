import { contextBridge, ipcRenderer } from "electron";
import type { PromptWorkspaceApi } from "../src/types/api.js";

const api: PromptWorkspaceApi = {
  getRecentFolders: () => ipcRenderer.invoke("app:getRecentFolders"),
  openFolder: () => ipcRenderer.invoke("workspace:openFolder"),
  scanWorkspace: (rootPath) => ipcRenderer.invoke("workspace:scan", rootPath),
  readFile: (rootPath, filePath) => ipcRenderer.invoke("file:read", rootPath, filePath),
  writeFile: (rootPath, filePath, content, expectedModified) =>
    ipcRenderer.invoke("file:write", rootPath, filePath, content, expectedModified)
};

contextBridge.exposeInMainWorld("promptWorkspace", api);
