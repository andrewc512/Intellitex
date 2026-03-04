const OpenAI = require('openai');
const { definitions, executeTool } = require('./tools');
const { getSystemPrompt, buildContext, getRelevantItekReference, PLANNING_PROMPT, EXECUTION_PROMPT } = require('./prompts');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '120000', 10);
const MAX_ITERATIONS = parseInt(process.env.OPENAI_MAX_ITERATIONS || '15', 10);
const PLAN_OUTPUT_TOKENS = parseInt(process.env.OPENAI_PLAN_OUTPUT_TOKENS || '1024', 10);
const EXEC_OUTPUT_TOKENS = parseInt(process.env.OPENAI_EXEC_OUTPUT_TOKENS || '4096', 10);
const MAX_HISTORY_TURNS = parseInt(process.env.OPENAI_MAX_HISTORY_TURNS || '8', 10);
const MAX_HISTORY_TURNS_SUMMARIZED = parseInt(process.env.OPENAI_MAX_HISTORY_TURNS_SUMMARIZED || '4', 10);
const MAX_HISTORY_CHARS_SUMMARIZED = parseInt(process.env.OPENAI_MAX_HISTORY_CHARS_SUMMARIZED || '2000', 10);

/**
 * Agentic loop with tool support.
 *
 * Sends repeated requests to OpenAI with tool definitions.
 * If the model calls tools, executes them and continues until it
 * returns a final response or reaches MAX_ITERATIONS.
 */
async function runAgent(context, userPrompt, apiKey, onProgress, history) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};

  // Filter tool definitions based on file type to reduce token overhead
  const isItek = context.filePath && context.filePath.endsWith('.itek');
  const toolDefs = isItek
    ? definitions
    : definitions.filter((d) => d.function.name !== 'lookup_itek_reference');

  // ── Phase 1: Planning (no tools) ────────────────────────────────────
  progress({ type: 'status', message: 'Planning approach...' });

  const planMessages = buildMessages(context, userPrompt, history);
  planMessages.push({ role: 'system', content: PLANNING_PROMPT });

  // Call with no tools, no streaming to user (silent planning), small token limit
  const planAssistant = await callOpenAIStream(planMessages, null, apiKey, () => {}, PLAN_OUTPUT_TOKENS);
  const planText = extractPlan(planAssistant.content ?? '');
  const rawContent = planAssistant.content ?? '';
  console.log('[agent] plan:', planText || rawContent);

  // If plan type is "answer", return immediately — no execution needed
  if (planText) {
    const planType = parsePlanType(planText);
    if (planType === 'answer') {
      const answer = extractPlanAnswer(planText);
      if (answer) {
        const { cleaned, summary } = extractSummaryBlock(answer);
        return { message: cleaned, summary, editedFiles: {} };
      }
    }
  }

  // Use extracted plan, or fall back to raw content as plan context
  const effectivePlan = planText || rawContent;

  // ── Phase 2: Execution loop (with tools, plan injected) ─────────────
  progress({ type: 'status', message: 'Executing plan...' });

  const editedFiles = {};
  let lastAssistant = null;
  const agentTurns = [];

  // Build base messages once — system prompt, context, history, user prompt.
  // We only rebuild when file content changes after edits.
  let baseMessages = buildMessages(context, userPrompt, history);
  // Index of the context system message so we can swap it on edits
  const contextMsgIdx = baseMessages.findIndex(
    (m) => m.role === 'system' && m.content.startsWith('Context:\n')
  );

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const step = i + 1;
    if (step > 1) {
      progress({ type: 'status', message: `Continuing (${step}/${MAX_ITERATIONS})...` });
    }

    // Assemble messages: base + plan (first iteration only) + agent turns
    const messages = [...baseMessages];
    if (i === 0) {
      messages.push({ role: 'system', content: EXECUTION_PROMPT + effectivePlan });
    }
    messages.push(...agentTurns);

    // Buffer deltas instead of streaming directly — we only want the user
    // to see the final response, not intermediate reasoning during tool use.
    const bufferedDeltas = [];
    const bufferingProgress = (event) => {
      if (event.type === 'delta') {
        bufferedDeltas.push(event.content);
      } else {
        progress(event); // pass through status/reset events
      }
    };

    const assistant = await callOpenAIStream(messages, toolDefs, apiKey, bufferingProgress);
    agentTurns.push(assistant);
    lastAssistant = assistant;

    if (assistant.tool_calls && assistant.tool_calls.length > 0) {
      // Intermediate iteration — log thinking to console, don't show to user
      const thinking = bufferedDeltas.join('');
      if (thinking) console.log('[agent] thinking:', thinking);
    } else {
      // Final response — replay buffered deltas to the user
      for (const delta of bufferedDeltas) {
        progress({ type: 'delta', content: delta });
      }
      const { cleaned, summary } = extractSummaryBlock(assistant.content ?? '');
      return { message: cleaned, summary, editedFiles };
    }

    let hadError = false;

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

      if (result.error) hadError = true;

      const toolResponse = { ...result };
      delete toolResponse.newContent;

      const toolMsg = { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResponse) };
      agentTurns.push(toolMsg);
    }

    // If the active file was edited, refresh only the context message in
    // baseMessages instead of rebuilding everything from scratch.
    let fileRefreshed = false;
    for (const [fp, content] of Object.entries(editedFiles)) {
      if (fp === context.filePath) {
        context.content = content;
        fileRefreshed = true;
      }
    }
    if (fileRefreshed && contextMsgIdx !== -1) {
      // Rebuild just the context system message with updated file content
      const dynamicContext = buildContext(context);
      const itekRefText = isItek ? getRelevantItekReference(context.content) : null;
      const parts = [];
      if (dynamicContext && dynamicContext.trim()) parts.push(dynamicContext);
      if (itekRefText) parts.push(itekRefText);
      if (parts.length > 0) {
        baseMessages[contextMsgIdx] = { role: 'system', content: `Context:\n${parts.join('\n\n')}` };
      }
    }

    // If a tool call failed, nudge the model to re-read context — don't
    // duplicate the entire file content into agentTurns.
    if (hadError) {
      agentTurns.push({
        role: 'system',
        content:
          'A tool call failed. Re-read the file content provided in the Context message above ' +
          'and copy strings exactly as they appear. Pay attention to whitespace.',
      });
    }
  }

  const fallback =
    lastAssistant?.content?.trim() ||
    `Reached the maximum number of iterations (${MAX_ITERATIONS}) before producing a final response. ` +
      'Please ask me to continue.';

  return { message: fallback, editedFiles };
}

