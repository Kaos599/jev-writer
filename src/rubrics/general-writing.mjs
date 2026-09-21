/**
 * General Writing Rubric Pack v1.
 *
 * Dense, platform-agnostic evaluation pack for blog posts, essays,
 * newsletters, articles, and thought leadership.
 *
 * Preserves the full breadth of the writing rubric (attention, craft,
 * substance, social mechanics, and overall verdicts) while adding key
 * depth metrics: thesis clarity, logical argument progression, information density,
 * and intellectual honesty.
 *
 * 35 questions across five groups.
 */

import { score, choice, bool } from './pack.mjs';

export const generalWritingPack = {
  id: 'general-writing',
  version: '1.0.0',
  description: 'Dense, platform-agnostic writing pack evaluating attention, structure, craft, substance, social dynamics, and quality verdicts.',
  stateFields: ['hook_text', 'post_body', 'preview_text'],
  outcomes: {
    reach_rate: 'distribution / readership reach',
    conversion_rate: 'engagement / reader response',
  },
  groups: [
    { key: 'attention', title: 'Attention & Openings', dims: ['preview_earns_expansion', 'hook_strength', 'payoff_delivery', 'hook_archetype'] },
    { key: 'craft', title: 'Craft & Structure', dims: ['thesis_clarity', 'logical_progression', 'reading_ease', 'skimmability', 'information_density', 'technicality', 'specificity', 'voice_confidence', 'cliche_density', 'ai_generated_feel', 'post_format'] },
    { key: 'substance', title: 'Substance & Value', dims: ['actionability', 'novelty', 'shelf_life', 'has_firsthand_evidence', 'teaches_transferable_skill', 'intellectual_honesty', 'ending_type'] },
    { key: 'social', title: 'Social Dynamics & Stance', dims: ['provokes_disagreement', 'who_is_the_hero', 'vulnerability', 'emotional_register', 'is_self_promotional', 'is_engagement_bait', 'is_humblebrag'] },
    { key: 'verdict', title: 'Overall Verdicts', dims: ['is_slop', 'provides_real_value', 'human_authorship_evidence', 'algorithmic_penalty_risk', 'unearned_hype', 'most_needed_improvement'] },
  ],
  questions: {

  // ==========================================
  // Group 1: Attention & Openings
  // ==========================================

  preview_earns_expansion: score(
    'primary',
    {
      question:
        'A reader browsing content sees only `preview_text` before deciding whether to expand or keep reading. How strongly does `preview_text` compel that reader to continue?',
      note: 'Judge only `preview_text`. Do not reward it for anything in `post_body` that the reader cannot yet see. A preview that is complete in itself scores low, because a satisfied reader does not expand.',
    },
    [
      {
        summary: 'Fully resolved; reader owes nothing to the rest',
        signals: ['The point is completely made before the cut', 'Reads as a finished thought', 'Expanding adds nothing the reader wants'],
      },
      {
        summary: 'Cuts off, but creates no wish to continue',
        signals: ['Breaks mid-sentence during setup', 'Throat-clearing when it cuts', 'The unfinished part is scene-setting, not substance'],
      },
      {
        summary: 'Opens a loop the reader wants closed',
        signals: ['States a claim whose support has not arrived yet', 'Promises specifics immediately below', 'Names a result without yet saying how'],
      },
      {
        summary: 'Cuts at maximum tension',
        signals: ['Breaks precisely where the interesting part begins', 'The withheld part is the reason to read', 'Leaves an urgent question the reader now needs answered'],
      },
    ],
  ),

  hook_strength: score(
    'primary',
    {
      question:
        'Rate `hook_text`, the opening of the piece, on how strongly it compels a person skimming or scrolling to stop moving and start reading.',
      note: 'Judge stopping power only. Ignore whether the claim is true, whether the post delivers on it, and whether you personally agree with it.',
    },
    [
      {
        summary: 'Gives a reader no reason to stop',
        signals: ['Preamble or throat-clearing', 'An observation anyone could have written', 'Announces a topic without making a claim about it'],
      },
      {
        summary: 'Mildly interesting, but a familiar framing',
        signals: ['A recognizable opinion stated plainly', 'Reads like many other pieces on the same subject', 'Competent but expected'],
      },
      {
        summary: 'Creates real curiosity through specificity or tension',
        signals: ['A concrete number, result, or named case', 'Sets up a gap between expectation and reality', 'Questions common practice'],
      },
      {
        summary: 'Hard to scroll past',
        signals: ['A claim that cuts against what the audience believes', 'Stakes the reader feels personally', 'Provokes an urge to find out if it is true'],
      },
    ],
  ),

  hook_archetype: choice(
    'exploratory',
    {
      question: 'Which rhetorical move does `hook_text` use to earn the reader\'s attention?',
      note: 'Classify the technique used, not how well it works. If two moves are present, pick the one doing most of the work in the first sentence.',
    },
    {
      contrarian_claim: {
        what: 'Asserts something that runs against what the audience currently believes',
        not_for: 'A merely strong opinion that most readers would already agree with',
        examples: ['Everyone is shipping X. Almost nobody is measuring Y.'],
      },
      number_or_result: {
        what: 'Leads with a specific figure, measurement, or concrete outcome',
        not_for: 'Vague magnitude claims such as "huge" or "massive"',
        examples: ['34% of our hallucinations were not hallucinations.'],
      },
      curiosity_gap: {
        what: 'Explicitly withholds the payoff and promises it further down',
        not_for: 'Hooks that state their point immediately',
        examples: ['Give me two minutes and I will explain the design choice.'],
      },
      personal_story: {
        what: 'Opens on a first-person moment, decision, or failure',
        not_for: 'First-person framing of what is really an announcement',
        examples: ['Last week I broke production for six hours.'],
      },
      announcement: {
        what: 'Reports news about the author, their work, employer, or product',
        not_for: 'News about the wider industry that the author did not produce',
        examples: ['I am launching X today.'],
      },
      industry_news: {
        what: 'Reports an external event, release, or development the author did not produce',
        not_for: 'The author\'s own launches or milestones',
        examples: ['Model X was just open-sourced.'],
      },
      direct_question: {
        what: 'Opens by asking the reader a question',
        not_for: 'Rhetorical questions buried after an opening statement',
        examples: ['How many of your evals actually test retrieval?'],
      },
      teaching_promise: {
        what: 'Promises to explain or teach a specific thing, without withholding it as a tease',
        not_for: 'Vague promises of value with no named subject',
        examples: ['Three things that actually moved the needle on our retrieval.'],
      },
      observation_or_scene: {
        what: 'Paints a vivid scene, incident, or moment in time',
        not_for: 'Abstract definitions or throat-clearing',
        examples: ['At 3:14 AM, our primary database replica stopped responding.'],
      },
      none_of_these: {
        what: 'No identifiable attention-getting move',
        not_for: 'Any hook that fits a listed archetype even weakly',
        examples: [],
      },
    },
  ),

  payoff_delivery: score(
    'primary',
    {
      question:
        'Compare `hook_text` with `post_body`. How fully does the body deliver on what the opening led the reader to expect?',
      note: 'This measures the relationship between the two, not the quality of either on its own. A modest hook fully delivered scores high. A thrilling hook followed by generic advice scores low.',
    },
    [
      {
        summary: 'The body does not deliver what the opening promised',
        signals: ['The specific thing teased is never addressed', 'The body changes subject', 'The opening claim is left unsupported'],
      },
      {
        summary: 'Partially delivers, noticeably thinner than promised',
        signals: ['Addresses the promise in general terms only', 'The reader who came for the specifics does not get them'],
      },
      {
        summary: 'Delivers what was promised',
        signals: ['The claim in the opening is supported', 'The reader gets what they came for'],
      },
      {
        summary: 'Delivers more than the opening promised',
        signals: ['Supplies specifics beyond the implied contract', 'The reader is rewarded for continuing'],
      },
    ],
  ),

  // ==========================================
  // Group 2: Craft & Structure
  // ==========================================

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
      question: 'How easy is `post_body` to read on a first pass?',
      note: 'Judge sentence rhythm, structure and clarity of expression only. This is independent of subject difficulty: a deeply technical post can be very easy to read, and a simple one can be hard to read.',
    },
    [
      { summary: 'Hard work; needs rereading', signals: ['Long tangled sentences', 'Ideas run together without breaks', 'Unclear referents'] },
      { summary: 'Understandable but effortful', signals: ['Several overlong sentences', 'Weak paragraphing', 'The reader has to hold too much at once'] },
      { summary: 'Clear and well structured', signals: ['Short paragraphs or lists', 'Roughly one idea per sentence', 'Reads smoothly start to finish'] },
      { summary: 'Effortless and rhythmic', signals: ['Deliberate short sentences', 'Strong parallel structure', 'The reader absorbs it without slowing down'] },
    ],
  ),

  skimmability: score(
    'exploratory',
    {
      question:
        'If a reader looked only at the shape of `post_body` — its headings, line breaks, list markers, and opening words of each line — without reading it closely, how much of the point would they get?',
      note: 'Judge visual scannability, not prose quality. A beautifully written wall of text scores low here.',
    },
    [
      { summary: 'Nothing; it must be read word by word', signals: ['Unbroken block of prose', 'No structural landmarks'] },
      { summary: 'A vague sense of the topic', signals: ['Some paragraph breaks but no signposting'] },
      { summary: 'Most of the argument', signals: ['Clear list items or short labelled sections', 'Each chunk opens with its point'] },
      { summary: 'The whole point, without reading the prose', signals: ['Self-contained lines that carry the argument alone', 'Structure does the explaining'] },
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

  technicality: score(
    'exploratory',
    {
      question: 'How much technical background does a reader need in order to follow `post_body`?',
      note: 'Judge the demand placed on the reader, not whether the post is good or bad.',
    },
    [
      { summary: 'None; makes no technical claim', signals: ['No tools, systems or mechanisms referenced', 'Anyone could follow it'] },
      { summary: 'Names tools or trends but explains no mechanism', signals: ['Product names used as labels', 'A reader who has never built anything could follow it'] },
      { summary: 'Explains a mechanism a practitioner could act on', signals: ['Concrete steps, figures or measurements', 'Assumes working familiarity with the domain'] },
      { summary: 'Assumes deep fluency; largely opaque to an outsider', signals: ['Unglossed jargon', 'Reasoning that presumes prior specialist knowledge'] },
    ],
  ),

  specificity: score(
    'primary',
    {
      question: 'How specific and concrete is `post_body`, as opposed to general?',
      note: 'Specificity means named things, real numbers, and particular cases. It is not the same as being technical: a personal story can be highly specific.',
    },
    [
      { summary: 'Entirely general', signals: ['No named tools, numbers, people or cases', 'Advice that would apply to any field unchanged'] },
      { summary: 'Mostly general with an occasional concrete detail', signals: ['One or two specifics decorating general claims'] },
      { summary: 'Concrete throughout', signals: ['Named tools, figures, or particular situations carry the argument'] },
      { summary: 'Specific enough to reproduce', signals: ['Enough detail that a reader could go and do the same thing', 'Exact values, versions, or steps'] },
    ],
  ),

  voice_confidence: score(
    'exploratory',
    {
      question: 'How assertive is the author\'s voice in `post_body`?',
      note: 'Judge the stance taken, not whether it is justified. Both extremes are real positions: heavy hedging and total certainty are each identifiable.',
    },
    [
      { summary: 'Heavily hedged', signals: ['Frequent "maybe", "I think", "possibly"', 'Avoids committing to any claim'] },
      { summary: 'Measured, with visible caveats', signals: ['States positions but qualifies them', 'Acknowledges limits'] },
      { summary: 'Direct and committed', signals: ['Plain declarative claims', 'Owns the position without apologising'] },
      { summary: 'Absolute', signals: ['Admits no uncertainty at all', 'States contestable claims as settled fact'] },
    ],
  ),

  cliche_density: score(
    'exploratory',
    {
      question: 'How much of `post_body` is built from stock phrasing and recycled formulations?',
      note: 'Judge the language itself, not the ideas. Examples of stock phrasing: "game-changer", "let that sink in", "here is the thing", "delve", "paradigm shift", "this changes everything".',
    },
    [
      { summary: 'None; the phrasing is the author\'s own', signals: ['No recognisable stock formulations'] },
      { summary: 'An occasional stock phrase', signals: ['One or two familiar constructions in otherwise original writing'] },
      { summary: 'Noticeably formulaic', signals: ['Several stock phrases', 'Reads like a template with content dropped in'] },
      { summary: 'Almost entirely stock phrasing', signals: ['The piece is a chain of familiar constructions', 'Nothing is said in the author\'s own words'] },
    ],
  ),

  ai_generated_feel: score(
    'exploratory',
    {
      question: 'How much does `post_body` read as though it were written or heavily rewritten by a language model rather than by a person?',
      note: 'Signals include relentlessly even sentence rhythm, tidy tricolons, "it is not just X, it is Y" constructions, unnecessary summarising, and an absence of specific personal detail. Judge the texture of the writing, not the subject.',
    },
    [
      { summary: 'Unmistakably a person', signals: ['Irregular rhythm', 'Specific personal detail', 'Idiosyncratic word choices or asides'] },
      { summary: 'Mostly human with some polish', signals: ['Cleanly edited but retains a personal voice'] },
      { summary: 'Noticeably machine-smooth', signals: ['Very even sentence lengths', 'Balanced constructions throughout', 'Generic connective tissue'] },
      { summary: 'Reads as model output', signals: ['No personal specifics at all', 'Formulaic structure end to end', 'Summarises itself unnecessarily'] },
    ],
  ),

  post_format: choice(
    'exploratory',
    {
      question: 'What shape does `post_body` take as a piece of writing?',
      note: 'Classify the dominant structure. Pick the one the piece spends most of its length being.',
    },
    {
      essay: { what: 'Structured argument defending a specific thesis' },
      listicle: { what: 'An enumerated set of points or steps', examples: ['Three things that moved the needle'] },
      teardown: { what: 'Explains how a specific thing works, in sequence', examples: ['How this system handles failure'] },
      narrative: { what: 'Tells what happened over time, with a beginning and an end', not_for: 'A single anecdote used only as an opening' },
      opinion: { what: 'Argues a position', not_for: 'Reporting news without taking a side' },
      announcement: { what: 'Reports a milestone, launch, or change', not_for: 'Teaching content wrapped around a launch mention' },
      resource_share: { what: 'Points the reader to something external to go and use' },
      reflection: { what: 'Personal or career reflection without a transferable lesson' },
      tutorial: { what: 'Step-by-step instructional walkthrough' },
      none_of_these: { what: 'No dominant recognisable structure' },
    },
  ),

  // ==========================================
  // Group 3: Substance & Value
  // ==========================================

  actionability: score(
    'primary',
    {
      question: 'After reading `post_body`, how clearly does a reader know something specific they could go and do?',
      note: 'Judge whether an action is available and clear, not whether it is easy or whether it would work.',
    },
    [
      { summary: 'Nothing to act on', signals: ['Purely informational or reflective', 'No implied next step'] },
      { summary: 'A vague direction', signals: ['Suggests a general area to think about', 'The reader would not know where to start'] },
      { summary: 'A clear action', signals: ['Names something concrete to try', 'The reader could begin today'] },
      { summary: 'A clear action with the means to do it', signals: ['Steps, tools, or thresholds supplied', 'The reader could follow it without further research'] },
    ],
  ),

  novelty: score(
    'primary',
    {
      question: 'How new is the central idea in `post_body` to someone who follows this field closely?',
      note: 'Judge against what a well-read practitioner already knows, not against a general audience. Restating a widely held view clearly is still a restatement.',
    },
    [
      { summary: 'Restates consensus', signals: ['A view already widely held and widely said'] },
      { summary: 'A familiar idea with a fresh angle', signals: ['Known point, better framing or a new example'] },
      { summary: 'An uncommon claim or a non-obvious connection', signals: ['Something a well-read reader would not have assembled themselves'] },
      { summary: 'Genuinely contrarian or previously unreported', signals: ['Cuts against the field\'s consensus', 'First-hand finding not available elsewhere'] },
    ],
  ),

  shelf_life: score(
    'exploratory',
    {
      question: 'How long will `post_body` remain useful to a reader?',
      note: 'Judge the shelf life of the content, not its current popularity. Ordered from shortest-lived to longest-lived.',
    },
    [
      { summary: 'Only meaningful in the week it was posted', signals: ['Event attendance', 'A momentary reaction to something passing'] },
      { summary: 'Tied to a specific recent event or release', signals: ['Commentary on a named launch', 'Dates quickly once the news is old'] },
      { summary: 'Useful for roughly a year before it dates', signals: ['Practices tied to a current generation of tooling'] },
      { summary: 'Still useful in two years unchanged', signals: ['How to think about a class of problem', 'Not tied to any particular tool or moment'] },
    ],
  ),

  has_firsthand_evidence: bool(
    'primary',
    'Does `post_body` report a specific number, measurement, or outcome that the author personally observed or produced, as opposed to figures quoted from elsewhere or general assertions?',
  ),

  teaches_transferable_skill: bool(
    'exploratory',
    'Could a reader take something from `post_body` and apply it to their own different situation, as opposed to only learning what happened to the author?',
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

  ending_type: choice(
    'primary',
    {
      question: 'How does `post_body` end?',
      note: 'Judge the final line or two.',
    },
    {
      question_to_reader: { what: 'Ends by asking the reader something they could answer', not_for: 'A rhetorical question the post then answers itself' },
      explicit_cta: { what: 'Asks for a specific action: follow, share, subscribe, comment, sign up' },
      link_direction: { what: 'Points the reader to an external link, repository, or resource' },
      summary_restatement: { what: 'Restates the main point to close' },
      punchline: { what: 'Ends on a sharp, memorable line that lands the argument' },
      hard_stop: { what: 'Simply stops after the last substantive point', not_for: 'Endings that restate or invite' },
      none_of_these: { what: 'The ending fits none of the above' },
    },
  ),

  // ==========================================
  // Group 4: Social Dynamics & Stance
  // ==========================================

  provokes_disagreement: score(
    'primary',
    {
      question: 'How likely is `post_body` to make an informed reader want to argue back or discuss?',
      note: 'Judge the pressure to reply, not the quality of the argument. A post can be correct and still provoke disagreement, or wrong and provoke none.',
    },
    [
      { summary: 'Nothing to argue with', signals: ['Uncontroversial', 'A reader nods and moves on'] },
      { summary: 'Mild room for disagreement', signals: ['Takes a position most would accept', 'Edge cases exist but are not provoking'] },
      { summary: 'A contestable position clearly staked', signals: ['A reader with different experience would want to say so'] },
      { summary: 'Directly challenges what many readers believe', signals: ['Names a common practice as wrong', 'Hard to read without forming a counter-argument'] },
    ],
  ),

  who_is_the_hero: choice(
    'primary',
    {
      question: 'Whose story does `post_body` centre on?',
      note: 'Judge where the attention sits across the whole post, not who is grammatically the subject of the first sentence.',
    },
    {
      the_author: { what: 'The author\'s achievement, journey, or situation is the subject', examples: ['What I built, what I learned, where I am going'] },
      the_reader: { what: 'The reader\'s problem or capability is the subject', examples: ['Your setup is broken and here is how to tell'] },
      a_third_party: { what: 'Someone or something else is the subject', examples: ['A company, a model, another person\'s work'] },
      the_idea_or_problem: { what: 'The core concept, problem, or puzzle itself is the central subject' },
      none_of_these: { what: 'No clear centre' },
    },
  ),

  vulnerability: score(
    'exploratory',
    {
      question: 'How much does the author admit to failure, uncertainty, or personal cost in `post_body`?',
      note: 'Judge genuine admission. A failure mentioned only as the setup for a triumph is not an admission.',
    },
    [
      { summary: 'None', signals: ['No mistakes, doubts or costs acknowledged'] },
      { summary: 'A minor admission in passing', signals: ['A small error noted and moved past'] },
      { summary: 'A real admission of failure or uncertainty', signals: ['Names something that went wrong and stays with it'] },
      { summary: 'Substantial personal exposure', signals: ['Admits significant failure or cost', 'The admission is the point of the piece'] },
    ],
  ),

  emotional_register: choice(
    'exploratory',
    {
      question: 'What is the dominant emotional register of `post_body`?',
      note: 'Pick the tone a reader would feel most strongly.',
    },
    {
      analytical: { what: 'Calm, explanatory, unemotional' },
      enthusiastic: { what: 'Excited or celebratory' },
      frustrated: { what: 'Irritated or critical about a state of affairs' },
      urgent: { what: 'Pressing the reader that something matters now' },
      reflective: { what: 'Thoughtful, looking back' },
      humorous: { what: 'Playing for amusement' },
      none_of_these: { what: 'No dominant register' },
    },
  ),

  is_self_promotional: bool(
    'primary',
    'Is the main purpose of this piece to promote the author, their product, their employer, or their business? Judge the primary purpose: a piece that teaches something substantial and mentions the author\'s work in passing is not primarily self-promotional.',
  ),

  is_engagement_bait: bool(
    'exploratory',
    'Does the piece ask readers to react, comment, or share for reasons unrelated to the content itself, such as "repost if you agree", manufactured controversy, or polls with no informational purpose? A genuine discussion question about the subject is not bait.',
  ),

  is_humblebrag: bool(
    'exploratory',
    'Does the piece present an achievement of the author\'s while framing it as humility, gratitude, or surprise? This is distinct from a plain announcement, which states the achievement directly without the softening frame.',
  ),

  // ==========================================
  // Group 5: Overall Verdicts
  // ==========================================

  is_slop: bool(
    'primary',
    'Would an experienced reader in this field dismiss this piece as low-effort filler — content produced to have published something rather than because the author had something genuine to say? Judge the substance behind the piece, not its polish: a well-formatted post with nothing to say is filler, and a roughly written post with a real point is not.',
  ),

  provides_real_value: score(
    'primary',
    {
      question: 'What does a reader actually gain from reading `post_body`?',
      note: 'Judge what the reader takes away, not how pleasant it was to read or how much the author gained from writing it.',
    },
    [
      { summary: 'Nothing; the reader ends where they started', signals: ['No information, insight, or usable idea', 'Exists to mark the author\'s presence'] },
      { summary: 'Awareness only', signals: ['Learns that a thing exists or happened', 'Nothing they could use'] },
      { summary: 'A genuine insight or usable piece of knowledge', signals: ['Changes how the reader thinks about something', 'Or gives them something they can apply'] },
      { summary: 'Substantial, hard to get elsewhere', signals: ['Detailed enough to act on', 'The kind of thing a reader would save or share with a colleague'] },
    ],
  ),

  human_authorship_evidence: score(
    'primary',
    {
      question: 'How much evidence is there in `post_body` that a specific human being wrote it from their own experience?',
      note: 'Look for traces only this author could supply: particular details, personal stakes, opinions with a cost, irregular phrasing. Absence of such traces is not proof of machine authorship, but it is what this question measures.',
    },
    [
      { summary: 'None; nothing identifies an author', signals: ['Interchangeable with any piece on the topic', 'No first-hand detail', 'No personal stake'] },
      { summary: 'Generic personal framing', signals: ['Uses "I" but reveals nothing specific', 'Experience asserted but not evidenced'] },
      { summary: 'Clear personal specifics', signals: ['Particular situations, numbers, or decisions the author lived through'] },
      { summary: 'Unmistakably this person', signals: ['Details nobody else could supply', 'Opinions with real cost attached', 'A voice that could not be swapped out'] },
    ],
  ),

  algorithmic_penalty_risk: score(
    'exploratory',
    {
      question: 'How likely is this piece to be down-ranked by content distribution algorithms for mechanical spam indicators?',
      note: 'Signals: excessive outbound link dumping, artificial engagement begging, duplicate or affiliate content. Judge only the presence of these mechanical risk factors, not whether the writing is good.',
    },
    [
      { summary: 'No risk factors present', signals: ['No excessive outbound links', 'No engagement begging', 'Organic, substantive piece'] },
      { summary: 'One mild risk factor', signals: ['A soft call to action or promotional link'] },
      { summary: 'A clear risk factor', signals: ['Repeated promotional links or direct requests to react and share'] },
      { summary: 'Several risk factors together', signals: ['Multiple outbound affiliate links plus engagement begging', 'Reads as marketing spam'] },
    ],
  ),

  unearned_hype: bool(
    'exploratory',
    'Does `post_body` rely on breathless superlatives, artificial urgency, or hyperbolic claims ("revolutionary", "this changes everything", "game-changer") without providing the concrete evidence to justify them?',
  ),

  most_needed_improvement: choice(
    'primary',
    {
      question: 'If the author could change exactly one thing about this piece to make it perform better, which would help most?',
      note: 'Pick the single largest deficiency. If the piece has no significant deficiency, say so rather than inventing one.',
    },
    {
      stronger_opening: { what: 'The opening fails to stop a skimming reader or establish curiosity' },
      sharpen_central_thesis: { what: 'The argument wanders without a clear defensible core' },
      more_concrete_evidence: { what: 'Claims are asserted without numbers, examples, or first-hand results' },
      more_original_thinking: { what: 'The content is accurate but restates what is already widely said' },
      less_generic_phrasing: { what: 'The ideas are fine but the language is stock, formulaic, or machine-smooth' },
      clearer_takeaway: { what: 'The reader finishes unsure what they are meant to do or think' },
      shorter_and_tighter: { what: 'The point is there but buried in unnecessary length or padding' },
      more_personal_stake: { what: 'Reads as impersonal commentary when the author\'s own experience would carry it' },
      acknowledge_tradeoffs: { what: 'Fails to recognize limitations, costs, or counter-arguments' },
      a_reason_to_reply: { what: 'Nothing invites the reader to respond or discuss' },
      nothing_significant: { what: 'The piece has no single dominant weakness worth changing' },
      none_of_these: { what: 'The main deficiency is not listed' },
    },
  ),

  },
};

export default generalWritingPack;

/**
 * Direction of merit for all rated dimensions in generalWritingPack.
 */
export const directions = {
  // Attention & Openings
  preview_earns_expansion: 'higher_is_better',
  hook_strength: 'higher_is_better',
  payoff_delivery: 'higher_is_better',

  // Craft & Structure
  thesis_clarity: 'higher_is_better',
  logical_progression: 'higher_is_better',
  reading_ease: 'higher_is_better',
  skimmability: 'higher_is_better',
  information_density: 'higher_is_better',
  technicality: 'neutral',
  specificity: 'higher_is_better',
  voice_confidence: 'neutral',
  cliche_density: 'lower_is_better',
  ai_generated_feel: 'lower_is_better',

  // Substance & Value
  actionability: 'higher_is_better',
  novelty: 'higher_is_better',
  shelf_life: 'higher_is_better',
  has_firsthand_evidence: 'higher_is_better',
  teaches_transferable_skill: 'higher_is_better',
  intellectual_honesty: 'higher_is_better',

  // Social Dynamics & Stance
  provokes_disagreement: 'neutral',
  vulnerability: 'neutral',
  is_self_promotional: 'lower_is_better',
  is_engagement_bait: 'lower_is_better',
  is_humblebrag: 'lower_is_better',

  // Overall Verdicts
  is_slop: 'lower_is_better',
  provides_real_value: 'higher_is_better',
  human_authorship_evidence: 'higher_is_better',
  algorithmic_penalty_risk: 'lower_is_better',
  unearned_hype: 'lower_is_better',
};
