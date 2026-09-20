/**
 * LinkedIn post rubric pack v1.
 *
 * 30 questions across five groups. 16 are pre-registered primary hypotheses;
 * 14 are exploratory and must never be reported as findings.
 *
 * Nothing countable is asked here. Length, emoji, hashtags, line breaks, media
 * type and posting cadence are computed by the adapter and compete with these
 * judgments as ordinary features - if raw character count predicts engagement
 * better than a carefully written rubric, that is worth knowing, and asking a
 * model to count would only have produced a worse number.
 *
 * Score levels describe concrete situations and stand alone, because each level
 * is judged on its own against the text. Choice options carry what / not_for /
 * examples to sharpen boundaries, and every Choice has a no-match escape.
 *
 * Wording is load-bearing. During development, tightening a single clause in
 * one boolean - from "a specific number or result" to "a result the author
 * personally observed" - moved its probability from 0.99 to 0.71 on identical
 * input. Treat edits to this file as breaking changes and re-run affected
 * corpora rather than mixing ratings across wordings.
 */

import { score, choice, bool } from './pack.mjs';

export const linkedinPostPack = {
  id: 'linkedin-post',
  version: '1.0.0',
  description: 'Rates LinkedIn posts on attention, craft, substance, social mechanics and direct quality verdicts.',
  // `preview_text` is the ~210 characters LinkedIn shows before "see more".
  // The adapter computes the cut so the model never has to count characters.
  stateFields: ['hook_text', 'post_body', 'preview_text'],
  outcomes: {
    reach_rate: 'impressions / followers at post time - did the platform distribute it?',
    conversion_rate: 'engagements / impressions - given it was seen, did it work?',
  },
  // Families for the expanded post view in the dashboard. Presentation only:
  // grouping never touches how a question is asked, rated or correlated. A pack
  // that declares none still renders, with every question in one list.
  groups: [
    { key: 'attention', title: 'Attention', dims: ['preview_earns_expansion', 'hook_strength', 'payoff_delivery', 'hook_archetype'] },
    { key: 'craft', title: 'Craft', dims: ['reading_ease', 'skimmability', 'technicality', 'specificity', 'voice_confidence', 'cliche_density', 'ai_generated_feel', 'post_format'] },
    { key: 'substance', title: 'Substance', dims: ['actionability', 'novelty', 'shelf_life', 'has_firsthand_evidence', 'teaches_transferable_skill', 'ending_type'] },
    { key: 'social', title: 'How it behaves socially', dims: ['provokes_disagreement', 'who_is_the_hero', 'vulnerability', 'emotional_register', 'is_self_promotional', 'is_engagement_bait', 'is_humblebrag'] },
    { key: 'verdict', title: 'Overall verdicts', dims: ['is_slop', 'provides_real_value', 'human_authorship_evidence', 'algorithmic_penalty_risk', 'most_needed_improvement'] },
  ],
  questions: {

  preview_earns_expansion: score(
    'primary',
    {
      question:
        'A reader scrolling LinkedIn sees only `preview_text` before the rest of the post is hidden behind a "see more" link. How strongly does `preview_text` make that reader click to expand?',
      note: 'Judge only `preview_text`. Do not reward it for anything in `post_body` that the reader cannot yet see. A preview that is well written but complete in itself should score low, because a satisfied reader does not expand.',
    },
    [
      {
        summary: 'Fully resolved; the reader owes nothing to the rest',
        signals: ['The point is completely made before the cut', 'Reads as a finished thought', 'Expanding would only add detail the reader has no reason to want'],
      },
      {
        summary: 'Cuts off, but creates no wish to continue',
        signals: ['Breaks mid-sentence during setup', 'Still clearing its throat when it cuts', 'The unfinished part is scene-setting, not substance'],
      },
      {
        summary: 'Opens a loop the reader wants closed',
        signals: ['States a claim whose support has not arrived yet', 'Promises specifics immediately below', 'Names a result without yet saying how'],
      },
      {
        summary: 'Cuts at maximum tension',
        signals: ['Breaks precisely where the interesting part begins', 'The withheld part is the whole reason to read', 'Leaves a question the reader now needs answered'],
      },
    ],
  ),

  hook_strength: score(
    'primary',
    {
      question:
        'Rate `hook_text`, the opening of a LinkedIn post, on how strongly it compels a person scrolling a busy feed to stop moving and start reading.',
      note: 'Judge stopping power only. Ignore whether the claim is true, whether the post delivers on it, and whether you agree with it.',
    },
    [
      {
        summary: 'Gives a scrolling reader no reason to stop',
        signals: ['Preamble or throat-clearing', 'An observation anyone in the field could have written', 'Announces a topic without making a claim about it'],
      },
      {
        summary: 'Mildly interesting, but a familiar framing',
        signals: ['A recognisable opinion stated plainly', 'Reads like many other posts on the same subject', 'Competent but expected'],
      },
      {
        summary: 'Creates real curiosity through specificity or tension',
        signals: ['A concrete number, result, or named case', 'Sets up a gap between what is expected and what happened', 'Names a common practice and questions it'],
      },
      {
        summary: 'Hard to scroll past',
        signals: ['A claim that cuts against what the audience believes', 'Stakes the reader feels personally', 'Provokes an urge to argue or to find out whether it is true'],
      },
    ],
  ),

  hook_archetype: choice(
    'primary',
    {
      question: 'Which rhetorical move does `hook_text` use to earn the reader\'s attention?',
      note: 'Classify the technique used, not how well it works. If two moves are present, pick the one doing most of the work in the first sentence.',
    },
    {
      contrarian_claim: {
        what: 'Asserts something that runs against what the audience currently believes',
        not_for: 'A merely strong opinion that most readers would already agree with',
        examples: ['Everyone is shipping X. Almost nobody is measuring Y.', 'Your model is probably fine. Your retrieval is not.'],
      },
      number_or_result: {
        what: 'Leads with a specific figure, measurement, or concrete outcome',
        not_for: 'Vague magnitude claims such as "huge" or "massive"',
        examples: ['34% of our hallucinations were not hallucinations.', 'We cut latency from 4s to 380ms.'],
      },
      curiosity_gap: {
        what: 'Explicitly withholds the payoff and promises it further down',
        not_for: 'Hooks that state their point immediately',
        examples: ['Give me two minutes and I will explain the design choice.', 'Here is what nobody tells you about X.'],
      },
      personal_story: {
        what: 'Opens on a first-person moment, decision, or failure',
        not_for: 'First-person framing of what is really an announcement',
        examples: ['Last week I broke production for six hours.'],
      },
      announcement: {
        what: 'Reports news about the author, their work, employer, or product',
        not_for: 'News about the wider industry that the author did not produce',
        examples: ['I am joining X.', 'My portfolio was featured as site of the day.'],
      },
      industry_news: {
        what: 'Reports an external event, release, or development the author did not produce',
        not_for: 'The author\'s own launches or milestones',
        examples: ['Kimi K3 just went open source.'],
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
        signals: ['Supplies specifics beyond the implied contract', 'The reader is rewarded for expanding'],
      },
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
        'If a reader looked only at the shape of `post_body` — its line breaks, list markers, and opening words of each line — without reading it closely, how much of the point would they get?',
      note: 'Judge visual scannability, not prose quality. A beautifully written wall of text scores low here.',
    },
    [
      { summary: 'Nothing; it must be read word by word', signals: ['Unbroken block of prose', 'No structural landmarks'] },
      { summary: 'A vague sense of the topic', signals: ['Some paragraph breaks but no signposting'] },
      { summary: 'Most of the argument', signals: ['Clear list items or short labelled sections', 'Each chunk opens with its point'] },
      { summary: 'The whole point, without reading the prose', signals: ['Self-contained lines that carry the argument alone', 'Structure does the explaining'] },
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
      question: 'How much of `post_body` is built from stock LinkedIn phrasing and recycled formulations?',
      note: 'Judge the language itself, not the ideas. Examples of stock phrasing: "let that sink in", "here is the thing", "I am humbled to announce", "agree?", "thoughts?", "this changes everything".',
    },
    [
      { summary: 'None; the phrasing is the author\'s own', signals: ['No recognisable stock formulations'] },
      { summary: 'An occasional stock phrase', signals: ['One or two familiar constructions in otherwise original writing'] },
      { summary: 'Noticeably formulaic', signals: ['Several stock phrases', 'Reads like a template with content dropped in'] },
      { summary: 'Almost entirely stock phrasing', signals: ['The post is a chain of familiar constructions', 'Nothing is said in the author\'s own words'] },
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
      note: 'Classify the dominant structure. Pick the one the post spends most of its length being.',
    },
    {
      listicle: { what: 'An enumerated set of points or steps', examples: ['Three things that moved the needle'] },
      teardown: { what: 'Explains how a specific thing works, in sequence', examples: ['How this model handles long context'] },
      narrative: { what: 'Tells what happened over time, with a beginning and an end', not_for: 'A single anecdote used only as an opening' },
      opinion: { what: 'Argues a position', not_for: 'Reporting news without taking a side' },
      announcement: { what: 'Reports a milestone, launch, or change', not_for: 'Teaching content wrapped around a launch mention' },
      resource_share: { what: 'Points the reader to something external to go and use' },
      reflection: { what: 'Personal or career reflection without a transferable lesson' },
      none_of_these: { what: 'No dominant recognisable structure' },
    },
  ),

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


  ending_type: choice(
    'primary',
    {
      question: 'How does `post_body` end?',
      note: 'Judge the final line or two. On LinkedIn, comments drive reach more than reactions do, so how a post closes is a distinct lever from how it opens.',
    },
    {
      question_to_reader: { what: 'Ends by asking the reader something they could answer', not_for: 'A rhetorical question the post then answers itself' },
      explicit_cta: { what: 'Asks for a specific action: follow, share, comment, sign up' },
      link_direction: { what: 'Points the reader to a link, often "in the comments"' },
      summary_restatement: { what: 'Restates the main point to close' },
      punchline: { what: 'Ends on a sharp, memorable line that lands the argument', examples: ['Your model is probably fine. Your retrieval is not.'] },
      hard_stop: { what: 'Simply stops after the last substantive point', not_for: 'Endings that restate or invite' },
      none_of_these: { what: 'The ending fits none of the above' },
    },
  ),

  provokes_disagreement: score(
    'primary',
    {
      question: 'How likely is `post_body` to make an informed reader want to argue back in the comments?',
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
      the_reader: { what: 'The reader\'s problem or capability is the subject', examples: ['Your retrieval is broken and here is how to tell'] },
      a_third_party: { what: 'Someone or something else is the subject', examples: ['A company, a model, another person\'s work'] },
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
      { summary: 'Substantial personal exposure', signals: ['Admits significant failure or cost', 'The admission is the point of the post'] },
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
    'Is the main purpose of this post to promote the author, their product, their employer, or a role they are hiring for? Judge the primary purpose: a post that teaches something substantial and mentions the author\'s work in passing is not primarily self-promotional.',
  ),

  is_engagement_bait: bool(
    'exploratory',
    'Does the post ask readers to react, comment, or share for reasons unrelated to the content itself, such as "comment YES below", "repost if you agree", or a poll with no informational purpose? This is narrower than simply ending with a question: a genuine question about the subject is not bait.',
  ),

  is_humblebrag: bool(
    'exploratory',
    'Does the post present an achievement of the author\'s while framing it as humility, gratitude, or surprise? This is distinct from a plain announcement, which states the achievement directly without the softening frame.',
  ),


  is_slop: bool(
    'primary',
    'Would an experienced reader in this field dismiss this post as low-effort filler — content produced to have posted something rather than because the author had something to say? Judge the substance behind the post, not its polish: a well-formatted post with nothing to say is filler, and a roughly written post with a real point is not.',
  ),

  provides_real_value: score(
    'primary',
    {
      question: 'What does a reader actually gain from reading `post_body`?',
      note: 'Judge what the reader takes away, not how pleasant it was to read or how much the author gained from posting it.',
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
      { summary: 'None; nothing identifies an author', signals: ['Interchangeable with any post on the topic', 'No first-hand detail', 'No personal stake'] },
      { summary: 'Generic personal framing', signals: ['Uses "I" but reveals nothing specific', 'Experience asserted but not evidenced'] },
      { summary: 'Clear personal specifics', signals: ['Particular situations, numbers, or decisions the author lived through'] },
      { summary: 'Unmistakably this person', signals: ['Details nobody else could supply', 'Opinions with real cost attached', 'A voice that could not be swapped out'] },
    ],
  ),

  algorithmic_penalty_risk: score(
    'exploratory',
    {
      question: 'How likely is this post to be down-ranked by LinkedIn\'s feed algorithm for reasons unrelated to its quality?',
      note: 'LinkedIn is understood to reduce distribution for: outbound links in the post body, explicit requests for engagement, reposted or duplicated content, and posts that read as advertising. Judge only the presence of these mechanical risk factors, not whether the post is good.',
    },
    [
      { summary: 'No risk factors present', signals: ['No outbound link', 'No engagement request', 'Reads as organic personal content'] },
      { summary: 'One mild risk factor', signals: ['A soft call to action', 'A link placed in the comments rather than the body'] },
      { summary: 'A clear risk factor', signals: ['An outbound link in the post body', 'A direct request to react, comment, or share'] },
      { summary: 'Several risk factors together', signals: ['Outbound link plus engagement request', 'Reads as an advertisement'] },
    ],
  ),

  most_needed_improvement: choice(
    'primary',
    {
      question: 'If the author could change exactly one thing about this post to make it perform better, which would help most?',
      note: 'Pick the single largest deficiency. If the post has no significant deficiency, say so rather than inventing one.',
    },
    {
      stronger_opening: { what: 'The opening fails to stop a scrolling reader', not_for: 'Posts whose opening already works but whose body is weak' },
      more_concrete_evidence: { what: 'Claims are asserted without numbers, examples, or first-hand results' },
      more_original_thinking: { what: 'The content is accurate but restates what is already widely said' },
      less_generic_phrasing: { what: 'The ideas are fine but the language is stock, formulaic, or machine-smooth' },
      clearer_takeaway: { what: 'The reader finishes unsure what they are meant to do or think' },
      shorter_and_tighter: { what: 'The point is there but buried in unnecessary length' },
      more_personal_stake: { what: 'Reads as impersonal commentary when the author\'s own experience would carry it' },
      a_reason_to_reply: { what: 'Nothing invites the reader to respond, so it will collect views but not comments' },
      nothing_significant: { what: 'The post has no single dominant weakness worth changing' },
      none_of_these: { what: 'The main deficiency is not listed' },
    },
  ),

  },
};

export default linkedinPostPack;

/**
 * Direction of merit for every rated dimension.
 *
 * Required by the report layer. Without it a colour scale paints the worst
 * posts green: a high `ai_generated_feel` is bad while a high
 * `human_authorship_evidence` is good, and nothing in the question itself says
 * which. `neutral` means the dimension is descriptive rather than better or
 * worse - `technicality` is not a virtue, it is a choice about audience.
 */
export const directions = {
  // attention
  preview_earns_expansion: 'higher_is_better',
  hook_strength: 'higher_is_better',
  payoff_delivery: 'higher_is_better',
  // craft
  reading_ease: 'higher_is_better',
  skimmability: 'higher_is_better',
  technicality: 'neutral',
  specificity: 'higher_is_better',
  voice_confidence: 'neutral',
  cliche_density: 'lower_is_better',
  ai_generated_feel: 'lower_is_better',
  // substance
  actionability: 'higher_is_better',
  novelty: 'higher_is_better',
  shelf_life: 'higher_is_better',
  has_firsthand_evidence: 'higher_is_better',
  teaches_transferable_skill: 'higher_is_better',
  // social
  provokes_disagreement: 'neutral',
  vulnerability: 'neutral',
  is_self_promotional: 'lower_is_better',
  is_engagement_bait: 'lower_is_better',
  is_humblebrag: 'lower_is_better',
  // verdicts
  is_slop: 'lower_is_better',
  provides_real_value: 'higher_is_better',
  human_authorship_evidence: 'higher_is_better',
  algorithmic_penalty_risk: 'lower_is_better',
};
