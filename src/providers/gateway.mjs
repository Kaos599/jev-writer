/**
 * Vercel AI Gateway transport.
 *
 * Evaluation models are reachable only through the AI SDK's
 * `experimental_evaluate`, not through the gateway's OpenAI-compatible
 * endpoints, so this provider needs the `ai` package rather than plain fetch.
 * Requires ai >= 7.0.105.
 *
 * Zero Data Retention is requested on every call. This tool sends people's
 * private writing to a third party; retention should be opt-out, not opt-in.
 */

export async function evaluateViaGateway({ state, questions, model }) {
  let evaluate;
  try {
    ({ experimental_evaluate: evaluate } = await import('ai'));
  } catch {
    throw new Error("the 'ai' package (>=7.0.105) is required for the AI Gateway provider: npm i ai");
  }
  if (!evaluate) {
    throw new Error("installed 'ai' package has no experimental_evaluate; upgrade to >=7.0.105");
  }

  const res = await evaluate({
    model,
    state,
    questions,
    providerOptions: { gateway: { zeroDataRetention: true } },
  });

  const confidence = res.providerMetadata?.typesafe?.confidence ?? {};
  const out = {};
  for (const [id, a] of Object.entries(res.answers)) {
    if (a.type === 'score') {
      out[id] = { type: 'score', value: a.score, probabilities: a.probabilities, confidence: confidence[id] ?? null };
    } else if (a.type === 'choice') {
      out[id] = { type: 'choice', value: a.choice, probabilities: a.probabilities, confidence: confidence[id] ?? null };
    } else {
      out[id] = { type: 'boolean', value: a.probability, probabilities: null, confidence: null };
    }
  }
  return { answers: out, usage: { inputTokens: res.usage?.inputTokens ?? 0 } };
}
