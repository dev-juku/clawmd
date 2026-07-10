import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertInsideRoot,
  ensureMarkdownName,
  isMarkdownFile,
  resolveCreateTarget,
  resolveMoveTarget,
  resolveRenameTarget,
  toFileInfo
} from "./fileOps";

const root = path.resolve("/workspace/prompts");

describe("assertInsideRoot", () => {
  it("allows paths inside the workspace", () => {
    expect(() => assertInsideRoot(root, path.join(root, "a", "b.md"))).not.toThrow();
    expect(() => assertInsideRoot(root, root)).not.toThrow();
  });

  it("rejects parent-traversal escapes", () => {
    expect(() => assertInsideRoot(root, path.join(root, "..", "secret.md"))).toThrow(/outside/);
    expect(() => assertInsideRoot(root, path.resolve("/etc/passwd"))).toThrow(/outside/);
  });
});

describe("ensureMarkdownName", () => {
  it("appends .md when no markdown extension is present", () => {
    expect(ensureMarkdownName("idea")).toBe("idea.md");
    expect(ensureMarkdownName("notes.txt")).toBe("notes.txt.md");
  });

  it("keeps an existing markdown extension", () => {
    expect(ensureMarkdownName("idea.md")).toBe("idea.md");
    expect(ensureMarkdownName("idea.markdown")).toBe("idea.markdown");
    expect(ensureMarkdownName("  spaced.md  ")).toBe("spaced.md");
  });

  it("rejects an empty name", () => {
    expect(() => ensureMarkdownName("   ")).toThrow(/empty/);
  });
});

describe("isMarkdownFile", () => {
  it("matches only markdown extensions", () => {
    expect(isMarkdownFile("a.md")).toBe(true);
    expect(isMarkdownFile("a.MARKDOWN")).toBe(true);
    expect(isMarkdownFile("a.txt")).toBe(false);
  });
});

describe("resolveCreateTarget", () => {
  it("creates directly in a folder", () => {
    expect(resolveCreateTarget(root, "", "hello")).toBe(path.join(root, "hello.md"));
    expect(resolveCreateTarget(root, "sub", "hello.md")).toBe(path.join(root, "sub", "hello.md"));
  });

  it("supports nested names that create subfolders", () => {
    expect(resolveCreateTarget(root, "", "drafts/idea.md")).toBe(path.join(root, "drafts", "idea.md"));
  });

  it("blocks escaping the workspace via the name", () => {
    expect(() => resolveCreateTarget(root, "", "../escape.md")).toThrow(/outside/);
    expect(() => resolveCreateTarget(root, "..", "escape.md")).toThrow(/outside/);
  });
});

describe("resolveRenameTarget", () => {
  it("renames within the same directory", () => {
    const file = path.join(root, "sub", "old.md");
    expect(resolveRenameTarget(root, file, "new")).toBe(path.join(root, "sub", "new.md"));
  });

  it("blocks renaming to a path outside the workspace", () => {
    const file = path.join(root, "old.md");
    expect(() => resolveRenameTarget(root, file, "../../escape.md")).toThrow(/outside/);
  });
});

describe("resolveMoveTarget", () => {
  it("keeps the basename in the target directory", () => {
    const file = path.join(root, "a", "doc.md");
    expect(resolveMoveTarget(root, file, path.join(root, "b"))).toBe(path.join(root, "b", "doc.md"));
  });

  it("rejects a target directory outside the workspace", () => {
    const file = path.join(root, "a", "doc.md");
    expect(() => resolveMoveTarget(root, file, path.resolve("/tmp"))).toThrow(/outside/);
  });
});

describe("toFileInfo", () => {
  it("derives a workspace-relative path and file name", () => {
    const abs = path.join(root, "sub", "doc.md");
    expect(toFileInfo(root, abs)).toEqual({
      absolutePath: abs,
      relativePath: path.join("sub", "doc.md"),
      fileName: "doc.md"
    });
  });
});
