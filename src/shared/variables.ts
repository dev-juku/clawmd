import type { PromptVariable } from "../types/prompt.js";

const variablePattern = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export function extractVariables(content: string): PromptVariable[] {
  const variables = new Map<string, PromptVariable>();
  let match: RegExpExecArray | null;

  while ((match = variablePattern.exec(content)) !== null) {
    const name = match[1];
    const start = Math.max(0, match.index - 36);
    const end = Math.min(content.length, match.index + match[0].length + 36);
    const example = content.slice(start, end).replace(/\s+/g, " ").trim();
    const existing = variables.get(name);

    if (existing) {
      existing.occurrences += 1;
      if (existing.examples.length < 3 && !existing.examples.includes(example)) {
        existing.examples.push(example);
      }
    } else {
      variables.set(name, {
        name,
        syntax: "double_curly",
        occurrences: 1,
        examples: example ? [example] : []
      });
    }
  }

  return [...variables.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function compilePrompt(content: string, sampleValues: Record<string, string>) {
  return content.replace(variablePattern, (source, name: string) => {
    const value = sampleValues[name];
    return value && value.length > 0 ? value : source;
  });
}

export function hasVariableValue(name: string, sampleValues: Record<string, string>) {
  return Boolean(sampleValues[name] && sampleValues[name].length > 0);
}
