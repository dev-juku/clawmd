export type PromptType = "system" | "developer" | "user" | "assistant" | "template" | "eval" | "unknown";

export type ParseError = {
  message: string;
  line?: number;
};

export type PromptVariable = {
  name: string;
  syntax: "double_curly";
  occurrences: number;
  examples: string[];
};

export type PromptAsset = {
  id: string;
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  title: string;
  description?: string;
  tags: string[];
  modelTargets: string[];
  promptType: PromptType;
  variables: PromptVariable[];
  frontmatter?: Record<string, unknown>;
  parseErrors: ParseError[];
  lastModified: number;
  sizeBytes: number;
  content: string;
};

export type ParsedPromptMarkdown = {
  body: string;
  title: string;
  description?: string;
  tags: string[];
  modelTargets: string[];
  promptType: PromptType;
  variables: PromptVariable[];
  frontmatter?: Record<string, unknown>;
  parseErrors: ParseError[];
};

export type RecentFolder = {
  path: string;
  name: string;
  openedAt: number;
};
