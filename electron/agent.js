/**
 * OpenAI Agent Module for LaTeX file editing
 */

const SYSTEM_PROMPT = `You are a LaTeX editing assistant. You can ONLY work with LaTeX-related files:
- .tex (LaTeX source files)
- .bib (BibTeX bibliography files)
- .cls (LaTeX class files)
- .sty (LaTeX style files)

You must respond with valid JSON in the following format:
{
  "thinking": "Your explanation of the approach you're taking",
  "edits": [
    {
      "range": {
        "startLine": 1,
        "startCol": 1,
        "endLine": 1,
        "endCol": 10
      },
      "newText": "replacement text"
    }
  ],
  "message": "A human-readable summary of what you did"
}

IMPORTANT RULES:
1. Line numbers are 1-indexed (first line is line 1, not line 0)
2. Column numbers are 1-indexed (first character is column 1)
3. The range is inclusive on both ends
4. To insert text without replacing, use the same position for start and end
5. To delete text, use an empty string for newText
6. Multiple edits should be listed in order from top to bottom of the file
7. If no edits are needed, return an empty edits array

LaTeX Best Practices:
- Use proper document structure (\\documentclass, \\begin{document}, \\end{document})
- Prefer semantic markup over visual formatting
- Use appropriate environments (equation, figure, table, etc.)
- Include necessary packages with \\usepackage{}
- Use \\label{} and \\ref{} for cross-references
- Properly escape special characters (%, $, &, #, _, {, }, ~, ^, \\)
- Use BibTeX/BibLaTeX for citations when appropriate`;

/**
 * Build context string from agent context
 */

function buildContext(context) {
  const parts = [];

  if (context.filePath) {
    parts.push(`File: ${context.filePath}`);
  }

  if (context.content) {
    parts.push(`\nCurrent content:\n\`\`\`\n${context.content}\n\`\`\``);
  }

  if (context.selection) {
    parts.push(
      `\nSelected lines: ${context.selection.startLine} to ${context.selection.endLine}`
    );
  }

  if (context.compileErrors && context.compileErrors.length > 0) {
    parts.push("\nCompile errors:");
    for (const err of context.compileErrors) {
      parts.push(`  - Line ${err.line} in ${err.file}: ${err.message}`);
    }
  }

  return parts.join("\n");
}

/**
 * Process a user prompt with the OpenAI agent
 */
async function processAgentRequest(context, userPrompt, apiKey) {
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const contextString = buildContext(context);
  const userMessage = `${contextString}\n\nUser request: ${userPrompt}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `OpenAI API error: ${response.status}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response content from OpenAI");
  }

  const parsed = JSON.parse(content);

  // Validate response structure
  if (typeof parsed.thinking !== "string") {
    parsed.thinking = "";
  }
  if (!Array.isArray(parsed.edits)) {
    parsed.edits = [];
  }
  if (typeof parsed.message !== "string") {
    parsed.message = "";
  }

  // Add filePath to each edit if not present
  for (const edit of parsed.edits) {
    if (!edit.filePath && context.filePath) {
      edit.filePath = context.filePath;
    }
  }

  return parsed;
}

/**
 * Check if the OpenAI API key is available
 */
function checkApiKey() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get the OpenAI API key from environment
 */
function getApiKey() {
  return process.env.OPENAI_API_KEY || null;
}

module.exports = {
  processAgentRequest,
  checkApiKey,
  getApiKey,
};
