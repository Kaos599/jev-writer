# Writing and customising rubric packs

A pack is a versioned set of typed questions plus the state fields each question
is allowed to see. The LinkedIn pack ships in the box; packs for newsletters,
video titles, documentation or cold email are ordinary user-space files.

## The three primitives

Choose by what the answer *means*, not by what is convenient.

| Need | Primitive | Returns |
| --- | --- | --- |
| One of a defined set, unordered | `choice` | the pick, a probability per option, confidence |
| A position on a described spectrum | `score` | a position, a probability per level, confidence |
| Whether a condition holds | `boolean` | probability of true |

A common authoring mistake is reaching for `choice` when the options are ordered.
Shelf life — ephemeral, timely, medium-lived, evergreen — is ordered, so it is a
`score`. As a `choice` you throw away the ordering and get back a label you
cannot correlate. `validatePack` cannot catch this; think about it.

## Hard constraints

- `score` takes **2 to 10 levels**. The API rejects anything else.
- `choice` needs at least two options and **must include a no-match outcome**
  (`none_of_these`). Without one you force a label onto content that fits none of
  them, which quietly manufactures data. `validatePack` enforces this.
- Every question needs a `tier` (`primary` or `exploratory`) and every rated
  dimension needs a `direction`.

## Pre-registration is not decoration

`tier` records a commitment made **before** any result was seen. Because packs
live in git, the commit timestamp is the evidence.

Without it, scoring 30 dimensions against 2 outcomes and reporting whichever
three correlate is indistinguishable from making things up: at 60 tests, about
three will look significant on pure noise. Mark a question `primary` only when
you have a mechanism you would act on. Everything else is `exploratory`, which
means it will be computed, shown, and never called a finding.

Changing a tier after seeing results defeats the entire mechanism. Do not.

## Direction is required

`higher_is_better`, `lower_is_better`, or `neutral`.

High `human_authorship_evidence` is good; high `ai_generated_feel` is bad;
`technicality` is neither, it is a choice about audience. Nothing in the question
text says which, so without this metadata a colour scale paints the worst posts
green. The report layer throws rather than guessing.

## Never ask the model anything code can count

Length, word count, emoji, hashtags, line breaks, list markers, posting hour,
days since the last post, media type — all computed exactly by the adapter, all
fed into the same analysis, all competing with the model's judgments on equal
footing.

Two reasons. Jev does not count reliably, and its own documentation says so. And
if raw character count predicts engagement better than a carefully written
rubric, that is a genuinely useful result you would never see if you had asked
the model for the count.

## Wording is load-bearing

`jev-1.13` reads instructions literally — it answers the question you wrote, not
the one you meant.

Measured during development: tightening one clause in a single boolean, from
*"a specific number or result"* to *"a result the author personally observed"*,
moved its probability from **0.99 to 0.71 on identical input**.

Therefore:

- Every `score` level is an object with a concrete `summary` and observable
  `signals`, and must stand alone — each level is judged on its own.
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

## Custom questions

To add your own dimensions to an existing pack, copy it, bump the version, add
questions with their tier and direction, and run `validatePack` before spending a
single call. A future release will support a user config file for this so the
pack itself does not need forking; until then, a copied pack is the supported
path and is version-controlled, which is the property that matters.
