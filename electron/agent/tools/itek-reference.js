const path = require('path');
const fs = require('fs');

const refPath = path.join(__dirname, '..', 'itek-reference.json');
const reference = JSON.parse(fs.readFileSync(refPath, 'utf-8'));

const VALID_TOPICS = ['grammar', 'socials', 'education', 'experience', 'leadership', 'projects', 'skills', 'special', 'all'];

const definition = {
  type: 'function',
  function: {
    name: 'lookup_itek_reference',
    description:
      'Look up itek language syntax, section definitions, fields, and examples. Call this before editing .itek files if you need to confirm correct syntax.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: VALID_TOPICS,
          description:
            'What to look up. Use a section name (socials, education, experience, leadership, projects, skills) for that section\'s fields and examples. Use "grammar" for syntax overview, "special" for special behaviors, or "all" for the complete reference.',
        },
      },
      required: ['topic'],
    },
  },
};

function execute({ topic }) {
  if (!topic || !VALID_TOPICS.includes(topic)) {
    return { error: `Invalid topic "${topic}". Valid topics: ${VALID_TOPICS.join(', ')}` };
  }

  if (topic === 'all') {
    return { reference };
  }

  if (topic === 'grammar') {
    return { reference: reference.grammar };
  }

  if (topic === 'special') {
    return { reference: reference.specialBehaviors };
  }

  // Section lookup
  const section = reference.sections[topic];
  if (!section) {
    return { error: `Section "${topic}" not found in reference.` };
  }
  return { reference: section };
}

module.exports = { definition, execute };
