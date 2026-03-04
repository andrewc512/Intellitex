const { app, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const SETTINGS_FILE = () =>
  path.join(app.getPath("userData"), "settings.json");

const DEFAULTS = {
  provider: "openai",
  apiKeys: {},
  model: "gpt-5",
};

let cached = null;

function encrypt(plaintext) {
  if (!plaintext) return "";
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plaintext).toString("base64");
  }
  console.warn("[settings] safeStorage unavailable — storing key in plaintext");
  return plaintext;
}

function decrypt(stored) {
  if (!stored) return "";
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(stored, "base64"));
    } catch {
      return stored;
    }
  }
  return stored;
}

async function loadSettings() {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(SETTINGS_FILE(), "utf-8");
    cached = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

async function saveSettings(patch) {
  const settings = await loadSettings();
  if (patch.provider !== undefined) settings.provider = patch.provider;
  if (patch.model !== undefined) settings.model = patch.model;
  cached = settings;
  await fs.writeFile(SETTINGS_FILE(), JSON.stringify(settings, null, 2), "utf-8");
  return settings;
}

async function setApiKey(provider, key) {
  const settings = await loadSettings();
  if (!settings.apiKeys) settings.apiKeys = {};
  settings.apiKeys[provider] = key ? encrypt(key) : "";
  cached = settings;
  await fs.writeFile(SETTINGS_FILE(), JSON.stringify(settings, null, 2), "utf-8");
}

async function getApiKey(provider) {
  const settings = await loadSettings();
  const p = provider || settings.provider;
  const stored = settings.apiKeys?.[p];
  if (stored) return decrypt(stored);
  if (p === "openai" && process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  return null;
}

async function hasApiKey(provider) {
  const key = await getApiKey(provider);
  return !!key;
}

async function getPublicSettings() {
  const settings = await loadSettings();
  return {
    provider: settings.provider,
    model: settings.model,
    hasKeys: {
      openai: !!(settings.apiKeys?.openai || process.env.OPENAI_API_KEY),
      anthropic: !!settings.apiKeys?.anthropic,
      google: !!settings.apiKeys?.google,
    },
  };
}

module.exports = {
  loadSettings,
  saveSettings,
  setApiKey,
  getApiKey,
  hasApiKey,
  getPublicSettings,
};
