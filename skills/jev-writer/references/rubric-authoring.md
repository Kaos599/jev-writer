# Writing and customising rubric packs

A pack is a versioned set of typed questions plus the state fields each question
is allowed to see. `jev-writer` ships with four calibrated packs:
- `linkedin-post`: LinkedIn creator content with viral feed mechanics
- `technical-post`: Short-form technical posts and threads (LinkedIn / X)
- `technical-blog`: Deep engineering essays, benchmarks, and architecture teardowns
- `general-writing`: General blog posts, essays, newsletters, and articles

For detailed specifications of the shipped packs, see `references/packs.md`.
Custom packs for documentation, cold email, or customer stories can be authored using
the primitives below.

The format lives in `src/rubrics/pack.mjs` in the repo. From outside the package
it is imported as `jev-writer/rubrics/pack.mjs`; deep paths into `src/` do not
resolve, because the `exports` map in `package.json` is the public surface.

```js
import { score, choice, bool, validatePack } from 'jev-writer/rubrics/pack.mjs';
```

## The three primitives

Choose by what the answer *means*, not by what is convenient.

| Need | Primitive | Returns |
| --- | --- | --- |
| One of a defined set, unordered | `choice` | the pick, a probability per option, confidence |
| A position on a described spectrum | `score` | a position, a probability per level, confidence |
| Whether a condition holds | `boolean` | probability of true |

A common authoring mistake is reaching for `choice` when the options are ordered.
Shelf life (ephemeral, timely, medium-lived, evergreen) is ordered, so it is a
`score`. As a `choice` you throw away the ordering and get back a label you
cannot correlate. `validatePack` cannot catch this; think about it.

Only `score` and `boolean` questions are correlated against outcomes, banded or
graded. `choice` answers are shown but never ranked, because a nominal label has
no direction to rank along.

## What `validatePack` actually checks

Run it before spending a single call. It returns an array of human-readable
problems, and an empty array means valid. It checks:

- the pack has an `id`, a `version`, a `description`, non-empty `stateFields` and
  at least one question,
- every question id is snake_case,
- every `type` is one of `score`, `choice`, `boolean`,
- every `tier` is `primary` or `exploratory`,
- every question has `instructions`,
- every `score` has between 2 and 10 levels,
- every `choice` has at least two options and one of them is `none_of_these`,
  `other` or `no_match`,
- every backticked reference inside an instruction names a field the pack
  declared in `stateFields`.

**It does not check direction of merit.** See the next section.

## Direction is required, but not by `validatePack`

Direction of merit is a separate `directions` export beside the pack, mapping
each rated dimension to `higher_is_better`, `lower_is_better`, or `neutral`:

```js
export const directions = {
  hook_strength: 'higher_is_better',
  ai_generated_feel: 'lower_is_better',
  technicality: 'neutral',
};
```

High `human_authorship_evidence` is good; high `ai_generated_feel` is bad;
`technicality` is neither, it is a choice about audience. Nothing in the question
text says which, so without this metadata a colour scale paints the worst posts
green.

Enforcement happens at runtime in the report layer, not at validation time.
`buildReport` throws when a rated dimension has no direction, and the CLI skips
report generation with a warning when a pack has no directions entry at all. So a
pack can pass `validatePack`, rate a whole corpus, and then produce no
`report.json` and no dashboard. Write the directions at the same time as the
questions.

Only `score` and `boolean` questions need one. The shipped LinkedIn pack has 30
questions, 24 of which are rated and therefore carry a direction: 13
`higher_is_better`, 7 `lower_is_better`, 4 `neutral`.

## Pre-registration is not decoration

`tier` records a commitment made **before** any result was seen. Because packs
live in git, the commit timestamp is the evidence.

Without it, scoring two dozen dimensions against two outcomes and reporting
whichever three correlate is indistinguishable from making things up: at 48
tests, roughly 2.4 will look significant on pure noise. Mark a question `primary`
only when you have a mechanism you would act on. Everything else is
`exploratory`, which means it will be computed, shown, and never called a
finding.

Changing a tier after seeing results defeats the entire mechanism. Do not.

## Never ask the model anything code can count

Length, word count, emoji, hashtags, line breaks, list markers, posting hour,
days since the last post, media type: all computed exactly by the adapter, all
fed into the same analysis, all competing with the model's judgments on equal
footing.

Two reasons. Jev does not count reliably, and its own documentation says so. And
if raw character count predicts engagement better than a carefully written
rubric, that is a genuinely useful result you would never see if you had asked
the model for the count.

## Wording is load-bearing

`jev-1.13` reads instructions literally. It answers the question you wrote, not
the one you meant.

Measured during development: tightening one clause in a single boolean, from
*"a specific number or result"* to *"a result the author personally observed"*,
moved its probability from **0.99 to 0.71 on identical input**.

Therefore:

- Every `score` level is an object with a concrete `summary` and observable
  `signals`, and must stand alone, because each level is judged on its own.
- Every `choice` option carries `what`, `not_for` and `examples` to sharpen the
  boundary against its neighbours.
- Put boundary cases in the criteria, not in your head. When you look at a wrong
  answer and find yourself explaining what you really meant, that explanation is
  the missing half of the instruction.
- **Treat a pack edit as a breaking change.** Ratings produced under different
  wordings are not comparable and must not be pooled. Bump the version and
  re-rate.

## State discipline

`stateFields` declares exactly what a question may see, and `buildState` drops
everything else. Two reasons this is enforced rather than trusted:

- Jev suffers from context rot; unrelated material in the state measurably costs
  accuracy.
- A rubric that can see the engagement it is meant to predict is not measuring
  anything. Outcome fields must never reach the model, and the tests assert it.

## Groups are presentation only

A pack may declare a `groups` array, each entry naming a `key`, a `title` and the
dimensions it contains. The LinkedIn pack declares five families covering all 30
questions. The dashboard uses them to organise the expanded post view, and
nothing else does: grouping never touches how a question is asked, rated or
correlated. A pack that declares none still renders, with every question in one
list, and anything a pack leaves unplaced falls into a catch-all.

## Custom questions

To add your own dimensions to an existing pack, copy it, bump the version, add
questions with their tier, add their direction to the `directions` export, and
run `validatePack` before spending a single call. Then register the pack and its
directions in `src/cli.mjs` so the commands can find it.

A future release will support a user config file so the pack itself does not need
forking; until then, a copied pack is the supported path and is version
controlled, which is the property that matters.
