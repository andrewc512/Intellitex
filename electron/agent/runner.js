const { definitions, executeTool } = require('./tools');
const { SYSTEM_PROMPT, buildContext } = require('./prompts');

const MODEL = 'gpt-4o-mini';

/**
 * Single-shot agent call with tool support.
 *
 * Sends one request to OpenAI with the tool definitions.
 * If the model calls tools, executes them and makes one follow-up call
 * so the model can summarise what it did. No multi-turn loop for now.
 */
async function runAgent(context, userPrompt, apiKey, onProgress) {
  const progress = onProgress || (() => {});
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${buildContext(context)}\n\nUser request: ${userPrompt}` },
  ];

  const editedFiles = {};

  progress('Analyzing your request...');
  const first = await callOpenAI(messages, apiKey);
  messages.push(first);

  if (!first.tool_calls || first.tool_calls.length === 0) {
    return { message: first.content ?? '', editedFiles };
  }

  for (const tc of first.tool_calls) {
    const toolName = tc.function.name;
    progress(`Running ${toolName.replace(/_/g, ' ')}...`);
    const args = safeParse(tc.function.arguments);
    const result = await executeTool(toolName, args);

    if (result.newContent !== undefined && args.path) {
      editedFiles[args.path] = result.newContent;
    }

    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
  }

  progress('Summarizing changes...');
  const second = await callOpenAI(messages, apiKey);

  return { message: second.content ?? '', editedFiles };
}

// ── helpers ──────────────────────────────────────────────────────────

async function callOpenAI(messages, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: definitions,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error('No response from OpenAI');
  return msg;
}

function safeParse(str) {
  try { return JSON.parse(str); }
  catch { return {}; }
}

module.exports = { runAgent };
