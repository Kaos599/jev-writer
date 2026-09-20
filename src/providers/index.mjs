/**
 * Provider abstraction.
 *
 * The same typed question set reaches Jev through three different transports,
 * and they are genuinely different protocols rather than one API with three
 * base URLs:
 *
 *   Vercel AI Gateway  AI SDK `experimental_evaluate` only. Evaluation is NOT
 *                      exposed on the gateway's OpenAI-compatible endpoints,
 *                      so there is no plain-HTTP path here.
 *   OpenRouter         POST /api/alpha/decisions, a dedicated Decisions API.
 *   TypeSafe direct    POST /v1/systemone.
 *
 * Their vocabularies differ too: the AI SDK calls a yes/no question `boolean`
 * and returns `{probability}`, while OpenRouter and TypeSafe call it `noul` and
 * return `{noul}`. Rubric packs are written in one dialect (the AI SDK's) and
 * each provider translates on the way in and out.
 */

import { evaluateViaGateway } from './gateway.mjs';
import { evaluateViaOpenRouter } from './openrouter.mjs';
import { evaluateViaTypeSafe } from './typesafe.mjs';

export const PROVIDERS = {
  gateway: {
    id: 'gateway',
    label: 'Vercel AI Gateway',
    envVar: 'AI_GATEWAY_API_KEY',
    model: 'typesafe-ai/jev',
    docs: 'https://vercel.com/docs/ai-gateway/modalities/evaluation',
    evaluate: evaluateViaGateway,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    model: '~typesafe/jev-latest',
    docs: 'https://openrouter.ai/~typesafe/jev-latest',
    evaluate: evaluateViaOpenRouter,
  },
  typesafe: {
    id: 'typesafe',
    label: 'TypeSafe direct',
    envVar: 'TYPESAFE_API_KEY',
    model: 'jev-latest',
    docs: 'https://docs.typesafe.ai/api',
    evaluate: evaluateViaTypeSafe,
  },
};

/** Preference order when several keys are present. */
const ORDER = ['gateway', 'openrouter', 'typesafe'];

export function detectProvider(env = process.env, forced = null) {
  if (forced) {
    const p = PROVIDERS[forced];
    if (!p) throw new Error(`unknown provider "${forced}". Known: ${Object.keys(PROVIDERS).join(', ')}`);
    if (!env[p.envVar]) throw new Error(`provider "${forced}" selected but ${p.envVar} is not set`);
    return p;
  }
  const found = ORDER.filter((id) => env[PROVIDERS[id].envVar]);
  if (!found.length) {
    throw new Error(
      'No API key found. Set exactly one of:\n' +
        ORDER.map((id) => `  ${PROVIDERS[id].envVar}  (${PROVIDERS[id].label}) - ${PROVIDERS[id].docs}`).join('\n'),
    );
  }
  return PROVIDERS[found[0]];
}

export function availableProviders(env = process.env) {
  return ORDER.map((id) => ({ ...PROVIDERS[id], present: Boolean(env[PROVIDERS[id].envVar]) }));
}

/**
 * Normalised answer shape, identical across providers:
 *   score   -> { type:'score',   value:Number, probabilities:{level:p}, confidence:Number }
 *   boolean -> { type:'boolean', value:Number }              // probability of true
 *   choice  -> { type:'choice',  value:String, probabilities:{option:p}, confidence:Number }
 */
export async function evaluate(provider, { state, questions }) {
  return provider.evaluate({ state, questions, model: provider.model });
}
