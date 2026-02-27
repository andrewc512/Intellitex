/**
 * think — a no-op reasoning tool.
 *
 * Gives the model a private scratchpad to plan before acting.
 * Has no side effects; the runner collects thoughts for the response's
 * `thinking` field so the UI can optionally surface them.
 */

const definition = {
  type: 'function',
  function: {
    name: 'think',
    description:
      'Use this to reason through a problem before taking action. ' +
      'Your thoughts are not shown to the user. ' +
      'Call this to plan your approach, evaluate tool results, or decide next steps.',
    parameters: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your reasoning, plan, or self-evaluation.',
        },
      },
      required: ['thought'],
    },
  },
};

async function execute({ thought }) {
  // No side effects — just acknowledge so the model can continue.
  return { acknowledged: true, thought };
}

module.exports = { definition, execute };
