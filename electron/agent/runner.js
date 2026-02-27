const { definitions, executeTool } = require('./tools');
const { SYSTEM_PROMPT, buildContext } = require('./prompts');

const MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10);

/**
 * Single-shot agent call with tool support.
 *
 * Sends one request to OpenAI with the tool definitions.
 * If the model calls tools, executes them and makes one follow-up call
 * so the model can summarise what it did. No multi-turn loop for now.
 */
async function runAgent(context, userPrompt, apiKey, onProgress) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${buildContext(context)}\n\nUser request: ${userPrompt}` },
  ];

  const editedFiles = {};

  progress({ type: 'status', message: 'Analyzing your request...' });
  const first = await callOpenAIStream(messages, apiKey, progress);
  messages.push(first);

  if (!first.tool_calls || first.tool_calls.length === 0) {
    return { message: first.content ?? '', editedFiles };
  }

  for (const tc of first.tool_calls) {
    const toolName = tc.function.name;
    progress({ type: 'status', message: `Running ${toolName.replace(/_/g, ' ')}...` });
    const args = safeParse(tc.function.arguments);
    const result = await executeTool(toolName, args);

    if (result.newContent !== undefined && args.path) {
      editedFiles[args.path] = result.newContent;
    }

    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
  }

  progress({ type: 'status', message: 'Summarizing changes...' });
  const second = await callOpenAIStream(messages, apiKey, progress);

  return { message: second.content ?? '', editedFiles };
}

// ── helpers ──────────────────────────────────────────────────────────

async function callOpenAIStream(messages, apiKey, progress) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: definitions,
        temperature: 0.3,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`OpenAI request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errJson;
    try { errJson = JSON.parse(errText); } catch { errJson = null; }
    const msg = errJson?.error?.message || errText || `OpenAI API error: ${res.status}`;
    throw new Error(msg);
  }

  if (!res.body) throw new Error('OpenAI response has no body');

  const message = await readStreamedMessage(res.body, progress);
  if (!message) throw new Error('No response from OpenAI');
  return message;
}

async function readStreamedMessage(body, progress) {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let sawToolCalls = false;
  let sentDelta = false;
  const toolCallsByIndex = new Map();

  if (progress) progress({ type: 'reset' });

  for await (const chunk of streamChunks(body)) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === '[DONE]') return buildMessage(content, toolCallsByIndex);

      let payload;
      try { payload = JSON.parse(data); }
      catch { continue; }

      const choice = payload.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};

      if (delta.tool_calls) {
        sawToolCalls = true;
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const current = toolCallsByIndex.get(idx) || {
            id: tc.id,
            type: tc.type || 'function',
            function: { name: '', arguments: '' },
          };
          if (tc.id) current.id = tc.id;
          if (tc.function?.name) current.function.name = tc.function.name;
          if (tc.function?.arguments) current.function.arguments += tc.function.arguments;
          toolCallsByIndex.set(idx, current);
        }
        if (sentDelta && progress) {
          progress({ type: 'reset' });
          sentDelta = false;
        }
        continue;
      }

      if (delta.content) {
        content += delta.content;
        if (progress && !sawToolCalls) {
          progress({ type: 'delta', content: delta.content });
          sentDelta = true;
        }
      }
    }
  }

  return buildMessage(content, toolCallsByIndex);
}

function buildMessage(content, toolCallsByIndex) {
  const toolCalls = Array.from(toolCallsByIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1]);

  const msg = { role: 'assistant', content: content ?? '' };
  if (toolCalls.length) msg.tool_calls = toolCalls;
  return msg;
}

async function* streamChunks(body) {
  if (body.getReader) {
    const reader = body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) yield value;
    }
    return;
  }
  for await (const chunk of body) {
    if (chunk) yield chunk;
  }
}

function safeParse(str) {
  try { return JSON.parse(str); }
  catch { return {}; }
}

module.exports = { runAgent };
