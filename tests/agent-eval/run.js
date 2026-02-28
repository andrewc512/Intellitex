#!/usr/bin/env node

/**
 * Agent Evaluation Test Runner
 *
 * Sends a batch of prompts to the agent (processAgentRequest) with sample
 * .tex / .itek fixture files and writes a JSON report of every response.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node tests/agent-eval/run.js
 *
 * Flags:
 *   --filter <category>   Only run tests in a category (edit, read, documentation, multi-step)
 *   --filter-id <id>      Run a single test by ID
 *   --file-type <type>    Only run tests for a file type (tex | itek)
 *   --no-judge            Skip LLM verification pass
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { processAgentRequest } = require('../../electron/agent');

const JUDGE_MODEL_STRONG = process.env.EVAL_JUDGE_MODEL_STRONG || 'gpt-4o';
const JUDGE_MODEL_LIGHT = process.env.EVAL_JUDGE_MODEL_LIGHT || 'gpt-4o-mini';

// ── paths ────────────────────────────────────────────────────────────────────
const PROMPTS_PATH = path.join(__dirname, 'prompts.json');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RESULTS_DIR = path.join(__dirname, 'results');

// ── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { filter: null, filterId: null, fileType: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--filter' && args[i + 1]) opts.filter = args[++i];
    else if (args[i] === '--filter-id' && args[i + 1]) opts.filterId = args[++i];
    else if (args[i] === '--file-type' && args[i + 1]) opts.fileType = args[++i];
  }
  return opts;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function copyFixture(fileType) {
  const ext = fileType === 'itek' ? '.itek' : '.tex';
  const src = path.join(FIXTURES_DIR, `sample${ext}`);
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'agent-eval-'));
  const dest = path.join(tmpDir, `sample${ext}`);
  fs.copyFileSync(src, dest);
  return dest;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── LLM judge ───────────────────────────────────────────────────────────────

function buildJudgePrompt(result, originalContent) {
  const editedContent = Object.values(result.editedFiles)[0] || null;

  let prompt = `You are a strict evaluator for an AI code-editing agent. Judge whether the agent correctly fulfilled the user's request.

## User prompt
${result.prompt}

## Test description
${result.description}

## Category
${result.category}

## Agent response message
${result.agentMessage || '(no message)'}
`;

  if (result.category === 'edit' || result.category === 'multi-step') {
    prompt += `
## Original file content
\`\`\`
${originalContent}
\`\`\`

## Edited file content
\`\`\`
${editedContent || '(no edits made)'}
\`\`\`

Evaluate:
1. Did the agent make the requested change correctly?
2. Did the agent make ONLY the requested change (no unintended modifications)?
3. Is the output valid ${result.fileType === 'itek' ? 'itek' : 'LaTeX'} syntax? (e.g. no unescaped % in LaTeX, correct field quoting in itek)
4. For multi-step: were ALL steps completed?
`;
  } else if (result.category === 'read') {
    prompt += `
## Original file content
\`\`\`
${originalContent}
\`\`\`

Evaluate:
1. Is the agent's answer factually correct based on the file content?
2. Did the agent avoid making any file edits? (it should not have)
`;
  } else if (result.category === 'documentation') {
    prompt += `
Evaluate:
1. Is the agent's answer technically accurate?
2. Is it relevant to the question asked?
`;
  }

  prompt += `
Respond with ONLY valid JSON (no markdown fences):
{
  "pass": true or false,
  "score": 1-5 (5 = perfect, 4 = correct with minor issues, 3 = mostly correct, 2 = partially correct, 1 = wrong),
  "issues": ["list of specific issues found, or empty array if none"]
}`;

  return prompt;
}

async function judgeResults(results, fixturesContent, apiKey) {
  const client = new OpenAI({ apiKey });
  const judgements = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const label = `[${i + 1}/${results.length}] ${r.id}`;

    // Skip tests that errored at the infra level
    if (r.error) {
      judgements.push({ pass: null, score: null, issues: ['skipped — agent error'] });
      process.stdout.write(`  ${label} ... skipped (error)\n`);
      continue;
    }

    process.stdout.write(`  ${label} ... `);
    const original = fixturesContent[r.fileType];
    const prompt = buildJudgePrompt(r, original);
    const model = (r.category === 'edit' || r.category === 'multi-step')
      ? JUDGE_MODEL_STRONG
      : JUDGE_MODEL_LIGHT;

    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_completion_tokens: 256,
      });
      const text = resp.choices[0].message.content.trim();
      const judgement = JSON.parse(text);
      judgements.push(judgement);
      const icon = judgement.pass ? 'pass' : 'FAIL';
      const issueHint = judgement.issues.length > 0 ? ` — ${judgement.issues[0]}` : '';
      console.log(`${icon} (${judgement.score}/5)${issueHint}`);
    } catch (err) {
      judgements.push({ pass: null, score: null, issues: [`judge error: ${err.message}`] });
      console.log(`judge error — ${err.message}`);
    }
  }

  return judgements;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required.');
    process.exit(1);
  }

  const opts = parseArgs();
  let prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf-8'));

  // Apply filters
  if (opts.filterId) {
    prompts = prompts.filter((p) => p.id === opts.filterId);
  }
  if (opts.filter) {
    prompts = prompts.filter((p) => p.category === opts.filter);
  }
  if (opts.fileType) {
    prompts = prompts.filter((p) => p.fileType === opts.fileType);
  }

  if (prompts.length === 0) {
    console.error('No prompts matched the given filters.');
    process.exit(1);
  }

  console.log(`\n  Agent Evaluation Suite`);
  console.log(`  ─────────────────────`);
  console.log(`  Tests to run: ${prompts.length}`);
  console.log(`  Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}\n`);

  const DELAY_MS = parseInt(process.env.EVAL_DELAY_MS || '5000', 10);
  const ITEK_DELAY_MS = parseInt(process.env.EVAL_ITEK_DELAY_MS || '15000', 10);
  const skipJudge = process.argv.includes('--no-judge');

  // Cache original fixture content for the judge
  const fixturesContent = {};
  for (const ext of ['tex', 'itek']) {
    const fixturePath = path.join(FIXTURES_DIR, `sample.${ext}`);
    if (fs.existsSync(fixturePath)) fixturesContent[ext] = fs.readFileSync(fixturePath, 'utf-8');
  }

  const results = [];
  const startAll = Date.now();

  for (let i = 0; i < prompts.length; i++) {
    if (i > 0) {
      const prevType = prompts[i - 1].fileType;
      const delay = prevType === 'itek' ? ITEK_DELAY_MS : DELAY_MS;
      await new Promise((r) => setTimeout(r, delay));
    }
    const test = prompts[i];
    const label = `[${i + 1}/${prompts.length}] ${test.id}`;
    process.stdout.write(`  ${label} ... `);

    // Fresh copy of fixture file for this test
    const tmpFile = copyFixture(test.fileType);
    const fileContent = fs.readFileSync(tmpFile, 'utf-8');

    const context = {
      filePath: tmpFile,
      content: fileContent,
    };

    // Track tool calls via progress callback
    const toolsUsed = [];
    const progressLog = [];
    const onProgress = (status) => {
      progressLog.push(status);
      if (status.type === 'status' && status.message.startsWith('Running ')) {
        const toolName = status.message.replace('Running ', '').replace('...', '').replace(/ /g, '_');
        toolsUsed.push(toolName);
      }
    };

    const startOne = Date.now();
    let result;

    try {
      const response = await processAgentRequest(context, test.prompt, apiKey, onProgress, []);
      const durationMs = Date.now() - startOne;

      result = {
        id: test.id,
        category: test.category,
        fileType: test.fileType,
        prompt: test.prompt,
        description: test.description,
        agentMessage: response.message,
        editedFiles: response.editedFiles || {},
        toolsUsed,
        durationMs,
        error: null,
      };

      const editCount = Object.keys(result.editedFiles).length;
      const editInfo = editCount > 0 ? ` (${editCount} file${editCount > 1 ? 's' : ''} edited)` : '';
      console.log(`done ${formatDuration(durationMs)}${editInfo}`);
    } catch (err) {
      const durationMs = Date.now() - startOne;
      result = {
        id: test.id,
        category: test.category,
        fileType: test.fileType,
        prompt: test.prompt,
        description: test.description,
        agentMessage: null,
        editedFiles: {},
        toolsUsed,
        durationMs,
        error: err.message,
      };
      console.log(`ERROR ${formatDuration(durationMs)} — ${err.message}`);
    }

    results.push(result);

    // Clean up temp file
    try {
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(path.dirname(tmpFile));
    } catch {
      // ignore cleanup errors
    }
  }

  const totalDuration = Date.now() - startAll;

  // ── LLM verification ──────────────────────────────────────────────────────
  let judgements = null;
  if (!skipJudge) {
    console.log(`\n  LLM Verification (${JUDGE_MODEL_STRONG} / ${JUDGE_MODEL_LIGHT})`);
    console.log(`  ─────────────────────`);
    judgements = await judgeResults(results, fixturesContent, apiKey);

    // Merge judgements into results
    for (let i = 0; i < results.length; i++) {
      results[i].judgement = judgements[i];
    }
  }

  // ── Write report ─────────────────────────────────────────────────────────
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(RESULTS_DIR, `${timestamp}.json`);

  const judgedResults = judgements ? results.filter((r) => r.judgement?.pass !== null) : [];
  const judgedPass = judgedResults.filter((r) => r.judgement?.pass).length;
  const avgScore = judgedResults.length > 0
    ? (judgedResults.reduce((s, r) => s + (r.judgement?.score || 0), 0) / judgedResults.length).toFixed(2)
    : null;

  const report = {
    timestamp: new Date().toISOString(),
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    judgeModels: skipJudge ? null : { strong: JUDGE_MODEL_STRONG, light: JUDGE_MODEL_LIGHT },
    totalTests: results.length,
    passed: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    judgedPass: skipJudge ? null : judgedPass,
    judgedTotal: skipJudge ? null : judgedResults.length,
    avgScore: avgScore ? parseFloat(avgScore) : null,
    totalDurationMs: totalDuration,
    results,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n  ─────────────────────`);
  console.log(`  Results: ${report.passed}/${report.totalTests} completed`);
  if (report.failed > 0) console.log(`  Errors:  ${report.failed}`);
  if (!skipJudge) {
    console.log(`  Judged:  ${judgedPass}/${judgedResults.length} pass (avg ${avgScore}/5)`);
  }
  console.log(`  Total:   ${formatDuration(totalDuration)}`);

  // Category breakdown
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { total: 0, ok: 0, judgeOk: 0, judged: 0 };
    categories[r.category].total++;
    if (!r.error) categories[r.category].ok++;
    if (r.judgement?.pass !== null && r.judgement?.pass !== undefined) {
      categories[r.category].judged++;
      if (r.judgement.pass) categories[r.category].judgeOk++;
    }
  }
  console.log(`\n  By category:`);
  for (const [cat, counts] of Object.entries(categories)) {
    const judgeInfo = counts.judged > 0 ? ` | judge: ${counts.judgeOk}/${counts.judged}` : '';
    console.log(`    ${cat}: ${counts.ok}/${counts.total}${judgeInfo}`);
  }

  console.log(`\n  Report: ${reportPath}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
