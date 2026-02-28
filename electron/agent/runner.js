const OpenAI = require('openai');
const { definitions, executeTool } = require('./tools');
const { getSystemPrompt, buildContext, getRelevantItekReference } = require('./prompts');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '120000', 10);
const MAX_ITERATIONS = parseInt(process.env.OPENAI_MAX_ITERATIONS || '15', 10);
const MAX_OUTPUT_TOKENS = parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '4096', 10);
const MAX_HISTORY_TURNS = parseInt(process.env.OPENAI_MAX_HISTORY_TURNS || '8', 10);
const MAX_HISTORY_TURNS_SUMMARIZED = parseInt(process.env.OPENAI_MAX_HISTORY_TURNS_SUMMARIZED || '2', 10);
const MAX_HISTORY_CHARS_SUMMARIZED = parseInt(process.env.OPENAI_MAX_HISTORY_CHARS_SUMMARIZED || '800', 10);

/**
 * Agentic loop with tool support.
 *
 * Sends repeated requests to OpenAI with tool definitions.
 * If the model calls tools, executes them and continues until it
 * returns a final response or reaches MAX_ITERATIONS.
 */
async function runAgent(context, userPrompt, apiKey, onProgress, history) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  const messages = buildMessages(context, userPrompt, history);

  // Filter tool definitions based on file type to reduce token overhead
  const isItek = context.filePath && context.filePath.endsWith('.itek');
  const toolDefs = isItek
    ? definitions
    : definitions.filter((d) => d.function.name !== 'lookup_itek_reference');

  const editedFiles = {};

  let lastAssistant = null;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const step = i + 1;
    const status =
      step === 1
        ? 'Analyzing your request...'
        : `Continuing (${step}/${MAX_ITERATIONS})...`;
    progress({ type: 'status', message: status });

    const assistant = await callOpenAIStream(messages, toolDefs, apiKey, progress);
    messages.push(assistant);
    lastAssistant = assistant;

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      const { cleaned, summary } = extractSummaryBlock(assistant.content ?? '');
      return { message: cleaned, summary, editedFiles };
    }

    for (const tc of assistant.tool_calls) {
      const toolName = tc.function.name;
      const toolLabel = `Running ${toolName.replace(/_/g, ' ')}...`;
      progress({ type: 'status', message: toolLabel });
      const args = safeParse(tc.function.arguments);
      console.log(`[agent] tool_call: ${toolName}`, JSON.stringify(args, null, 2));
      const result = await executeTool(toolName, args);
      console.log(`[agent] tool_result: ${toolName}`, JSON.stringify(result, null, 2).slice(0, 500));

      if (result.newContent !== undefined && args.path) {
        editedFiles[args.path] = result.newContent;
      }

      // Send a concise result to the model — strip full file content to avoid
      // bloating the conversation context and wasting tokens.
      const toolResponse = { ...result };
      delete toolResponse.newContent;

      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResponse) });
    }
  }

  const fallback =
    lastAssistant?.content?.trim() ||
    `Reached the maximum number of iterations (${MAX_ITERATIONS}) before producing a final response. ` +
      'Please ask me to continue.';

  return { message: fallback, editedFiles };
}

// ── helpers ──────────────────────────────────────────────────────────

async function callOpenAIStream(messages, toolDefs, apiKey, progress) {
  const client = new OpenAI({ apiKey });
  let stream;
  try {
    stream = await client.chat.completions.create(
      {
        model: MODEL,
        messages,
        tools: toolDefs,
        temperature: 0,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
  } catch (err) {
    if (err && err.name === 'APIConnectionTimeoutError') {
      throw new Error(`OpenAI request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  }

  const message = await readStreamedMessage(stream, progress);
  if (!message) throw new Error('No response from OpenAI');
  return message;
}

async function readStreamedMessage(stream, progress) {
  let content = '';
  let sawToolCalls = false;
  let sentDelta = false;
  const toolCallsByIndex = new Map();

  if (progress) progress({ type: 'reset' });

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
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

function extractSummaryBlock(content) {
  const startToken = '[[SUMMARY]]';
  const endToken = '[[/SUMMARY]]';
  if (!content) return { cleaned: '', summary: null };
  const start = content.lastIndexOf(startToken);
  const end = content.lastIndexOf(endToken);
  if (start === -1 || end === -1 || end <= start) {
    return { cleaned: content.trim(), summary: null };
  }
  const summary = content.slice(start + startToken.length, end).trim();
  const cleaned = (content.slice(0, start) + content.slice(end + endToken.length)).trim();
  return { cleaned, summary: summary || null };
}

function safeParse(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch { return {}; }
}

function buildMessages(context, userPrompt, history) {
  const hasHistory = Array.isArray(history) && history.length > 0;
  const messages = [{ role: 'system', content: getSystemPrompt(context.filePath, hasHistory) }];

  // Build dynamic context with file content inlined
  const dynamicContext = buildContext(context);

  // For .itek files, inline the relevant section references so the model
  // doesn't need to call lookup_itek_reference as its first action.
  const isItek = context.filePath && context.filePath.endsWith('.itek');
  const itekRef = isItek ? getRelevantItekReference(context.content) : null;

  const contextParts = [];
  if (dynamicContext && dynamicContext.trim()) contextParts.push(dynamicContext);
  if (itekRef) contextParts.push(itekRef);

  if (contextParts.length > 0) {
    messages.push({ role: 'system', content: `Context:\n${contextParts.join('\n\n')}` });
  }

  // Append the last N conversation turns so the model has multi-turn memory
  // without unbounded token growth.
  if (hasHistory) {
    const eligible = history.filter((m) => m.role === 'user' || m.role === 'assistant');
    const hasSummary = !!context.summary;
    const maxTurns = hasSummary ? MAX_HISTORY_TURNS_SUMMARIZED : MAX_HISTORY_TURNS;
    const trimmed = eligible.slice(-maxTurns).map((m) => {
      if (!hasSummary) return m;
      if (typeof m.content !== 'string') return m;
      if (m.content.length <= MAX_HISTORY_CHARS_SUMMARIZED) return m;
      return { ...m, content: `${m.content.slice(0, MAX_HISTORY_CHARS_SUMMARIZED)}…` };
    });
    for (const msg of trimmed) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

module.exports = { runAgent };
