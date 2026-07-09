import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  FolderOpen,
  Info,
  Minus,
  PanelLeft,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import MarkdownEditor from "./components/MarkdownEditor";
import { markdownToHtml } from "./shared/markdown";
import { parsePromptMarkdown } from "./shared/parser";
import { searchAssets } from "./shared/search";
import { compilePrompt, hasVariableValue } from "./shared/variables";
import type { PromptAsset, RecentFolder } from "./types/prompt";

type ActiveTab = "edit" | "rendered" | "compiled";

type LoadedFile = {
  asset: PromptAsset;
  content: string;
  savedContent: string;
  lastModified: number;
};

type PromptTreeFolder = {
  name: string;
  path: string;
  folders: PromptTreeFolder[];
  files: PromptAsset[];
  count: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatRecentTime(timestamp: number) {
  const now = new Date();
  const date = new Date(timestamp);
  const sameDay = now.toDateString() === date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  if (yesterday.toDateString() === date.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function refreshAssetFromContent(asset: PromptAsset, content: string, lastModified = asset.lastModified): PromptAsset {
  const parsed = parsePromptMarkdown(content, asset.fileName);
  return {
    ...asset,
    title: parsed.title,
    description: parsed.description,
    tags: parsed.tags,
    modelTargets: parsed.modelTargets,
    promptType: parsed.promptType,
    variables: parsed.variables,
    frontmatter: parsed.frontmatter,
    parseErrors: parsed.parseErrors,
    content,
    lastModified,
    sizeBytes: new Blob([content]).size
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type TextStats = {
  characters: number;
  words: number;
  tokens: number;
};

function countTextStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed ? (trimmed.match(/[\p{L}\p{N}_'-]+/gu) ?? []).length : 0;
  return {
    characters: text.length,
    words,
    tokens: Math.ceil(text.length / 4)
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatStats(stats: TextStats) {
  return `${formatNumber(stats.words)} words · ${formatNumber(stats.characters)} chars · ~${formatNumber(stats.tokens)} tokens`;
}

function buildPromptTree(assets: PromptAsset[]): PromptTreeFolder {
  type MutableFolder = {
    name: string;
    path: string;
    folders: MutableFolder[];
    files: PromptAsset[];
    count: number;
    folderMap: Map<string, MutableFolder>;
  };
  const root: MutableFolder = {
    name: "root",
    path: "",
    folders: [],
    files: [],
    count: 0,
    folderMap: new Map()
  };

  for (const asset of assets) {
    const parts = asset.relativePath.split(/[\\/]/).filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;

    let current = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = current.folderMap.get(part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          folders: [],
          files: [],
          count: 0,
          folderMap: new Map()
        };
        current.folderMap.set(part, child);
        current.folders.push(child);
      }
      current = child;
    }

    current.files.push(asset);
  }

  function finalize(folder: MutableFolder): number {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name));
    folder.files.sort((a, b) => a.fileName.localeCompare(b.fileName));
    const childCount = folder.folders.reduce((sum, child) => sum + finalize(child), 0);
    folder.count = childCount + folder.files.length;
    return folder.count;
  }

  finalize(root);
  return root;
}

export default function App() {
  const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [assets, setAssets] = useState<PromptAsset[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("edit");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Open a folder to start.");
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInspector, setShowInspector] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [selectionText, setSelectionText] = useState("");

  useEffect(() => {
    void window.promptWorkspace.getRecentFolders().then(setRecentFolders);
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.relativePath === selectedPath) ?? null,
    [assets, selectedPath]
  );

  const visibleAssets = useMemo(() => searchAssets(assets, query), [assets, query]);
  const promptTree = useMemo(() => buildPromptTree(visibleAssets), [visibleAssets]);
  const hasNoMarkdownFiles = workspaceRoot !== null && assets.length === 0 && !isScanning;
  const hasNoSearchResults = assets.length > 0 && visibleAssets.length === 0;

  const currentParsed = useMemo(() => {
    if (!loadedFile) return null;
    return refreshAssetFromContent(loadedFile.asset, loadedFile.content, loadedFile.lastModified);
  }, [loadedFile]);

  const isDirty = loadedFile ? loadedFile.content !== loadedFile.savedContent : false;
  const compiled = loadedFile ? compilePrompt(loadedFile.content, sampleValues) : "";
  const renderedHtml = loadedFile ? markdownToHtml(loadedFile.content) : "";
  const compiledHtml = markdownToHtml(compiled);
  const statsText = activeTab === "compiled" ? compiled : loadedFile?.content ?? "";
  const fileStats = useMemo(() => countTextStats(statsText), [statsText]);
  const selectionStats = useMemo(() => (selectionText ? countTextStats(selectionText) : null), [selectionText]);

  async function scanWorkspace(rootPath: string) {
    setIsScanning(true);
    setError(null);
    setStatus("Scanning Markdown prompt files...");
    try {
      const scanned = await window.promptWorkspace.scanWorkspace(rootPath);
      setWorkspaceRoot(rootPath);
      setAssets(scanned);
      setSelectedPath(scanned[0]?.relativePath ?? null);
      setStatus(`${scanned.length} Markdown prompt${scanned.length === 1 ? "" : "s"} found.`);
      setRecentFolders(await window.promptWorkspace.getRecentFolders());
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Unable to scan workspace.");
      setStatus("Scan failed.");
    } finally {
      setIsScanning(false);
    }
  }

  async function openFolder() {
    if (isDirty && !confirm("You have unsaved changes. Open another folder and discard them?")) return;
    const folder = await window.promptWorkspace.openFolder();
    if (folder) await scanWorkspace(folder);
  }

  async function rescanWorkspace() {
    if (!workspaceRoot) return;
    if (isDirty && !confirm("You have unsaved changes. Rescan this folder and discard them?")) return;
    await scanWorkspace(workspaceRoot);
  }

  async function loadAsset(asset: PromptAsset) {
    if (!workspaceRoot) return;
    setError(null);
    setSelectedPath(asset.relativePath);

    try {
      const loaded = await window.promptWorkspace.readFile(workspaceRoot, asset.absolutePath);
      const updatedAsset = refreshAssetFromContent(asset, loaded.content, loaded.lastModified);
      setLoadedFile({
        asset: updatedAsset,
        content: loaded.content,
        savedContent: loaded.content,
        lastModified: loaded.lastModified
      });
      setAssets((current) => current.map((item) => (item.relativePath === asset.relativePath ? updatedAsset : item)));
      setStatus(`Opened ${asset.relativePath}.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to open file.");
    }
  }

  useEffect(() => {
    if (!selectedAsset) {
      setLoadedFile(null);
      return;
    }
    if (loadedFile?.asset.relativePath === selectedAsset.relativePath) return;
    void loadAsset(selectedAsset);
  }, [selectedAsset?.relativePath, workspaceRoot]);

  async function saveFile() {
    if (!workspaceRoot || !loadedFile || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await window.promptWorkspace.writeFile(
        workspaceRoot,
        loadedFile.asset.absolutePath,
        loadedFile.content,
        loadedFile.lastModified
      );

      if (!result.ok) {
        setError("This file changed on disk after you opened it. Reload the file before saving to avoid overwriting newer content.");
        setLoadedFile({ ...loadedFile, lastModified: result.lastModified });
        return;
      }

      const updatedAsset = refreshAssetFromContent(loadedFile.asset, loadedFile.content, result.lastModified);
      setLoadedFile({
        asset: updatedAsset,
        content: loadedFile.content,
        savedContent: loadedFile.content,
        lastModified: result.lastModified
      });
      setAssets((current) => current.map((asset) => (asset.relativePath === updatedAsset.relativePath ? updatedAsset : asset)));
      setStatus(`Saved ${updatedAsset.relativePath}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save file.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveFile();
      }
      if (event.key === "Escape") {
        setShowInspector(false);
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setEditorFontSize((current) => clamp(current + 1, 11, 22));
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "-") {
        event.preventDefault();
        setEditorFontSize((current) => clamp(current - 1, 11, 22));
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "0") {
        event.preventDefault();
        setEditorFontSize(14);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workspaceRoot, loadedFile, isSaving]);

  function updateContent(nextContent: string) {
    if (!loadedFile) return;
    const nextAsset = refreshAssetFromContent(loadedFile.asset, nextContent, loadedFile.lastModified);
    setLoadedFile({ ...loadedFile, asset: nextAsset, content: nextContent });
  }

  function goHome() {
    if (isDirty && !confirm("You have unsaved changes. Return home and discard them?")) return;
    setWorkspaceRoot(null);
    setAssets([]);
    setSelectedPath(null);
    setLoadedFile(null);
    setQuery("");
    setStatus("Open a folder to start.");
    setOpenFolders(new Set());
    setShowInspector(false);
    setSelectionText("");
  }

  function decreaseFontSize() {
    setEditorFontSize((current) => clamp(current - 1, 11, 22));
  }

  function increaseFontSize() {
    setEditorFontSize((current) => clamp(current + 1, 11, 22));
  }

  function resetFontSize() {
    setEditorFontSize(14);
  }

  function toggleFolder(folder: string) {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }

  function renderFileRow(asset: PromptAsset, depth: number) {
    return (
      <button
        key={asset.relativePath}
        className={`tree-file-row ${asset.relativePath === selectedPath ? "selected" : ""}`}
        style={{ "--tree-depth": depth } as CSSProperties}
        onClick={() => {
          if (isDirty && !confirm("You have unsaved changes. Open another file and discard them?")) return;
          setSelectedPath(asset.relativePath);
        }}
      >
        <FileText size={13} />
        <span className="tree-file-title" title={asset.relativePath}>{asset.fileName}</span>
      </button>
    );
  }

  function renderFolder(folder: PromptTreeFolder, depth: number) {
    const collapsed = !openFolders.has(folder.path) && !query;
    return (
      <div className="tree-folder" key={folder.path}>
        <button className="tree-folder-row" style={{ "--tree-depth": depth } as CSSProperties} onClick={() => toggleFolder(folder.path)}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span>{folder.name}</span>
          <small>{folder.count}</small>
        </button>
        {!collapsed && (
          <>
            {folder.folders.map((child) => renderFolder(child, depth + 1))}
            {folder.files.map((asset) => renderFileRow(asset, depth + 1))}
          </>
        )}
      </div>
    );
  }

  const missingVariables = currentParsed?.variables.filter((variable) => !hasVariableValue(variable.name, sampleValues)) ?? [];
  const effectiveShowSidebar = showSidebar;
  const workspaceStyle: CSSProperties = {
    gridTemplateColumns: `${effectiveShowSidebar ? `${sidebarWidth}px 6px ` : ""}minmax(0, 1fr)`
  };

  function startPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startSidebarWidth = sidebarWidth;

    document.body.classList.add("is-resizing");

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(clamp(startSidebarWidth + delta, 220, 420));
    };

    const onPointerUp = () => {
      document.body.classList.remove("is-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  if (!workspaceRoot) {
    return (
      <main className="welcome-screen">
        <section className="welcome-panel">
          <div className="brand-mark">ClawMD</div>
          <h1>Markdown prompt workspace</h1>
          <p>Open a local folder of Markdown prompts. Files stay on this machine, and the app works offline.</p>
          <button className="primary-button" onClick={openFolder}>
            <FolderOpen size={18} />
            Open Folder
          </button>
          {recentFolders.length > 0 && (
            <div className="recent-list">
              <div className="recent-heading">
                <h2>Recent</h2>
                <span>{recentFolders.length} of 8</span>
              </div>
              {recentFolders.map((folder) => (
                <button key={folder.path} className="recent-folder" onClick={() => scanWorkspace(folder.path)}>
                  <span className="recent-folder-main">
                    <strong>{folder.name}</strong>
                    <time>{formatRecentTime(folder.openedAt)}</time>
                  </span>
                  <small>{folder.path}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell" style={workspaceStyle}>
      {effectiveShowSidebar && (
      <aside className="sidebar">
        <div className="workspace-header">
          <button className="workspace-title-button" title="Home" onClick={goHome}>
            <span className="eyebrow">Workspace</span>
            <strong title={workspaceRoot}>{workspaceRoot.split(/[\\/]/).pop()}</strong>
          </button>
          <button className="icon-button" title="Open folder" onClick={openFolder}>
            <FolderOpen size={18} />
          </button>
        </div>

        <label className="search-box">
          <Search size={16} />
          <input value={query} placeholder="Search prompts" onChange={(event) => setQuery(event.target.value)} />
        </label>

        <div className="inventory-meta">
          <span>{visibleAssets.length} shown · {assets.length} total</span>
          <button className="sidebar-action-button" onClick={rescanWorkspace} disabled={isScanning}>
            <RefreshCw size={13} />
            Rescan
          </button>
        </div>

        <div className="asset-list">
          {hasNoMarkdownFiles && (
            <div className="sidebar-empty">
              <strong>No Markdown files</strong>
              <span>This workspace has no `.md` or `.markdown` files outside ignored folders.</span>
            </div>
          )}
          {hasNoSearchResults && (
            <div className="sidebar-empty">
              <strong>No matches</strong>
              <span>Try a different filename, folder, tag, variable, or prompt text.</span>
            </div>
          )}
          {!hasNoMarkdownFiles && !hasNoSearchResults && (
            <>
              {promptTree.folders.map((folder) => renderFolder(folder, 0))}
              {promptTree.files.map((asset) => renderFileRow(asset, 0))}
            </>
          )}
        </div>
      </aside>
      )}

      {effectiveShowSidebar && <div className="panel-resizer vertical" role="separator" aria-label="Resize inventory" onPointerDown={startPanelResize} />}

      <section className="editor-column">
        <header className="topbar">
          <div className="file-heading">
            <h1>{currentParsed?.title ?? (hasNoMarkdownFiles ? "No Markdown prompts found" : "No prompt selected")}</h1>
            <p>{loadedFile?.asset.relativePath ?? status}</p>
          </div>
          <div className="toolbar">
            <div className="panel-toggle-group" aria-label="Panel visibility">
              <button
                className={`icon-button ${showSidebar ? "active" : ""}`}
                title={showSidebar ? "Hide inventory" : "Show inventory"}
                onClick={() => setShowSidebar((current) => !current)}
              >
                <PanelLeft size={17} />
              </button>
            </div>
            {isScanning && (
              <span className="status-pill">
                <RefreshCw size={14} />
                Scanning
              </span>
            )}
            <button className="primary-button compact" onClick={saveFile} disabled={!loadedFile || !isDirty || isSaving}>
              <Save size={16} />
              <span className="button-label">{isSaving ? "Saving" : "Save"}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <div className="workbench preview-hidden">
          <div className="editor-pane">
            {hasNoMarkdownFiles ? (
              <div className="empty-document">
                <div>
                  <h2>No Markdown prompts found</h2>
                  <p>This open-source workspace indexes `.md` and `.markdown` files only. Hidden folders and generated folders are ignored.</p>
                  <div className="empty-actions">
                    <button className="secondary-button" onClick={rescanWorkspace}>
                      <RefreshCw size={16} />
                      Rescan
                    </button>
                    <button className="primary-button compact" onClick={openFolder}>
                      <FolderOpen size={16} />
                      Open Folder
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
            <div className="document-tabs">
              <button className={activeTab === "edit" ? "active" : ""} onClick={() => setActiveTab("edit")}>
                <Edit3 size={15} />
                Edit
              </button>
              <button className={activeTab === "rendered" ? "active" : ""} onClick={() => setActiveTab("rendered")}>
                Rendered
              </button>
              <button className={activeTab === "compiled" ? "active" : ""} onClick={() => setActiveTab("compiled")}>
                Compiled
              </button>
              <span className="document-tab-spacer" />
              <button
                className={`document-icon-button ${showInspector ? "active" : ""}`}
                title={showInspector ? "Hide inspector" : "Show inspector"}
                onClick={() => setShowInspector((current) => !current)}
              >
                <Info size={16} />
              </button>
            </div>
            <div className="document-surface">
              {activeTab === "edit" ? (
                <MarkdownEditor
                  value={loadedFile?.content ?? ""}
                  disabled={!loadedFile}
                  fontSizePx={editorFontSize}
                  onChange={updateContent}
                  onSelectionChange={setSelectionText}
                />
              ) : (
                <article
                  className={`markdown-preview ${activeTab === "compiled" && missingVariables.length > 0 ? "has-missing" : ""}`}
                  style={{ fontSize: `${editorFontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: activeTab === "rendered" ? renderedHtml : compiledHtml }}
                />
              )}
              {showInspector && (
                <>
                  <button className="inspector-scrim" aria-label="Close inspector" onClick={() => setShowInspector(false)} />
                  <aside className="inspector-drawer">
                    <div className="panel-heading drawer-heading">
                      <span>
                        <SlidersHorizontal size={17} />
                        Inspector
                      </span>
                      <button className="icon-button" title="Close inspector" onClick={() => setShowInspector(false)}>
                        <X size={16} />
                      </button>
                    </div>

                    {currentParsed ? (
                      <>
                        <section className="inspector-section">
                          <h2>Metadata</h2>
                          <dl>
                            <dt>Type</dt>
                            <dd>{currentParsed.promptType}</dd>
                            <dt>Tags</dt>
                            <dd>{currentParsed.tags.length ? currentParsed.tags.join(", ") : "None"}</dd>
                            <dt>Models</dt>
                            <dd>{currentParsed.modelTargets.length ? currentParsed.modelTargets.join(", ") : "None"}</dd>
                            <dt>Modified</dt>
                            <dd>{formatDate(currentParsed.lastModified)}</dd>
                            <dt>Size</dt>
                            <dd>{formatBytes(currentParsed.sizeBytes)}</dd>
                          </dl>
                        </section>

                        <section className="inspector-section">
                          <h2>Variables</h2>
                          {currentParsed.variables.length === 0 ? (
                            <p className="muted">No double-curly variables found.</p>
                          ) : (
                            <div className="variable-list">
                              {currentParsed.variables.map((variable) => (
                                <label key={variable.name} className="variable-field">
                                  <span>
                                    {hasVariableValue(variable.name, sampleValues) ? <Check size={14} /> : <Clock size={14} />}
                                    {variable.name}
                                    <small>{variable.occurrences}x</small>
                                  </span>
                                  <input
                                    value={sampleValues[variable.name] ?? ""}
                                    placeholder={`Sample ${variable.name}`}
                                    onChange={(event) =>
                                      setSampleValues((current) => ({
                                        ...current,
                                        [variable.name]: event.target.value
                                      }))
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          )}
                        </section>

                        <section className="inspector-section">
                          <h2>Parse Status</h2>
                          {currentParsed.parseErrors.length === 0 ? (
                            <p className="ok-text">No parse issues.</p>
                          ) : (
                            currentParsed.parseErrors.map((parseError) => (
                              <p key={parseError.message} className="parse-error">
                                {parseError.message}
                              </p>
                            ))
                          )}
                        </section>
                      </>
                    ) : (
                      <p className="muted">Select a Markdown prompt to inspect it.</p>
                    )}
                  </aside>
                </>
              )}
            </div>
            <footer className="document-status-bar">
              <div className="document-stats">
                {isDirty && <span className="status-unsaved">Unsaved</span>}
                {selectionStats ? (
                  <>
                    <span>Selection: {formatStats(selectionStats)}</span>
                    <span>File: {formatStats(fileStats)}</span>
                  </>
                ) : (
                  <span>File: {formatStats(fileStats)}</span>
                )}
              </div>
              <div className="font-controls" aria-label="Editor font size">
                <button title="Decrease font size" onClick={decreaseFontSize}>
                  <Minus size={13} />
                </button>
                <button className="font-size-value" title="Reset font size" onClick={resetFontSize}>
                  {editorFontSize}px
                </button>
                <button title="Increase font size" onClick={increaseFontSize}>
                  <Plus size={13} />
                </button>
              </div>
            </footer>
              </>
            )}
          </div>
        </div>
      </section>

    </main>
  );
}
