/**
 * Technical Blog Rubric Pack v1.
 *
 * Designed for in-depth engineering essays, systems architecture teardowns,
 * performance benchmarks, and post-mortems.
 *
 * Distilled from the technical-content-writer skill and principles from
 * leading engineering publications (Tailscale, Fly.io, Dan Luu, Julia Evans, Brandur).
 *
 * Evaluates whether claims survive technical verification: concrete anchors,
 * domain/physical constraints, mechanism over adjectives, checkable proof artifacts,
 * tradeoff transparency, and executable decision procedures.
 */

import { score, choice, bool } from './pack.mjs';

export const technicalBlogPack = {
  id: 'technical-blog',
  version: '1.0.0',
  description: 'Rates technical blogs and engineering essays on systems rigor, proof artifacts, mechanism depth, tradeoffs, and anti-slop integrity.',
  stateFields: ['hook_text', 'post_body', 'preview_text'],
  outcomes: {
    reach_rate: 'distribution / readership reach',
    conversion_rate: 'engagement / reader response',
  },
  groups: [
    { key: 'anchoring', title: 'Systems Anchoring & Constraints', dims: ['concrete_anchor', 'domain_constraint_rigor', 'proof_artifact_strength', 'mechanism_over_adjectives', 'tradeoff_transparency'] },
    { key: 'utility', title: 'Engineering Utility & Reproducibility', dims: ['executable_decision_procedure', 'reproducibility_level', 'code_explanatory_utility', 'actionability', 'shelf_life', 'blog_archetype'] },
    { key: 'craft', title: 'Structure & Technical Prose', dims: ['hook_strength', 'payoff_delivery', 'technical_reading_ease', 'skimmability', 'information_density'] },
    { key: 'stance', title: 'Authorial Stance & Ethics', dims: ['peer_respect_framing', 'problem_explanation_framing', 'jargon_theater_density', 'author_seniority_stance', 'who_is_the_hero'] },
    { key: 'verdicts', title: 'Verdicts & Technical Integrity', dims: ['anti_slop_technical_integrity', 'is_slop', 'ai_generated_feel', 'provides_engineering_value', 'unearned_hype', 'technical_improvement_lever'] },
  ],
  questions: {

  // --- Anchoring & Constraints ---

  concrete_anchor: score(
    'primary',
    {
      question: 'How firmly is `post_body` anchored in a specific, real-world system, benchmark run, production incident, or code artifact?',
      note: 'Look for the concrete thing, not just a broad topic. An abstract essay on caching scores low; a post about a specific cache eviction bug on Redis 7.2 scores high.',
    },
    [
      { summary: 'Unanchored; purely abstract topic', signals: ['Discusses a concept in theory only', 'No named system, trace, or codebase', 'Could be written without ever running software'] },
      { summary: 'Loosely anchored with decorative mentions', signals: ['Names popular tools as labels', 'No specifics on configuration, topology, or production scale'] },
      { summary: 'Firmly anchored in a specific system', signals: ['Names the exact architecture, database, or runtime environment', 'Draws directly from a real deployment or build'] },
      { summary: 'Deeply anchored in a verifiable artifact', signals: ['Grounded in a specific benchmark run, PR, incident timeline, or profiling profile', 'Every claim ties back to this anchor'] },
    ],
  ),

  domain_constraint_rigor: score(
    'primary',
    {
      question: 'How well does `post_body` acknowledge and respect real physical, mathematical, statutory, or systems constraints?',
      note: 'Systems constraints include memory bandwidth, network roundtrips, CPU cache hierarchies, CAP theorem, or kernel syscall overhead. Does the author ground the problem in reality or treat constraints as magic?',
    },
    [
      { summary: 'Ignores physical and systems constraints', signals: ['Treats complex problems as trivial', 'Assumes infinite resources or zero latency', 'Promises magic without friction'] },
      { summary: 'Superficially acknowledges limits', signals: ['Mentions scale or latency in passing without exploring the physics behind it'] },
      { summary: 'Rigorously grounds problem in real limits', signals: ['Explains bottleneck in terms of memory, network, CPU, or lock contention', 'Identifies the boundary condition'] },
      { summary: 'First-principles systems analysis', signals: ['Traces behavior directly to hardware limits, protocol specifications, or mathematical boundaries'] },
    ],
  ),

  proof_artifact_strength: score(
    'primary',
    {
      question: 'How strongly are the claims in `post_body` backed by checkable proof artifacts (benchmark numbers, exact configs, flame graphs, RFC/spec citations)?',
      note: 'Technical readers can and will check claims. Look for exact numbers, config keys, error codes, or reproduction steps vs rounded hand-waving.',
    },
    [
      { summary: 'Zero proof artifacts; unsubstantiated claims', signals: ['Makes performance or reliability claims with zero supporting figures', 'Uses vague words like "much faster"'] },
      { summary: 'Weak or isolated proof', signals: ['A single vague metric or percentage without baseline or test methodology'] },
      { summary: 'Solid checkable artifacts', signals: ['Specific numbers with baselines (e.g. p99 latency from 450ms to 42ms)', 'Exact config keys or code snippets included'] },
      { summary: 'Air-tight proof with methodology', signals: ['Complete benchmark methodology, sample sizes, hardware specs, or reproduction commands supplied'] },
    ],
  ),

  mechanism_over_adjectives: score(
    'primary',
    {
      question: 'Does `post_body` explain how and why systems behave through concrete mechanisms rather than relying on superlative adjectives?',
      note: 'Contrast: "Our engine is ultra-fast, blazing, and revolutionary" (adjectives) vs "Decode is memory-bandwidth bottlenecked because each step re-reads weights at 3.35 TB/s" (mechanism).',
    },
    [
      { summary: 'Relies entirely on hype and adjectives', signals: ['Loaded with words like "blazing", "magical", "seamless", "effortless"', 'Explains zero causal mechanisms'] },
      { summary: 'Adjective-heavy with brief mechanism', signals: ['Occasionally mentions a mechanism but defaults to evaluative marketing claims'] },
      { summary: 'Driven by mechanism with restrained phrasing', signals: ['Focuses on causal sequence: why A causes B at the runtime or protocol level', 'Minimal hype adjectives'] },
      { summary: 'Pure causal mechanism analysis', signals: ['Every claim is explained by causal mechanics, data flow, or state machines', 'Zero marketing puffery'] },
    ],
  ),

  tradeoff_transparency: score(
    'primary',
    {
      question: 'How transparently does `post_body` disclose the tradeoffs, costs, and downsides of the proposed approach?',
      note: 'Engineers distrust anything presented as free. What did the author give up? (e.g. throughput for latency, consistency for availability, operational complexity for performance).',
    },
    [
      { summary: 'Presents the solution as a free lunch', signals: ['Claims only upside with zero cost, complexity, or risk', 'Hides drawbacks'] },
      { summary: 'Glossed or minimized tradeoffs', signals: ['Mentions a trivial downside in passing', 'Dismisses real architectural costs'] },
      { summary: 'Clear, explicit tradeoff analysis', signals: ['Names exactly what is sacrificed (memory overhead, operational complexity, lock contention)'] },
      { summary: 'Balanced matrix of operational reality', signals: ['Rigorous analysis of when NOT to use this solution', 'Clear boundary where the tradeoff flips from beneficial to harmful'] },
    ],
  ),

  // --- Utility & Reproducibility ---

  executable_decision_procedure: score(
    'primary',
    {
      question: 'Does `post_body` conclude with an executable decision procedure, heuristic, or threshold the reader can apply in production?',
      note: 'Does it leave the reader with an actionable condition -> choice rule (e.g. "If your payload > 64KB, use X; otherwise stick with Y")?',
    },
    [
      { summary: 'No decision guidance', signals: ['Leaves the reader with general thoughts or vague commentary', 'No rule of thumb'] },
      { summary: 'High-level philosophical advice', signals: ['Suggests general best practices without concrete decision boundaries'] },
      { summary: 'Clear practical heuristic', signals: ['Provides actionable guidelines or thresholds for choosing an approach'] },
      { summary: 'Rigorous decision flowchart / rule', signals: ['Explicit condition -> choice mapping', 'Gives exact numbers, metric triggers, or diagnostic questions'] },
    ],
  ),

  reproducibility_level: score(
    'primary',
    {
      question: 'Could a competent engineer reproduce the findings or setup described in `post_body` based on the details provided?',
      note: 'Look for explicit versions, flags, configurations, CLI commands, or minimal reproduction examples.',
    },
    [
      { summary: 'Irreproducible; essential details missing', signals: ['Vague descriptions of custom proprietary code', 'No versions or configs mentioned'] },
      { summary: 'Partially reproducible with substantial guesswork', signals: ['Names tools but omits exact versions, dependencies, or parameters'] },
      { summary: 'Mostly reproducible by a domain engineer', signals: ['Includes key configurations, commands, and software versions'] },
      { summary: 'Fully reproducible step by step', signals: ['Complete recipe with exact versions, reproduction commands, and repo/gist links'] },
    ],
  ),

  code_explanatory_utility: score(
    'primary',
    {
      question: 'If `post_body` includes code snippets, diagrams, or configs, do they directly illuminate the core mechanism or serve as decorative padding?',
      note: 'Rate the pedagogical value of code and artifacts. If the piece has no code or diagrams, rate based on whether code was genuinely needed to explain the mechanism.',
    },
    [
      { summary: 'Decorative padding or unnecessary boilerplate', signals: ['Huge dumps of irrelevant imports or syntax', 'Code shown without explaining what matters'] },
      { summary: 'Generic example code', signals: ['Basic syntax that could be found in introductory documentation', 'Does not address the hard edge case'] },
      { summary: 'Laser-focused illustrative snippet', signals: ['Minimal lines highlighting precisely where the logic or performance difference lives'] },
      { summary: 'Masterclass in code pedagogy', signals: ['Annotated diffs, minimal reproducer, or architecture diagram that makes the mechanism instantly clear'] },
    ],
  ),

  actionability: score(
    'primary',
    {
      question: 'How clearly does `post_body` give an engineer something concrete they can inspect, measure, or improve in their own stack tomorrow?',
      note: 'Judge immediate practical utility.',
    },
    [
      { summary: 'Nothing actionable', signals: ['Interesting story but zero application to reader\'s own work'] },
      { summary: 'Indirect inspiration', signals: ['Inspires thinking but provides no specific diagnostic or action'] },
      { summary: 'Clear diagnostic or pattern', signals: ['Reader knows which metric to check or which config to inspect'] },
      { summary: 'Immediate production blueprint', signals: ['Reader can implement the fix, run the audit, or set the alert immediately'] },
    ],
  ),

  shelf_life: score(
    'exploratory',
    {
      question: 'How durable is the technical value of `post_body` across technology cycles?',
      note: 'Judge whether this is an ephemeral patch note vs an enduring systems lesson.',
    },
    [
      { summary: 'Ephemeral patch note (days/weeks)', signals: ['Tied to a temporary bug in a minor version', 'Obsolete upon next patch release'] },
      { summary: 'Tool generation specific (1-2 years)', signals: ['Specific to current framework or API version'] },
      { summary: 'Long-term architectural reference (3-5 years)', signals: ['Pattern applicable across multiple tool generations'] },
      { summary: 'Evergreen systems classic (5+ years)', signals: ['Fundamental principle about hardware, protocols, or systems design'] },
    ],
  ),

  blog_archetype: choice(
    'exploratory',
    {
      question: 'What structural archetype best classifies `post_body`?',
      note: 'Classify the dominant engineering format.',
    },
    {
      incident_postmortem: { what: 'Dissects a real production outage, latency spike, or failure timeline' },
      architecture_deepdive: { what: 'Explains the end-to-end design and tradeoffs of a complex system' },
      benchmark_analysis: { what: 'Empirical measurement and comparison of performance, throughput, or latency' },
      debugging_investigation: { what: 'Chronicles tracking down a subtle bug or edge case through traces and logs' },
      decision_tradeoff_map: { what: 'Compares architectural alternatives and frames the decision criteria' },
      mental_model_primer: { what: 'Builds an intuitive, accurate conceptual model of a complex technical concept' },
      migration_story: { what: 'Documents moving a production system between databases, languages, or architectures' },
      none_of_these: { what: 'Does not fit any standard engineering blog archetype' },
    },
  ),

  // --- Craft & Prose ---

  hook_strength: score(
    'primary',
    {
      question: 'How effectively does `hook_text` establish an engineering puzzle, counterintuitive observation, or high-stakes production tension?',
      note: 'A strong technical opening gives a practitioner an urgent reason to read without sensationalism.',
    },
    [
      { summary: 'Bland preamble or topic announcement', signals: ['"In this post I will discuss microservices"', 'Standard throat-clearing without stakes'] },
      { summary: 'Familiar problem statement', signals: ['States a known problem in conventional terms'] },
      { summary: 'Sharp technical tension or metric', signals: ['Leads with unexpected latency, curious bug trace, or counterintuitive benchmark'] },
      { summary: 'Irresistible engineering puzzle', signals: ['Poses a mystery that challenges assumptions or exposes a critical hidden flaw'] },
    ],
  ),

  payoff_delivery: score(
    'primary',
    {
      question: 'Does `post_body` thoroughly solve and explain the technical puzzle or thesis introduced by `hook_text`?',
      note: 'Measures completeness of the technical resolution.',
    },
    [
      { summary: 'Bait and switch', signals: ['The opening promised a deep technical answer but the body delivers a superficial high-level overview'] },
      { summary: 'Incomplete explanation', signals: ['Leaves the hardest part of the problem unaddressed or unexplained'] },
      { summary: 'Full technical delivery', signals: ['Answers the question completely with supporting logic and data'] },
      { summary: 'Exceeds expectations with deep insight', signals: ['Delivers both the direct fix and the deeper architectural principle behind it'] },
    ],
  ),

  technical_reading_ease: score(
    'exploratory',
    {
      question: 'How cleanly does `post_body` convey difficult technical concepts through plain English, clear sentence structure, and natural cadence?',
      note: 'Technical depth should not mean convoluted academic prose. High score means complex ideas made lucid without patronizing.',
    },
    [
      { summary: 'Dense, convoluted, or exhausting', signals: ['Run-on sentences packed with unglossed clauses', 'Reader repeatedly loses the thread'] },
      { summary: 'Understandable with concentration', signals: ['Occasional awkward phrasing or heavy academic sentence structures'] },
      { summary: 'Lucid and well-paced', signals: ['Direct declarative sentences', 'Terms defined naturally before use', 'Clean logical transitions'] },
      { summary: 'Masterful technical exposition', signals: ['Rhythmic, crystalline explanations that make difficult concepts feel effortless'] },
    ],
  ),

  skimmability: score(
    'exploratory',
    {
      question: 'How effectively do subheadings, callouts, diagrams, and tables in `post_body` allow an engineer to scan and locate specific information?',
      note: 'Engineers frequently read technical blogs to look up specific configs, tables, or conclusions.',
    },
    [
      { summary: 'Wall of text; zero structural signposts', signals: ['Unbroken paragraphs with no headings or visual landmarks'] },
      { summary: 'Basic headings with poor informative value', signals: ['Generic headings like "Overview" or "Next Steps" that convey no substance'] },
      { summary: 'Informative headings and clear hierarchy', signals: ['Subheadings state their takeaway', 'Code and data formatted cleanly'] },
      { summary: 'Flawless engineering navigation', signals: ['Summary tables, descriptive section titles, and callouts make reading or referencing instantaneous'] },
    ],
  ),

  information_density: score(
    'primary',
    {
      question: 'What is the density of genuine engineering signal versus conversational filler in `post_body`?',
      note: 'Does every paragraph move the technical explanation forward, or is there padding to hit word counts?',
    },
    [
      { summary: 'Diluted filler with minimal signal', signals: ['Endless preambles, generic definitions, and repetition of basic facts'] },
      { summary: 'Moderate density with noticeable padding', signals: ['Good insights buried between conversational fluff or recap sentences'] },
      { summary: 'High signal-to-noise ratio', signals: ['Almost every paragraph introduces a new observation, number, or architectural detail'] },
      { summary: 'Exceptional density throughout', signals: ['Compact, substantive, and completely free of filler or synthetic fluff'] },
    ],
  ),

  // --- Stance & Ethics ---

  peer_respect_framing: bool(
    'primary',
    'Does `post_body` maintain quiet production authority while treating peer engineers with respect, with zero contempt or downplaying of others (e.g. avoiding "most developers use toys" or "amateurs do X")? The domain constraint should be the only antagonist.',
  ),

  problem_explanation_framing: bool(
    'primary',
    'Are headings and narrative sections in `post_body` framed around explaining domain constraints and engineering challenges, rather than sensationalized failure-framing (e.g. avoiding "Why everyone fails at X" or "The catastrophic mistake of Y")?',
  ),

  jargon_theater_density: score(
    'exploratory',
    {
      question: 'How free is `post_body` from inflated corporate buzzwords and jargon theater?',
      note: 'Watch for inflated terms used to sound impressive ("accretion drift", "synergistic orchestrations", "cockpit", "tranches") vs plain English engineering terms.',
    },
    [
      { summary: 'Heavy jargon theater and buzzword soup', signals: ['Filled with invented corporate jargon and inflated nouns'] },
      { summary: 'Frequent buzzword flourishes', signals: ['Uses trendy buzzwords where simple standard terms exist'] },
      { summary: 'Mostly plain engineering English', signals: ['Uses standard industry terms accurately without posturing'] },
      { summary: 'Completely unpretentious and rigorous', signals: ['Plain English terms favored throughout', 'Zero jargon posturing'] },
    ],
  ),

  author_seniority_stance: score(
    'exploratory',
    {
      question: 'What authorial stance does `post_body` embody?',
      note: 'Classify the stance: from novice tutorial to grounded staff/principal engineer to ivory-tower academic.',
    },
    [
      { summary: 'Beginner / apprentice recounting basic docs', signals: ['Discovers introductory syntax as novel', 'Apologetic or uncertain tone'] },
      { summary: 'Tutorial instructor following a script', signals: ['Step-by-step instructions without explaining production implications or failure modes'] },
      { summary: 'Grounded production practitioner', signals: ['Speaks from real operating experience with systems at scale', 'Quiet authority and peer respect'] },
      { summary: 'Staff / Principal systems architect', signals: ['Deep fluency with systems tradeoffs, failure modes, protocol internals, and operational economics'] },
    ],
  ),

  who_is_the_hero: choice(
    'exploratory',
    {
      question: 'What is the narrative focal point of `post_body`?',
      note: 'Where does the author focus the reader\'s attention?',
    },
    {
      the_engineering_problem: { what: 'The domain constraint, bug, or architectural challenge itself is the protagonist' },
      the_reader: { what: 'Equipping the reader to understand and solve this in their own systems' },
      the_tool_or_system: { what: 'Showcasing the design and internal elegance of a specific technology' },
      the_author: { what: 'Showcasing the author\'s personal cleverness or status' },
      none_of_these: { what: 'No clear narrative center' },
    },
  ),

  // --- Verdicts & Integrity ---

  anti_slop_technical_integrity: bool(
    'primary',
    'Is `post_body` completely free of AI-generated fluff, formulaic balanced tricolons ("it is not just fast, it is reliable, and scalable"), and vacuous summaries? Would an experienced staff engineer accept this as authentic technical writing?',
  ),

  is_slop: bool(
    'primary',
    'Would a senior engineer dismiss this post as low-effort content farm or SEO filler — written to generate traffic or maintain posting frequency rather than to document real engineering insight?',
  ),

  ai_generated_feel: score(
    'exploratory',
    {
      question: 'How strongly does `post_body` read as though drafted or sanitized by an LLM rather than written by a human engineer?',
      note: 'Look for relentlessly even paragraph lengths, mechanical transition words ("Furthermore", "Moreover", "In conclusion"), and lack of lived friction.',
    },
    [
      { summary: 'Unmistakably a human engineer', signals: ['Organic sentence rhythm', 'Lived engineering friction and idiosyncratic details', 'Direct first-person observations'] },
      { summary: 'Mostly human with clean editing', signals: ['Well-edited prose that preserves authorial voice and technical grit'] },
      { summary: 'Noticeably machine-smooth', signals: ['Uniform paragraph lengths', 'Textbook transition words', 'Polished but sanitized'] },
      { summary: 'Reads as generic LLM output', signals: ['Formulaic structure', 'Repeats boilerplate summaries', 'Zero human fingerprint or real incident grit'] },
    ],
  ),

  provides_engineering_value: score(
    'primary',
    {
      question: 'What is the enduring engineering utility of `post_body` for a practicing software or infrastructure engineer?',
      note: 'Judge the real-world value of the takeaway.',
    },
    [
      { summary: 'Zero value', signals: ['No actionable insight, mental model, or diagnostic help'] },
      { summary: 'Minor awareness', signals: ['Mentions an interesting tool or approach without sufficient depth to apply'] },
      { summary: 'Valuable technical reference', signals: ['Provides clear architectural insights or techniques worth applying in production'] },
      { summary: 'Exceptional production asset', signals: ['Definitive analysis, flame-graph breakdown, or post-mortem that changes how teams build and operate systems'] },
    ],
  ),

  unearned_hype: bool(
    'exploratory',
    'Does `post_body` make breathless claims of revolutionary performance or paradigm shifts without supplying the baseline measurements and methodology to support them?',
  ),

  technical_improvement_lever: choice(
    'primary',
    {
      question: 'If the author could make exactly one improvement to this technical blog post, which change would add the most value for an engineering reader?',
      note: 'Identify the single highest-leverage improvement.',
    },
    {
      add_benchmark_proof: { what: 'Support performance or scaling claims with concrete numbers, baselines, and test methodology' },
      explain_mechanism_deeper: { what: 'Go beyond what happened to explain how and why at the systems, protocol, or hardware level' },
      disclose_tradeoffs: { what: 'Explicitly state the costs, downsides, operational complexity, or when not to use this solution' },
      provide_decision_procedure: { what: 'Add a concrete condition -> choice heuristic or diagnostic threshold to guide implementation decisions' },
      focus_code_snippets: { what: 'Replace generic boilerplate or wall-of-code with concise, annotated snippets explaining the critical logic' },
      remove_jargon_and_hype: { what: 'Strip buzzwords, breathless adjectives, and marketing fluff in favor of plain English engineering prose' },
      reframe_peer_respect: { what: 'Eliminate failure-framing and condescension toward peers; frame the domain constraint as the sole antagonist' },
      nothing_significant: { what: 'The post is technically rigorous, well-anchored, and ready to publish' },
      none_of_these: { what: 'The primary technical deficiency is not among the listed options' },
    },
  ),

  },
};

