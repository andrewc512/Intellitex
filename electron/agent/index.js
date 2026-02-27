const { runAgent } = require('./runner');

async function processAgentRequest(context, userPrompt, apiKey) {
  if (!apiKey) throw new Error('OpenAI API key not configured');
  return runAgent(context, userPrompt, apiKey);
}

function checkApiKey() {
  return !!process.env.OPENAI_API_KEY;
}

function getApiKey() {
  return process.env.OPENAI_API_KEY || null;
}

module.exports = { processAgentRequest, checkApiKey, getApiKey };
