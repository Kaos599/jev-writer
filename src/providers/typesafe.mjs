/**
 * TypeSafe direct transport: POST https://api.typesafe.ai/v1/systemone
 *
 * Same `noul` vocabulary as OpenRouter. Access currently requires an account
 * from console.typesafe.ai; if you are on the waitlist, use the AI Gateway or
 * OpenRouter provider instead, which reach the same model.
 */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

function toWire(questions) {
  const out = {};
  for (const [id, q] of Object.entries(questions)) {
    out[id] =
      q.type === 'boolean'
        ? { type: 'noul', instructions: q.instructions, ...(q.criteria ? { criteria: q.criteria } : {}) }
        : { type: q.type, instructions: q.instructions, criteria: q.criteria };
  }
  return out;
}

export async function evaluateViaTypeSafe({ state, questions, model }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, state, questions: toWire(questions) }),
  });
  if (!res.ok) {
    throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