// ── helpers ──────────────────────────────────────────────────────────

async function callOpenAIStream(messages, toolDefs, apiKey, progress, maxTokens) {
  const client = new OpenAI({ apiKey });
  const params = {
    model: MODEL,
    messages,
    temperature: 0,
    max_completion_tokens: maxTokens || EXEC_OUTPUT_TOKENS,
    stream: true,
  };
  if (toolDefs && toolDefs.length > 0) {
    params.tools = toolDefs;
  }
  let stream;
  try {
    stream = await client.chat.completions.create(params, { timeout: REQUEST_TIMEOUT_MS });
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

function stripThinkBlocks(text) {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
}

function stripPlanBlocks(text) {
  if (!text) return text;
  return text.replace(/<plan>[\s\S]*?<\/plan>\s*/g, '');
}

function extractPlan(content) {
  if (!content) return null;
  const match = content.match(/<plan>([\s\S]*?)<\/plan>/);
  return match ? match[1].trim() : null;
}

function parsePlanType(planText) {
  if (!planText) return 'edit';
  const match = planText.match(/^type:\s*(answer|edit)/m);
  return match ? match[1] : 'edit';
}

function extractPlanAnswer(planText) {
  if (!planText) return null;
  const match = planText.match(/^response:\s*([\s\S]*)/m);
  return match ? match[1].trim() : null;
}

function extractSummaryBlock(content) {
  const startToken = '[[SUMMARY]]';
  const endToken = '[[/SUMMARY]]';
  if (!content) return { cleaned: '', summary: null };
  // Strip <think> and <plan> blocks before returning to user
  let text = stripPlanBlocks(stripThinkBlocks(content));
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
