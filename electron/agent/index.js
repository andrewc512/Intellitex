const { runAgent } = require('./runner');
const settings = require('../settings');

async function processAgentRequest(context, userPrompt, apiKey, onProgress, history, { model } = {}) {
  if (!apiKey) throw new Error('API key not configured. Open Settings to add one.');
  return runAgent(context, userPrompt, apiKey, onProgress, history, { model });
}

async function checkApiKey() {
  return settings.hasApiKey();
}

async function getApiKey() {
  return settings.getApiKey();
}

module.exports = { processAgentRequest, checkApiKey, getApiKey };
