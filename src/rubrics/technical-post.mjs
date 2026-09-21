/**
 * Technical Post Rubric Pack v1.
 *
 * Tailored for short-form technical content (LinkedIn engineering posts,
 * X / Twitter technical threads, and developer updates).
 *
 * Balances short-form feed mechanics (hook stopping power, 210-character preview)
 * with engineering rigor from the technical-content-writer skill:
 * checkable numbers in the opening lines, mechanism over adjectives,
 * zero downplaying of peers, and grounded takeaways under strict length constraints.
 */

import { score, choice, bool } from './pack.mjs';

export const technicalPostPack = {
  id: 'technical-post',
  version: '1.0.0',
  description: 'Rates short-form technical posts and threads on hook stopping power, proof artifacts, mechanism density, and anti-slop engineering rigor.',
  stateFields: ['hook_text', 'post_body', 'preview_text'],
  outcomes: {
    reach_rate: 'impressions / followers at post time - did the platform distribute it?',
    conversion_rate: 'engagements / impressions - given it was seen, did it work?',
  },
  groups: [
    { key: 'attention', title: 'Attention & Hook Mechanics', dims: ['preview_earns_expansion', 'hook_strength', 'payoff_delivery', 'hook_archetype'] },
    { key: 'technical_craft', title: 'Technical Craft & Precision', dims: ['concrete_anchor', 'proof_artifact_in_hook', 'mechanism_over_adjectives', 'tradeoff_stated', 'reading_ease', 'skimmability', 'technicality'] },
    { key: 'substance', title: 'Substance & Actionability', dims: ['actionability', 'has_firsthand_evidence', 'teaches_transferable_skill', 'shelf_life', 'post_format'] },
    { key: 'stance', title: 'Stance & Peer Framing', dims: ['peer_respect_framing', 'problem_explanation_framing', 'cliche_density', 'ai_generated_feel', 'ending_type'] },
    { key: 'verdicts', title: 'Overall Verdicts', dims: ['anti_slop_technical_integrity', 'is_slop', 'provides_real_value', 'human_authorship_evidence', 'most_needed_improvement'] },
  ],
  questions: {

  // --- Attention & Hook Mechanics ---

  preview_earns_expansion: score(
    'primary',
    {
      question: 'A reader scrolling a technical feed sees only `preview_text` before truncation. How strongly does `preview_text` compel an engineer to click "see more" or open the thread?',
      note: 'Judge only `preview_text`. A preview that completely resolves the technical takeaway without tension scores low.',
    },
    [
      { summary: 'Fully resolved or dull; no reason to expand', signals: ['Point is made or throat-clearing consumes the preview', 'Expanding adds nothing the reader needs'] },
      { summary: 'Familiar setup without tension', signals: ['Recognizable topic but no specific metric, mystery, or conflict'] },
      { summary: 'Opens a technical loop', signals: ['Names an unexpected benchmark, bug, or finding whose explanation lies below'] },
      { summary: 'Cuts at peak technical tension', signals: ['Leaves the reader urgently needing to see the mechanism or benchmark result'] },
    ],
  ),

  hook_strength: score(
    'primary',
    {
      question: 'Rate `hook_text`, the opening lines of the post, on stopping power for a technical audience.',
      note: 'Judge whether an engineer skimming a feed would pause. Ignore whether you agree with the premise.',
    },
    [
      { summary: 'Zero stopping power; generic throat-clearing', signals: ['"Excited to announce", "Thoughts on microservices?", general truisms'] },
      { summary: 'Competent but ordinary statement', signals: ['Standard opinion that blends into the feed'] },
      { summary: 'Sharp technical anchor or surprising metric', signals: ['Concrete numbers, unexpected failure mode, or contrarian systems insight'] },
      { summary: 'Unignorable engineering hook', signals: ['Stakes the reader feels directly in their own systems or challenges core dogma'] },
    ],
  ),

  payoff_delivery: score(
    'primary',
    {
      question: 'Does `post_body` deliver the technical proof and explanation promised by `hook_text`?',
      note: 'Measures alignment between opening claim and body delivery.',
    },
    [
      { summary: 'Bait and switch', signals: ['Promises a technical breakdown, delivers high-level fluff'] },
      { summary: 'Underdelivers on specifics', signals: ['Hand-waves through the actual mechanism'] },
      { summary: 'Delivers the promised technical proof', signals: ['Explains the mechanism and supports the opening claim'] },
      { summary: 'Exceeds the promise with production depth', signals: ['Provides numbers, exact commands, and architectural insight beyond expectation'] },
    ],
  ),

  hook_archetype: choice(
    'exploratory',
    {
      question: 'What rhetorical archetype does `hook_text` use?',
      note: 'Classify the opening move.',
    },
    {
      number_or_benchmark: { what: 'Opens with a concrete latency, cost, scale, or memory figure' },
      contrarian_claim: { what: 'Directly challenges common architectural or development practices' },
      incident_or_failure: { what: 'Opens on a production outage, bug trace, or system breakdown' },
      curiosity_gap: { what: 'Withholds the resolution while promising a technical explanation' },
      direct_question: { what: 'Asks a targeted diagnostic question about the reader\'s stack' },
      announcement: { what: 'Releases an open-source tool, benchmark, or project milestone' },
      none_of_these: { what: 'Does not fit any standard technical hook archetype' },
    },
  ),

  // --- Technical Craft & Precision ---

  concrete_anchor: score(
    'primary',
    {
      question: 'How firmly is `post_body` anchored in a real system, codebase, benchmark, or architecture?',
      note: 'Does it talk about real software or abstract generalities?',
    },
    [
      { summary: 'Pure abstraction', signals: ['No named systems, repos, or real environments'] },
      { summary: 'Tool names as labels', signals: ['Drops brand names without explaining system context'] },
      { summary: 'Concrete system context', signals: ['Explicit about runtime, scale, or data flow'] },
      { summary: 'Verifiable production artifact', signals: ['Specific repo, PR, flame graph, or config key'] },
    ],
  ),

  proof_artifact_in_hook: bool(
    'primary',
    'Does `hook_text` or the first 3 lines of `post_body` include a specific checkable artifact (number, latency figure, version, config key, or error code)?',
  ),

  mechanism_over_adjectives: score(
    'primary',
    {
      question: 'Does `post_body` explain systems behavior via mechanism rather than hype adjectives ("blazing", "revolutionary")?',
      note: 'Mechanism explains why and how.',
    },
    [
      { summary: 'Adjective and buzzword heavy', signals: ['Claims speed/scale without explanation'] },
      { summary: 'Mild mechanism with marketing tone', signals: ['Occasional causal explanation surrounded by fluff'] },
      { summary: 'Clear mechanism-driven prose', signals: ['Explains the bottleneck, cache hit, or algorithm'] },
      { summary: 'Pure causal engineering clarity', signals: ['Every claim is justified by systems mechanics'] },
    ],
  ),

  tradeoff_stated: bool(
    'primary',
    'Does `post_body` explicitly mention what was given up or where this approach fails (tradeoff transparency)?',
  ),

  reading_ease: score(
    'exploratory',
    {
      question: 'How easy and clear is `post_body` to read through?',
      note: 'Clean sentences and balanced paragraphs.',
    },
    [
      { summary: 'Tangled and difficult', signals: ['Run-on sentences, awkward phrasing'] },
      { summary: 'Readable with effort', signals: ['Somewhat clunky transitions'] },
      { summary: 'Clear and well-paced', signals: ['Crisp sentences, natural rhythm'] },
      { summary: 'Effortless and engaging', signals: ['Masterful clarity and flow'] },
    ],
  ),

  skimmability: score(
    'exploratory',
    {
      question: 'Can a reader scanning on a mobile device grasp the technical takeaway immediately?',
      note: 'Visual structure, concise paragraphs, clear landmarks.',
    },
    [
      { summary: 'Unformatted block', signals: ['Hard to scan on small screen'] },
      { summary: 'Some line breaks', signals: ['Basic spacing without strong landmarks'] },
      { summary: 'Well signposted', signals: ['Clear key takeaways or bullets'] },
      { summary: 'Instant scannability', signals: ['Takeaway lands in 5 seconds of scanning'] },
    ],
  ),

  technicality: score(
    'exploratory',
    {
      question: 'What level of technical background is required to understand `post_body`?',
      note: 'Descriptive dimension: captures intended audience depth.',
    },
    [
      { summary: 'General audience', signals: ['No technical background needed'] },
      { summary: 'Tech-adjacent / beginner', signals: ['High-level concepts, no deep code or systems knowledge required'] },
      { summary: 'Practicing engineer', signals: ['Assumes familiar engineering patterns, APIs, and systems concepts'] },
      { summary: 'Domain specialist', signals: ['Deep kernel, low-level, or specialized architecture expertise required'] },
    ],
  ),

  // --- Substance & Actionability ---

  actionability: score(
    'primary',
    {
      question: 'Does `post_body` give the reader something concrete they can inspect, test, or implement in their own workflow?',
      note: 'Executable takeaway.',
    },
    [
      { summary: 'Nothing actionable', signals: ['Pure commentary or observation'] },
      { summary: 'Vague suggestion', signals: ['Points to a general topic without specifics'] },
      { summary: 'Clear pattern or tip', signals: ['A technique or diagnostic to try'] },
      { summary: 'Immediately runnable recipe / rule', signals: ['Exact command, code pattern, or decision rule'] },
    ],
  ),

  has_firsthand_evidence: bool(
    'primary',
    'Does `post_body` report results, numbers, or incidents from the author\'s own firsthand work rather than quoting second-hand news?',
  ),

  teaches_transferable_skill: bool(
    'primary',
    'Could an engineer working on a completely different tech stack or company adapt the lesson in `post_body`?',
  ),

  shelf_life: score(
    'exploratory',
    {
      question: 'How long will this technical post stay relevant?',
      note: 'Durability.',
    },
    [
      { summary: 'Ephemeral (days)', signals: ['Fleeting trend or reaction'] },
      { summary: 'Tool-specific (months)', signals: ['Tied to a temporary version quirk'] },
      { summary: 'Medium-term (1-2 years)', signals: ['Valid for current architectural generation'] },
      { summary: 'Evergreen (years)', signals: ['Core systems principle'] },
    ],
  ),

  post_format: choice(
    'exploratory',
    {
      question: 'What format does `post_body` follow?',
      note: 'Structure.',
    },
    {
      incident_teardown: { what: 'Recounts a bug or outage and how it was resolved' },
      benchmark_result: { what: 'Reports performance or scaling numbers with takeaways' },
      mental_model: { what: 'Explains a tricky systems concept with an intuitive framework' },
      decision_rule: { what: 'Provides an if/then rule of thumb for engineering choices' },
      code_or_command_tip: { what: 'Shows a specific snippet or CLI command that solves a problem' },
      architecture_tour: { what: 'Walks through how a specific feature or subsystem was built' },
      none_of_these: { what: 'Does not fit any listed format' },
    },
  ),

  // --- Stance & Peer Framing ---

  peer_respect_framing: bool(
    'primary',
    'Does `post_body` demonstrate quiet authority without mocking or downplaying peers (e.g. no "unlike amateurs", "most developers use toys")? The systems constraint must be the sole antagonist.',
  ),

  problem_explanation_framing: bool(
    'primary',
    'Does `post_body` frame the technical challenge around systems constraints rather than sensationalized failure-framing ("why everyone is wrong about X")?',
  ),

  cliche_density: score(
    'exploratory',
    {
      question: 'How much of `post_body` relies on corporate buzzwords or social media tropes ("let that sink in", "game-changer", "agree?")?',
      note: 'Phrasing quality.',
    },
    [
      { summary: 'None; fresh and authentic', signals: ['Author\'s own natural voice'] },
      { summary: 'Occasional trope', signals: ['One stock phrase in otherwise good text'] },
      { summary: 'Noticeably cliche', signals: ['Several recycled phrases'] },
      { summary: 'Heavily cliched', signals: ['Reads like a LinkedIn influencer template'] },
    ],
  ),

  ai_generated_feel: score(
    'exploratory',
    {
      question: 'How strongly does `post_body` read as though generated by an LLM?',
      note: 'Look for symmetrical sentences, generic bullet dumps, and lack of human voice.',
    },
    [
      { summary: 'Unmistakably human', signals: ['Idiosyncratic rhythm, authentic personal details'] },
      { summary: 'Mostly human', signals: ['Cleanly written with genuine personality'] },
      { summary: 'Machine-smooth', signals: ['Even sentence cadence, textbook transitions'] },
      { summary: 'Generic AI output', signals: ['Sterile, formulaic, and interchangeable'] },
    ],
  ),

  ending_type: choice(
    'primary',
    {
      question: 'How does `post_body` conclude?',
      note: 'Ending mechanic.',
    },
    {
      technical_punchline: { what: 'Ends on a memorable summary sentence that lands the argument' },
      question_for_engineers: { what: 'Asks a genuine technical question about how other teams handle this' },
      hard_stop: { what: 'Stops immediately after the last substantive point' },
      link_to_code: { what: 'Points to a repository, PR, or deeper writeup' },
      explicit_engagement_cta: { what: 'Asks readers to follow, like, or repost' },
      summary_recap: { what: 'Restates the points already made' },
      none_of_these: { what: 'Does not fit any standard ending type' },
    },
  ),

  // --- Verdicts & Technical Integrity ---

  anti_slop_technical_integrity: bool(
    'primary',
    'Is `post_body` completely free of AI slop, manufactured engagement bait, and superficial fluff? Does it reflect authentic engineering substance?',
  ),

  is_slop: bool(
    'primary',
    'Would an experienced engineer dismiss this post as low-effort social media noise created solely for visibility rather than to share real knowledge?',
  ),

  provides_real_value: score(
    'primary',
    {
      question: 'What does a practicing engineer take away from `post_body`?',
      note: 'Practical substance.',
    },
    [
      { summary: 'Nothing', signals: ['No useful knowledge or takeaway'] },
      { summary: 'Surface awareness', signals: ['Learns a term exists, but nothing they can use'] },
      { summary: 'Solid engineering takeaway', signals: ['Useful mental model or technique'] },
      { summary: 'High-leverage insight', signals: ['Immediate value that improves systems or avoids an outage'] },
    ],
  ),

  human_authorship_evidence: score(
    'primary',
    {
      question: 'How much evidence of personal lived engineering experience is present in `post_body`?',
      note: 'Real debugging traces, production scars, and genuine author perspective.',
    },
    [
      { summary: 'None; completely generic', signals: ['Could have been written from documentation alone'] },
      { summary: 'Generic "I" statements', signals: ['Claims experience without specific corroborating details'] },
      { summary: 'Clear production scars', signals: ['Names specific errors, tradeoffs, or metrics lived through'] },
      { summary: 'Irreplaceably authentic', signals: ['Unmistakable voice and deep firsthand war stories'] },
    ],
  ),

  most_needed_improvement: choice(
    'primary',
    {
      question: 'What single improvement would help this technical post perform best?',
      note: 'Highest-leverage lever.',
    },
    {
      sharper_technical_hook: { what: 'The opening fails to stop an engineer in their feed' },
      add_concrete_number_or_trace: { what: 'Claims lack specific benchmark or error numbers' },
      explain_mechanism_not_hype: { what: 'Replaces buzzwords with causal systems mechanics' },
      state_the_tradeoff: { what: 'Fails to disclose what was given up or the downside' },
      clearer_takeaway: { what: 'Reader finishes unsure what action or lesson to take' },
      shorter_and_tighter: { what: 'Substance is buried in unnecessary words' },
      reframe_peer_respect: { what: 'Eliminates condescension; frames domain constraint as antagonist' },
      a_reason_to_discuss: { what: 'Provides no hook for engineers to share their own experiences' },
      nothing_significant: { what: 'The post is sharp, rigorous, and ready to publish' },
      none_of_these: { what: 'Primary deficiency is not listed' },
    },
  ),

  },
};

export default technicalPostPack;

/**
 * Direction of merit for all rated dimensions in technicalPostPack.
 */
export const directions = {
  // Attention
  preview_earns_expansion: 'higher_is_better',
  hook_strength: 'higher_is_better',
  payoff_delivery: 'higher_is_better',

  // Technical Craft
  concrete_anchor: 'higher_is_better',
  proof_artifact_in_hook: 'higher_is_better',
  mechanism_over_adjectives: 'higher_is_better',
  tradeoff_stated: 'higher_is_better',
  reading_ease: 'higher_is_better',
  skimmability: 'higher_is_better',
  technicality: 'neutral',

  // Substance
  actionability: 'higher_is_better',
  has_firsthand_evidence: 'higher_is_better',
  teaches_transferable_skill: 'higher_is_better',
  shelf_life: 'higher_is_better',

  // Stance
  peer_respect_framing: 'higher_is_better',
  problem_explanation_framing: 'higher_is_better',
  cliche_density: 'lower_is_better',
  ai_generated_feel: 'lower_is_better',

  // Verdicts
  anti_slop_technical_integrity: 'higher_is_better',
  is_slop: 'lower_is_better',
  provides_real_value: 'higher_is_better',
  human_authorship_evidence: 'higher_is_better',
};
