/**
 * General Writing Rubric Pack v1.
 *
 * Platform-agnostic writing evaluation pack for blog posts, essays,
 * newsletters, articles, and long-form thought pieces.
 *
 * Focuses on genuine craft: premise and thesis clarity, logical argument
 * progression, information density, intellectual honesty, voice authenticity,
 * anti-slop integrity, and reader value.
 */

import { score, choice, bool } from './pack.mjs';

export const generalWritingPack = {
  id: 'general-writing',
  version: '1.0.0',
  description: 'Rates general blog posts, essays, and articles on thesis clarity, logical flow, density, voice, and quality verdicts.',
  stateFields: ['hook_text', 'post_body', 'preview_text'],
  outcomes: {
    reach_rate: 'distribution / readership reach',
    conversion_rate: 'engagement / reader response',
  },
  groups: [
    { key: 'attention', title: 'Attention & Premise', dims: ['preview_earns_expansion', 'hook_strength', 'payoff_delivery', 'hook_archetype'] },
    { key: 'structure', title: 'Structure & Argument Flow', dims: ['thesis_clarity', 'logical_progression', 'reading_ease', 'skimmability', 'information_density'] },
    { key: 'substance', title: 'Substance & Intellectual Honesty', dims: ['specificity', 'has_firsthand_evidence', 'intellectual_honesty', 'novelty', 'actionability', 'shelf_life', 'post_format'] },
    { key: 'voice', title: 'Voice & Phrasing', dims: ['voice_authenticity', 'cliche_density', 'ai_generated_feel', 'human_authorship_evidence', 'who_is_the_hero'] },
    { key: 'verdicts', title: 'Overall Verdicts', dims: ['is_slop', 'provides_real_value', 'unearned_hype', 'most_needed_improvement'] },
  ],
  questions: {

  // --- Attention & Premise ---

  preview_earns_expansion: score(
    'primary',
    {
      question: 'A reader browsing content sees only `preview_text` before deciding whether to expand or keep reading. How strongly does `preview_text` compel that reader to continue?',
      note: 'Judge only `preview_text`. A preview that completely resolves the thought without establishing a reason to continue scores low.',
    },
    [
      { summary: 'Fully resolved or bland; no reason to continue', signals: ['The point is completely made before the cut', 'Reads as a finished thought or throat-clearing'] },
      { summary: 'Cuts off during setup without curiosity', signals: ['Breaks mid-sentence during preamble', 'The unfinished part is scene-setting, not substance'] },
      { summary: 'Opens a premise the reader wants explored', signals: ['States a compelling claim whose argument follows', 'Promises concrete specifics immediately below'] },
      { summary: 'Cuts at peak intellectual tension', signals: ['Breaks precisely where the critical insight begins', 'Leaves an urgent question the reader must see answered'] },
    ],
  ),

  hook_strength: score(
    'primary',
    {
      question: 'Rate `hook_text`, the opening of the piece, on how strongly it grabs attention and establishes the core premise.',
      note: 'Judge stopping power and intrigue, independent of whether you agree with the premise.',
    },
    [
      { summary: 'Gives a reader no reason to stop', signals: ['Preamble or throat-clearing', 'An observation anyone could have made', 'Announces a topic without a stance'] },
      { summary: 'Mildly interesting familiar framing', signals: ['A recognizable opinion stated plainly', 'Reads like many other articles on the subject'] },
      { summary: 'Sharp curiosity through specificity or contrast', signals: ['A concrete number, result, or named case', 'Sets up a gap between expectation and reality'] },
      { summary: 'Compelling and hard to ignore', signals: ['Cuts against conventional belief', 'Stakes the reader cares about deeply', 'Urgent pull to find out what follows'] },
    ],
  ),

  payoff_delivery: score(
    'primary',
    {
      question: 'Does `post_body` deliver on the promise, expectation, or tension created by `hook_text`?',
      note: 'Measures alignment between opening premise and subsequent delivery.',
    },
    [
      { summary: 'Bait and switch', signals: ['The opening promised one thing, the body delivered another', 'The core tension was abandoned'] },
      { summary: 'Superficial payoff', signals: ['Addresses the hook shallowly', 'Leaves key questions unanswered'] },
      { summary: 'Solid delivery', signals: ['Directly answers the opening tension', 'Supplies supporting reasoning or evidence'] },
      { summary: 'Exceeds the promise', signals: ['Deeply satisfying payoff with concrete specifics and unexpected depth'] },
    ],
  ),

  hook_archetype: choice(
    'exploratory',
    {
      question: 'Which opening archetype best describes `hook_text`?',
      note: 'Classify the structural pattern used to start the piece.',
    },
    {
      personal_story: { what: 'Opens with a personal experience, conversation, or admission' },
      contrarian_claim: { what: 'Challenges conventional wisdom or widespread consensus directly' },
      number_or_result: { what: 'Leads with a specific metric, benchmark, or quantified finding' },
      teaching_promise: { what: 'Promises to explain how to do or understand something concrete' },
      direct_question: { what: 'Opens by asking the reader a pointed, thought-provoking question' },
      observation_or_scene: { what: 'Paints a vivid scene, incident, or moment in time' },
      announcement: { what: 'Shares news of a release, milestone, or new project' },
      curiosity_gap: { what: 'Deliberately withholds context to induce intrigue' },
      none_of_these: { what: 'Does not cleanly fit any standard archetype' },
    },
  ),

  // --- Structure & Argument Flow ---

  thesis_clarity: score(
    'primary',
    {
      question: 'How clearly does `post_body` state and defend a distinct, coherent central thesis?',
      note: 'Does the piece have a spine, or is it a loose collection of disconnected thoughts?',
    },
    [
      { summary: 'No identifiable thesis', signals: ['Wanders aimlessly between unrelated topics', 'No central point'] },
      { summary: 'Vague or shifting thesis', signals: ['A general topic is discussed, but the author\'s specific claim shifts or remains muddy'] },
      { summary: 'Clear, well-defined thesis', signals: ['The reader can state the author\'s core argument in one sentence', 'Body sections support this thesis'] },
      { summary: 'Crystalline and relentlessly defended', signals: ['Unmistakable, razor-sharp thesis', 'Every paragraph contributes directly to defending or exploring it'] },
    ],
  ),

  logical_progression: score(
    'primary',
    {
      question: 'How smoothly and cumulatively do paragraphs and sections in `post_body` build on one another?',
      note: 'Judge transitions, argument sequencing, and narrative flow.',
    },
    [
      { summary: 'Disjointed and jarring', signals: ['Paragraphs could be rearranged randomly without changing the meaning', 'Abrupt subject jumps'] },
      { summary: 'Loose topical grouping', signals: ['Points are grouped by topic, but transitions are abrupt or mechanical'] },
      { summary: 'Cohesive narrative and argument flow', signals: ['Each paragraph naturally prompts or sets up the next', 'Clear connective thread'] },
      { summary: 'Masterful cumulative progression', signals: ['Arguments build step by step toward an earned conclusion with rhythmic grace'] },
    ],
  ),

  reading_ease: score(
    'exploratory',
    {
      question: 'How easy and natural is `post_body` to read through from beginning to end?',
      note: 'Judge rhythm, sentence clarity, and paragraph flow, independent of subject complexity.',
    },
    [
      { summary: 'Hard work; needs rereading', signals: ['Tangled sentences', 'Ideas run together without breaks', 'Unclear referents'] },
      { summary: 'Understandable but effortful', signals: ['Several overlong sentences', 'Weak paragraphing', 'The reader has to hold too much at once'] },
      { summary: 'Clear and well structured', signals: ['Short focused paragraphs', 'One idea per sentence', 'Reads smoothly start to finish'] },
      { summary: 'Effortless and rhythmic', signals: ['Varying sentence cadence', 'Strong natural structure', 'Absorbed without slowing down'] },
    ],
  ),

  skimmability: score(
    'exploratory',
    {
      question: 'If a reader scans only structural landmarks (headings, lists, bold text) in `post_body`, how much of the core argument do they grasp?',
      note: 'Judge visual hierarchy and scannability.',
    },
    [
      { summary: 'Nothing; must be read word by word', signals: ['Unbroken wall of text', 'No structural landmarks'] },
      { summary: 'A vague sense of the topic', signals: ['Some paragraph breaks but no clear signposting'] },
      { summary: 'Most of the core argument', signals: ['Clear sections or lists', 'Each chunk opens with its point'] },
      { summary: 'The whole takeaway at a glance', signals: ['Self-contained headings and lines carry the argument', 'Structure itself explains'] },
    ],
  ),

  information_density: score(
    'primary',
    {
      question: 'What is the ratio of genuine insight and substance per paragraph in `post_body` versus conversational padding?',
      note: 'Does the author respect the reader\'s time, or is the piece padded to inflate length?',
    },
    [
      { summary: 'Diluted fluff with minimal signal', signals: ['Heavy throat-clearing, obvious platitudes, and repetitive restatements'] },
      { summary: 'Moderate substance with noticeable filler', signals: ['Good points diluted by conversational tangents and unnecessary recaps'] },
      { summary: 'High substance-to-word ratio', signals: ['Almost every paragraph introduces a fresh observation, data point, or insight'] },
      { summary: 'Exceptional density throughout', signals: ['Lean, powerful prose where every sentence earns its place'] },
    ],
  ),

  // --- Substance & Intellectual Honesty ---

  specificity: score(
    'primary',
    {
      question: 'How specific and concrete is `post_body`, as opposed to abstract or general?',
      note: 'Specificity means named entities, real numbers, particular situations, and lived cases.',
    },
    [
      { summary: 'Entirely general', signals: ['No named tools, numbers, people, or cases', 'Advice that would apply to any field unchanged'] },
      { summary: 'Mostly general with isolated details', signals: ['A couple specifics decorating broad abstract claims'] },
      { summary: 'Concrete throughout', signals: ['Named entities, figures, or particular situations carry the piece'] },
      { summary: 'Specific enough to reproduce or inspect', signals: ['Exact values, steps, and tangible examples supplied'] },
    ],
  ),

  has_firsthand_evidence: bool(
    'primary',
    'Does `post_body` contain evidence from the author\'s own firsthand experience (data gathered, projects built, conversations held, or lessons lived through) rather than second-hand curation?',
  ),

  intellectual_honesty: score(
    'primary',
    {
      question: 'How honestly does `post_body` engage with nuance, tradeoffs, counter-arguments, and boundary conditions?',
      note: 'Does the author acknowledge where their argument might break down, or do they speak in dogmatic absolutes?',
    },
    [
      { summary: 'Dogmatic and one-sided', signals: ['Ignores obvious counter-arguments', 'Treats complex realities as black-and-white', 'Manufactures strawmen'] },
      { summary: 'Superficial acknowledgment of limits', signals: ['Briefly mentions an edge case without engaging with it'] },
      { summary: 'Nuanced and fair-minded', signals: ['Directly addresses counter-perspectives', 'States boundary conditions and limitations honestly'] },
      { summary: 'Deeply rigorous intellectual integrity', signals: ['Thoroughly maps where the thesis holds and where it fails', 'Strengthens the core insight by showing its exact limits'] },
    ],
  ),

  novelty: score(
    'primary',
    {
      question: 'How fresh or original are the insights presented in `post_body`?',
      note: 'Judge originality against what well-read people in this space already know.',
    },
    [
      { summary: 'Common knowledge restated', signals: ['Repeats widely known consensus without adding new value'] },
      { summary: 'Standard advice with minor personal spin', signals: ['Familiar concepts with a modest angle'] },
      { summary: 'Fresh angle or non-obvious synthesis', signals: ['Connects disparate ideas or challenges consensus with sharp logic'] },
      { summary: 'Genuinely original insight', signals: ['Groundbreaking perspective or counterintuitive breakthrough unavailable elsewhere'] },
    ],
  ),

  actionability: score(
    'primary',
    {
      question: 'After reading `post_body`, does the reader gain something concrete they can immediately do, test, or think with?',
      note: 'Judge availability and clarity of the practical takeaway.',
    },
    [
      { summary: 'Nothing actionable', signals: ['Purely abstract or reflective', 'No implied takeaway or next step'] },
      { summary: 'Vague direction', signals: ['Suggests a general area to consider without specific guidance'] },
      { summary: 'Clear practical takeaway', signals: ['Names a concrete pattern, heuristic, or technique to apply'] },
      { summary: 'Immediate executable model', signals: ['Exact steps, decision thresholds, or mental models ready to deploy'] },
    ],
  ),

  shelf_life: score(
    'exploratory',
    {
      question: 'How durable will the value of `post_body` remain over time?',
      note: 'Durability: ephemeral reaction vs evergreen reference.',
    },
    [
      { summary: 'Ephemeral (days/weeks)', signals: ['Tied to a breaking headline or fleeting trend'] },
      { summary: 'Short-lived (months)', signals: ['Relevant to current product version or annual trend'] },
      { summary: 'Medium-term (1-2 years)', signals: ['Useful throughout current technology or cultural cycle'] },
      { summary: 'Evergreen (years)', signals: ['Fundamental human principle, timeless mental model, or classic essay'] },
    ],
  ),

  post_format: choice(
    'exploratory',
    {
      question: 'What dominant structural form does `post_body` take?',
      note: 'Classify the main structure.',
    },
    {
      essay: { what: 'Structured argument defending a specific thesis' },
      teardown: { what: 'Sequentially explains how a system, tool, or process works' },
      narrative: { what: 'Chronological account of events, incidents, or personal journey' },
      listicle: { what: 'Numbered or bulleted series of discrete points or takeaways' },
      tutorial: { what: 'Step-by-step instructional guide' },
      reflection: { what: 'Introspective thoughts on craft, lessons learned, or life' },
      announcement: { what: 'Shares news of a launch, release, or milestone' },
      none_of_these: { what: 'Does not fit any single dominant structure' },
    },
  ),

  // --- Voice & Phrasing ---

  voice_authenticity: score(
    'primary',
    {
      question: 'How distinctive, coherent, and authentic is the author\'s voice across `post_body`?',
      note: 'Does it sound like a specific human with taste and conviction, or interchangeable committee prose?',
    },
    [
      { summary: 'Interchangeable corporate prose', signals: ['Zero personality', 'Could have been generated by a PR agency or template'] },
      { summary: 'Polite but generic', signals: ['Competent writing that lacks distinctive flavor or edge'] },
      { summary: 'Clear personal voice', signals: ['Consistent tone, natural cadence, and recognizable authorial stance'] },
      { summary: 'Unmistakable and compelling voice', signals: ['Memorable phrasing, genuine conviction, and an irreplaceable personal stamp'] },
    ],
  ),

  cliche_density: score(
    'exploratory',
    {
      question: 'How much of `post_body` relies on stock idioms, recycled buzzwords, or thought-leadership tropes?',
      note: 'Watch for phrases like "game-changer", "delve", "here is the thing", "leverage", "paradigm shift".',
    },
    [
      { summary: 'None; fresh phrasing throughout', signals: ['Author writes in their own words without stock formulas'] },
      { summary: 'An occasional stock phrase', signals: ['One or two familiar expressions in otherwise fresh writing'] },
      { summary: 'Noticeably formulaic', signals: ['Several stock tropes', 'Reads like a pre-formatted template'] },
      { summary: 'Heavily cliched', signals: ['A chain of buzzwords and recycled platitudes'] },
    ],
  ),

  ai_generated_feel: score(
    'exploratory',
    {
      question: 'How strongly does `post_body` read as though generated or smoothed by an LLM?',
      note: 'Signals include symmetrical sentence lengths, tidy tricolons, "it is not just X, it is Y", and excessive, bland balance.',
    },
    [
      { summary: 'Unmistakably human', signals: ['Irregular rhythm', 'Specific personal detail', 'Idiosyncratic word choices or admissions'] },
      { summary: 'Mostly human with clean editing', signals: ['Well-edited prose that preserves personal voice'] },
      { summary: 'Noticeably machine-smooth', signals: ['Even sentence lengths', 'Balanced tricolons', 'Generic connective tissue'] },
      { summary: 'Reads as raw model output', signals: ['Formulaic structure end to end', 'Repeated recap summaries', 'Zero human fingerprint'] },
    ],
  ),

  human_authorship_evidence: score(
    'primary',
    {
      question: 'How strongly does `post_body` demonstrate evidence of a specific human writing from their own lived experience?',
      note: 'Look for particular details, personal stakes, and irregular human perspective.',
    },
    [
      { summary: 'None; anonymous and interchangeable', signals: ['Could have been written by anyone or any prompt without context'] },
      { summary: 'Generic personal framing', signals: ['Uses "I" without concrete corroborating details'] },
      { summary: 'Clear personal specifics', signals: ['Specific numbers, conversations, or decisions lived through'] },
      { summary: 'Irreplaceably authentic', signals: ['Personal stakes and voice impossible to replicate artificially'] },
    ],
  ),

  who_is_the_hero: choice(
    'exploratory',
    {
      question: 'Who or what is framed as the primary hero or center of `post_body`?',
      note: 'Classify the narrative focus.',
    },
    {
      the_reader: { what: 'Focused on empowering the reader with insight or tools' },
      the_idea_or_problem: { what: 'Focused on the fascinating mechanics of the problem itself' },
      the_author: { what: 'Focused on highlighting the author\'s accomplishments or brilliance' },
      a_third_party: { what: 'Highlights an external tool, person, or organization' },
      none_of_these: { what: 'Neutral explanation with no central hero' },
    },
  ),

  // --- Verdicts & Integrity ---

  is_slop: bool(
    'primary',
    'Would an experienced reader dismiss `post_body` as low-effort filler produced just to publish something rather than because the author had something genuine to say?',
  ),

  provides_real_value: score(
    'primary',
    {
      question: 'What does a reader actually gain from reading `post_body`?',
      note: 'Judge substantive utility for the reader.',
    },
    [
      { summary: 'Nothing', signals: ['No useful information, insight, or technique'] },
      { summary: 'Surface awareness', signals: ['Learns that a topic exists, but nothing they can apply'] },
      { summary: 'Genuine usable insight', signals: ['Changes how the reader thinks or solves problems'] },
      { summary: 'Substantial high-value asset', signals: ['Detailed, authoritative essay worthy of bookmarking and sharing'] },
    ],
  ),

  unearned_hype: bool(
    'exploratory',
    'Does `post_body` rely on breathless superlatives, artificial urgency, or hyperbolic claims ("revolutionary", "this changes everything") without justifying them?',
  ),

  most_needed_improvement: choice(
    'primary',
    {
      question: 'If the author could change one thing to improve this piece most, which would it be?',
      note: 'Pick the single highest-leverage deficiency.',
    },
    {
      stronger_opening: { what: 'The opening fails to hook the reader or set up tension' },
      sharpen_central_thesis: { what: 'The argument wanders without a clear defensible core' },
      more_concrete_evidence: { what: 'Claims are asserted without real examples, data, or lived proof' },
      more_original_thinking: { what: 'Accurate but repeats widely held common knowledge' },
      less_generic_phrasing: { what: 'Language is stock, formulaic, or machine-smooth' },
      clearer_takeaway: { what: 'The reader finishes without a clear conclusion or mental model' },
      shorter_and_tighter: { what: 'The core point is buried in unnecessary padding' },
      acknowledge_tradeoffs: { what: 'Fails to recognize limitations, costs, or counter-arguments' },
      nothing_significant: { what: 'The piece is strong, cohesive, and ready to publish' },
      none_of_these: { what: 'Main deficiency is not listed' },
    },
  ),

  },
};

export default generalWritingPack;

/**
 * Direction of merit for all rated dimensions in generalWritingPack.
 */
export const directions = {
  // Attention & Premise
  preview_earns_expansion: 'higher_is_better',
  hook_strength: 'higher_is_better',
  payoff_delivery: 'higher_is_better',

  // Structure & Argument Flow
  thesis_clarity: 'higher_is_better',
  logical_progression: 'higher_is_better',
  reading_ease: 'higher_is_better',
  skimmability: 'higher_is_better',
  information_density: 'higher_is_better',

  // Substance & Intellectual Honesty
  specificity: 'higher_is_better',
  has_firsthand_evidence: 'higher_is_better',
  intellectual_honesty: 'higher_is_better',
  novelty: 'higher_is_better',
  actionability: 'higher_is_better',
  shelf_life: 'higher_is_better',

  // Voice & Phrasing
  voice_authenticity: 'higher_is_better',
  cliche_density: 'lower_is_better',
  ai_generated_feel: 'lower_is_better',
  human_authorship_evidence: 'higher_is_better',

  // Verdicts
  is_slop: 'lower_is_better',
  provides_real_value: 'higher_is_better',
  unearned_hype: 'lower_is_better',
};