export default technicalBlogPack;

/**
 * Direction of merit for all rated (score and boolean) dimensions in technicalBlogPack.
 */
export const directions = {
  // Anchoring & Constraints
  concrete_anchor: 'higher_is_better',
  domain_constraint_rigor: 'higher_is_better',
  proof_artifact_strength: 'higher_is_better',
  mechanism_over_adjectives: 'higher_is_better',
  tradeoff_transparency: 'higher_is_better',

  // Utility & Reproducibility
  executable_decision_procedure: 'higher_is_better',
  reproducibility_level: 'higher_is_better',
  code_explanatory_utility: 'higher_is_better',
  actionability: 'higher_is_better',
  shelf_life: 'higher_is_better',

  // Craft & Prose
  hook_strength: 'higher_is_better',
  payoff_delivery: 'higher_is_better',
  technical_reading_ease: 'higher_is_better',
  skimmability: 'higher_is_better',
  information_density: 'higher_is_better',

  // Stance & Ethics
  peer_respect_framing: 'higher_is_better',
  problem_explanation_framing: 'higher_is_better',
  jargon_theater_density: 'higher_is_better',
  author_seniority_stance: 'higher_is_better',

  // Verdicts & Integrity
  anti_slop_technical_integrity: 'higher_is_better',
  is_slop: 'lower_is_better',
  ai_generated_feel: 'lower_is_better',
  provides_engineering_value: 'higher_is_better',
  unearned_hype: 'lower_is_better',
};
