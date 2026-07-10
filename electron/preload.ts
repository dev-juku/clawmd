import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { PromptWorkspaceApi } from "../src/types/api.js";

const api: PromptWorkspaceApi = {
  getRecentFolders: () => ipcRenderer.invoke("app:getRecentFolders"),
  getFavorites: (rootPath) => ipcRenderer.invoke("app:getFavorites", rootPath),
  setFavorites: (rootPath, relativePaths) => ipcRenderer.invoke("app:setFavorites", rootPath, relativePaths),
  openFolder: () => ipcRenderer.invoke("workspace:openFolder"),
  scanWorkspace: (rootPath) => ipcRenderer.invoke("workspace:scan", rootPath),
  readFile: (rootPath, filePath) => ipcRenderer.invoke("file:read", rootPath, filePath),
  writeFile: (rootPath, filePath, content, expectedModified) =>
    ipcRenderer.invoke("file:write", rootPath, filePath, content, expectedModified),
  createFile: (rootPath, folderRelative, name) => ipcRenderer.invoke("file:create", rootPath, folderRelative, name),
  renameFile: (rootPath, filePath, newName) => ipcRenderer.invoke("file:rename", rootPath, filePath, newName),
  moveFile: (rootPath, filePath) => ipcRenderer.invoke("file:move", rootPath, filePath),
  deleteFile: (rootPath, filePath) => ipcRenderer.invoke("file:delete", rootPath, filePath),
  getPendingFile: () => ipcRenderer.invoke("app:getPendingFile"),
  onOpenFile: (callback) => {
    const listener = (_event: IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on("file:open", listener);
    return () => ipcRenderer.removeListener("file:open", listener);
  }
};

contextBridge.exposeInMainWorld("promptWorkspace", api);
