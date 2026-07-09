import type { PromptAsset } from "../types/prompt.js";

export function searchAssets(assets: PromptAsset[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return assets;

  return assets.filter((asset) => {
    const haystack = [
      asset.title,
      asset.description ?? "",
      asset.relativePath,
      asset.promptType,
      ...asset.tags,
      ...asset.modelTargets,
      ...asset.variables.map((variable) => variable.name),
      asset.content
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function resultSnippet(content: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return "";
  const index = content.toLowerCase().indexOf(normalized);
  if (index < 0) return "";
  const start = Math.max(0, index - 48);
  const end = Math.min(content.length, index + normalized.length + 72);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}
