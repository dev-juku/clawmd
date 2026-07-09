/// <reference types="vite/client" />

import type { PromptWorkspaceApi } from "./types/api";

declare global {
  interface Window {
    promptWorkspace: PromptWorkspaceApi;
  }
}
