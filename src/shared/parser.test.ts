import { describe, expect, it } from "vitest";
import { parsePromptMarkdown } from "./parser";
import { compilePrompt, extractVariables } from "./variables";
import { searchAssets } from "./search";
import type { PromptAsset } from "../types/prompt";

describe("parsePromptMarkdown", () => {
  it("extracts frontmatter metadata and variables", () => {
    const parsed = parsePromptMarkdown(
      `---
title: Support Triage
description: Sorts incoming customer messages.
tags: [support, triage]
models: [gpt-4.1]
type: system
---

# Ignored Heading

Message: {{customer_message}}
Urgency: {{ urgency }}`,
      "support.md"
    );

    expect(parsed.title).toBe("Support Triage");
    expect(parsed.description).toBe("Sorts incoming customer messages.");
    expect(parsed.tags).toEqual(["support", "triage"]);
    expect(parsed.modelTargets).toEqual(["gpt-4.1"]);
    expect(parsed.promptType).toBe("system");
    expect(parsed.variables.map((variable) => variable.name)).toEqual(["customer_message", "urgency"]);
    expect(parsed.parseErrors).toEqual([]);
  });

  it("falls back to heading and filename", () => {
    expect(parsePromptMarkdown("# Greeting Prompt\n\nSay hi.", "hello.md").title).toBe("Greeting Prompt");
    expect(parsePromptMarkdown("Say hi.", "hello.md").title).toBe("hello");
  });

  it("keeps editing possible with invalid frontmatter", () => {
    const parsed = parsePromptMarkdown("---\ninvalid line\n---\nBody", "broken.md");
    expect(parsed.title).toBe("broken");
    expect(parsed.parseErrors[0]?.message).toContain("Unsupported frontmatter line");
  });
});

describe("variables", () => {
  it("counts occurrences and compiles known sample values", () => {
    const variables = extractVariables("Hello {{name}}. Again {{ name }}. Ignore {name}.");
    expect(variables).toHaveLength(1);
    expect(variables[0].occurrences).toBe(2);
    expect(compilePrompt("Hello {{name}} and {{missing}}.", { name: "Ada" })).toBe("Hello Ada and {{missing}}.");
  });
});

describe("searchAssets", () => {
  it("matches metadata, variables, and content", () => {
    const asset: PromptAsset = {
      id: "support.md",
      absolutePath: "/tmp/support.md",
      relativePath: "support.md",
      fileName: "support.md",
      extension: ".md",
      title: "Support",
      description: "Customer help",
      tags: ["triage"],
      modelTargets: [],
      promptType: "system",
      variables: [{ name: "customer_message", syntax: "double_curly", occurrences: 1, examples: [] }],
      parseErrors: [],
      lastModified: 0,
      sizeBytes: 0,
      content: "Refund policy prompt"
    };

    expect(searchAssets([asset], "refund")).toEqual([asset]);
    expect(searchAssets([asset], "customer_message")).toEqual([asset]);
    expect(searchAssets([asset], "triage")).toEqual([asset]);
  });
});
