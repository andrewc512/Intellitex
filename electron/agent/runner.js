const OpenAI = require('openai');
const { definitions, executeTool } = require('./tools');
const { getSystemPrompt, buildContext, getRelevantItekReference } = require('./prompts');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '120000', 10);
const MAX_ITERATIONS = parseInt(process.env.OPENAI_MAX_ITERATIONS || '15', 10);
const MAX_OUTPUT_TOKENS = parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '16384', 10);

/**
 * Agentic loop with tool support.
 *
 * Sends repeated requests to OpenAI with tool definitions.
 * If the model calls tools, executes them and continues until it
 * returns a final response or reaches MAX_ITERATIONS.
 */
async function runAgent(context, userPrompt, apiKey, onProgress, history, { model } = {}) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  const hasHistory = Array.isArray(history) && history.length > 0;
  const messages = buildMessages(context, userPrompt, hasHistory);

  // Filter tool definitions based on file type to reduce token overhead
  const isItek = context.filePath && context.filePath.endsWith('.itek');
  const toolDefs = isItek
    ? definitions
    : definitions.filter((d) => d.function.name !== 'lookup_itek_reference');

  const editedFiles = {};

  // ── Programmatic state tracking ──────────────────────────────────────
  const state = {
    goal: userPrompt,
    completedSteps: [],   // e.g. "str_replace on line 12 — success"
    errors: [],           // active errors from last tool calls
  };

  let lastAssistant = null;
  // Track assistant + tool messages from this agentic session so we can
  // replay them after rebuilding the base messages with fresh file content.
  const agentTurns = [];

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const step = i + 1;
    const status =
      step === 1
        ? 'Analyzing your request...'
        : `Continuing (${step}/${MAX_ITERATIONS})...`;
    progress({ type: 'status', message: status });

    // Inject state message every iteration so the model never loses track
    // of the goal, progress, and errors.
    messages.push({ role: 'system', content: buildStateMessage(state) });

    const assistant = await callOpenAIStream(messages, toolDefs, apiKey, model || DEFAULT_MODEL);
    messages.push(assistant);
    agentTurns.push(assistant);
    lastAssistant = assistant;

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      const { cleaned, summary } = extractSummaryBlock(assistant.content ?? '');
      // Emit the fully cleaned response as a single delta — no intermediate
      // content, think blocks, or summary blocks ever reach the user.
      if (cleaned) progress({ type: 'delta', content: cleaned });
      return { message: cleaned, summary, editedFiles };
    }

    let hadError = false;
    state.errors = [];

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

      // Track step outcome for state
      const stepLabel = summarizeToolStep(toolName, args, result);
      if (result.error) {
        hadError = true;
        state.errors.push(stepLabel);
      }
      state.completedSteps.push(stepLabel);

      // Send a concise result to the model — strip full file content to avoid
      // bloating the conversation context and wasting tokens.
      const toolResponse = { ...result };
      delete toolResponse.newContent;

      const toolMsg = { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResponse) };
      messages.push(toolMsg);
      agentTurns.push(toolMsg);
    }

    // ── Re-inject fresh file content after edits ──────────────────────
    // Update context.content so the next iteration sees the latest file state,
    // then rebuild the base messages (system + context) from scratch.
    for (const [fp, content] of Object.entries(editedFiles)) {
      if (fp === context.filePath) {
        context.content = content;
      }
    }
    messages.length = 0;
    messages.push(...buildMessages(context, userPrompt, hasHistory));
    messages.push(...agentTurns);

    // If a tool call failed, inject the current file content so the model
    // can see exactly what's in the file and self-correct on the next attempt.
    if (hadError) {
      const lines = context.content ? context.content.split('\n') : [];
      const numberedContent = lines.map((l, i) => `${i + 1}: ${l}`).join('\n');
      const recovery = {
        role: 'system',
        content:
          'A tool call failed. Here is the CURRENT file content — read it carefully before retrying. ' +
          'Copy strings exactly as they appear below.\n\n' +
          `Current file content (${lines.length} lines):\n${numberedContent}`,
      };
      messages.push(recovery);
    }
  }

  const fallback =
    lastAssistant?.content?.trim() ||
    `Reached the maximum number of iterations (${MAX_ITERATIONS}) before producing a final response. ` +
      'Please ask me to continue.';

  return { message: fallback, editedFiles };
}

// ── state helpers ────────────────────────────────────────────────────

function buildStateMessage(state) {
  const parts = ['## Current State'];
  parts.push(`Goal: ${state.goal}`);

  if (state.completedSteps.length > 0) {
    parts.push('\nProgress:');
    for (const step of state.completedSteps) {
      parts.push(`- ${step}`);
    }
  }

  const errorStr = state.errors.length > 0 ? state.errors.join('; ') : 'None';
  parts.push(`\nErrors: ${errorStr}`);
  parts.push('\nExecute the next step. When all steps are done, respond to the user.');
  return parts.join('\n');
}

function summarizeToolStep(toolName, args, result) {
  const success = result.error ? 'FAILED' : 'success';
  switch (toolName) {
    case 'str_replace':
      return `str_replace in ${args.path || 'file'} — ${success}`;
    case 'line_replace':
      return `line_replace lines ${args.start_line}-${args.end_line} in ${args.path || 'file'} — ${success}`;
    case 'write_file':
      return `write_file ${args.path || 'file'} — ${success}`;
    case 'read_file':
      return `read_file ${args.path || 'file'} — ${success}`;
    case 'compile_file': {
      if (result.error) return `compile_file — ${result.errors?.length || 0} errors`;
      return `compile_file — ${success}`;
    }
    case 'lookup_itek_reference':
      return `lookup_itek_reference(${args.topic || '?'}) — ${success}`;
    default:
      return `${toolName} — ${success}`;
  }
}

// ── helpers ──────────────────────────────────────────────────────────

async function callOpenAIStream(messages, toolDefs, apiKey, model) {
  const client = new OpenAI({ apiKey });
  let stream;
  try {
    stream = await client.chat.completions.create(
      {
        model: model || DEFAULT_MODEL,
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

  const message = await readStreamedMessage(stream);
  if (!message) throw new Error('No response from OpenAI');
  return message;
}

async function readStreamedMessage(stream) {
  let content = '';
  const toolCallsByIndex = new Map();

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta || {};

    if (delta.tool_calls) {
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
      continue;
    }

    if (delta.content) {
      content += delta.content;
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

function stripThinkBlocks(text) {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
}

function extractSummaryBlock(content) {
  const startToken = '[[SUMMARY]]';
  const endToken = '[[/SUMMARY]]';
  if (!content) return { cleaned: '', summary: null };
  // Strip <think> blocks before returning to user
  let text = stripThinkBlocks(content);
  const start = text.lastIndexOf(startToken);
  const end = text.lastIndexOf(endToken);
  if (start === -1 || end === -1 || end <= start) {
    return { cleaned: text.trim(), summary: null };
  }
  const summary = text.slice(start + startToken.length, end).trim();
  const cleaned = (text.slice(0, start) + text.slice(end + endToken.length)).trim();
  return { cleaned, summary: summary || null };
}

function safeParse(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch { return {}; }
}

function buildMessages(context, userPrompt, hasHistory) {
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

  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

module.exports = { runAgent };
