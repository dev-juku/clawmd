import type { ParsedPromptMarkdown, PromptType } from "../types/prompt.js";
import { extractVariables } from "./variables.js";

const allowedPromptTypes = new Set<PromptType>(["system", "developer", "user", "assistant", "template", "eval", "unknown"]);

function stripExtension(fileName: string) {
  return fileName.replace(/\.(md|markdown)$/i, "");
}

function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value.length === 0) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => String(parseScalar(item.trim())))
      .filter(Boolean);
  }
  return value;
}

function parseFrontmatter(raw: string): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let currentListKey: string | null = null;

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentListKey) {
      const existing = data[currentListKey];
      data[currentListKey] = Array.isArray(existing) ? [...existing, parseScalar(listMatch[1])] : [parseScalar(listMatch[1])];
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      return { error: `Unsupported frontmatter line: ${line}` };
    }

    const [, key, value = ""] = match;
    if (value.trim().length === 0) {
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = parseScalar(value);
      currentListKey = null;
    }
  }

  return { data };
}

function splitFrontmatter(content: string) {
  if (!content.startsWith("---")) return { body: content };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {
      body: content,
      frontmatterRaw: "",
      error: "Frontmatter starts with --- but has no closing ---."
    };
  }
  return {
    frontmatterRaw: match[1],
    body: content.slice(match[0].length)
  };
}

function firstHeading(body: string) {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function firstParagraph(body: string) {
  const withoutHeadings = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block.length > 0 && !block.startsWith("#") && !block.startsWith("```"));
  return withoutHeadings?.replace(/\s+/g, " ");
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim().length > 0) return [value.trim()];
  return [];
}

function normalizePromptType(value: unknown): PromptType {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase().trim() as PromptType;
  return allowedPromptTypes.has(normalized) ? normalized : "unknown";
}

export function parsePromptMarkdown(content: string, fileName: string): ParsedPromptMarkdown {
  const split = splitFrontmatter(content);
  const parseErrors = split.error ? [{ message: split.error }] : [];
  let frontmatter: Record<string, unknown> | undefined;

  if (split.frontmatterRaw !== undefined && split.frontmatterRaw.length > 0) {
    const parsed = parseFrontmatter(split.frontmatterRaw);
    if (parsed.error) parseErrors.push({ message: parsed.error });
    frontmatter = parsed.data;
  }

  const body = split.body;
  const titleFromFrontmatter = typeof frontmatter?.title === "string" ? frontmatter.title.trim() : "";
  const descriptionFromFrontmatter = typeof frontmatter?.description === "string" ? frontmatter.description.trim() : "";

  return {
    body,
    title: titleFromFrontmatter || firstHeading(body) || stripExtension(fileName),
    description: descriptionFromFrontmatter || firstParagraph(body) || undefined,
    tags: normalizeStringArray(frontmatter?.tags),
    modelTargets: normalizeStringArray(frontmatter?.models),
    promptType: normalizePromptType(frontmatter?.type),
    variables: extractVariables(body),
    frontmatter,
    parseErrors
  };
}
