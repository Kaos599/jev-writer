/**
 * OpenRouter transport, via the dedicated Decisions API.
 *
 * OpenRouter uses TypeSafe's own vocabulary: a yes/no question is a `noul`,
 * not a `boolean`, and the answer field is `noul` rather than `probability`.
 * Rubric packs are authored in the AI SDK dialect, so translate both ways here.
 */

const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';

function toWire(questions) {
  const out = {};
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === 'boolean') {
      out[id] = { type: 'noul', instructions: q.instructions };
      if (q.criteria) out[id].criteria = q.criteria;
    } else {
      out[id] = { type: q.type, instructions: q.instructions, criteria: q.criteria };
    }
  }
  return out;
}

export async function evaluateViaOpenRouter({ state, questions, model }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'content-signal',
    },
    body: JSON.stringify({ model, state, questions: toWire(questions) }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = await res.json();
  const out = {};
  for (const [id, a] of Object.entries(body.answers ?? {})) {
    if (a.type === 'score') {
      out[id] = { type: 'score', value: a.score, probabilities: a.probabilities, confidence: a.confidence ?? null };
    } else if (a.type === 'choice') {
      out[id] = { type: 'choice', value: a.choice, probabilities: a.probabilities, confidence: a.confidence ?? null };
    } else {
      out[id] = { type: 'boolean', value: a.noul, probabilities: null, confidence: null };
    }
  }
  return { answers: out, usage: { inputTokens: body.usage?.input_tokens ?? 0 } };
}
