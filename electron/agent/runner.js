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
async function runAgent(context, userPrompt, apiKey) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${buildContext(context)}\n\nUser request: ${userPrompt}` },
  ];

  const editedFiles = {};

  // First call — may or may not use tools
  const first = await callOpenAI(messages, apiKey);
  messages.push(first);

  // No tool calls — simple answer, we're done
  if (!first.tool_calls || first.tool_calls.length === 0) {
    return { message: first.content ?? '', editedFiles };
  }

  // Execute every tool the model asked for
  for (const tc of first.tool_calls) {
    const args = safeParse(tc.function.arguments);
    const result = await executeTool(tc.function.name, args);

    if (result.newContent !== undefined && args.path) {
      editedFiles[args.path] = result.newContent;
    }

    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
  }

  // Follow-up so the model can summarise the tool results
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
