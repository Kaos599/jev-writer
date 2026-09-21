# Rubric Packs Reference

`jev-writer` ships with four calibrated rubric packs designed for different writing surfaces and technical depths. Each pack declares typed questions, pre-registered hypothesis tiers (`primary` vs `exploratory`), and a direction of merit mapping for statistical correlation and quintile banding.

---

## 1. LinkedIn Post Pack (`linkedin-post`)

**Target Use Case:** Short-form LinkedIn creator content, career updates, and industry commentary.  
**Default Adapter:** `linkedin` (reads LinkedIn's archive export + creator analytics export).  
**State Fields:** `hook_text`, `post_body`, `preview_text`.  
**Questions:** 30 (16 primary, 14 exploratory).

### Key Question Families
- **Attention (4 dims):**
  - `preview_earns_expansion` (primary, score): stopping power of the ~210 characters shown before the "see more" link cut.
  - `hook_strength` (primary, score): feed stopping power.
  - `hook_archetype` (primary, choice): contrarian claim, number/result, curiosity gap, personal story, announcement, industry news, direct question, teaching promise, none.
  - `payoff_delivery` (primary, score): whether post body delivers on the opening hook's promise.
- **Craft (8 dims):**
  - `reading_ease`, `skimmability`, `technicality`, `specificity`, `voice_confidence`, `cliche_density`, `ai_generated_feel`, `post_format`.
- **Substance (6 dims):**
  - `actionability`, `novelty`, `shelf_life`, `has_firsthand_evidence`, `teaches_transferable_skill`, `ending_type`.
- **Social Mechanics (7 dims):**
  - `provokes_disagreement`, `who_is_the_hero`, `vulnerability`, `emotional_register`, `is_self_promotional`, `is_engagement_bait`, `is_humblebrag`.
- **Verdicts (5 dims):**
  - `is_slop`, `provides_real_value`, `human_authorship_evidence`, `algorithmic_penalty_risk`, `most_needed_improvement`.

---

## 2. Technical Post Pack (`technical-post`)

**Target Use Case:** Short-form technical posts, X/Twitter engineering threads, and LinkedIn developer posts.  
**Default Adapter:** `text` or `linkedin`.  
**State Fields:** `hook_text`, `post_body`, `preview_text`.  
**Questions:** 26 (18 primary, 8 exploratory).

### Design Philosophy
Balances viral feed stopping power with rigorous engineering credibility:
- Requires concrete proof artifacts (numbers, error codes, latency figures) within the opening 3 lines.
- Forces **mechanism over adjectives** (explaining causal runtime/protocol reasons rather than saying "blazing fast").
- Enforces **quiet production authority** and **peer respect**: zero downplaying of other developers ("most developers use toys" fails this test).
- Tests for explicit tradeoff disclosure and actionable engineering rules of thumb.

### Key Question Families
- **Attention & Hook Mechanics (4 dims):** `preview_earns_expansion`, `hook_strength`, `payoff_delivery`, `hook_archetype`.
- **Technical Craft & Precision (7 dims):** `concrete_anchor`, `proof_artifact_in_hook`, `mechanism_over_adjectives`, `tradeoff_stated`, `reading_ease`, `skimmability`, `technicality`.
- **Substance & Actionability (5 dims):** `actionability`, `has_firsthand_evidence`, `teaches_transferable_skill`, `shelf_life`, `post_format`.
- **Stance & Peer Framing (5 dims):** `peer_respect_framing`, `problem_explanation_framing`, `cliche_density`, `ai_generated_feel`, `ending_type`.
- **Overall Verdicts (5 dims):** `anti_slop_technical_integrity`, `is_slop`, `provides_real_value`, `human_authorship_evidence`, `most_needed_improvement`.

---

## 3. Technical Blog Pack (`technical-blog`)

**Target Use Case:** Long-form engineering blogs, architecture breakdowns, systems design essays, benchmark analyses, and post-mortems.  
**Default Adapter:** `text` (reads markdown and text files with frontmatter and headers).  
**State Fields:** `hook_text`, `post_body`, `preview_text`.  
**Questions:** 27 (18 primary, 9 exploratory).

### Design Philosophy
Distilled from the `technical-content-writer` skill and leading publications (Tailscale, Fly.io, Dan Luu, Julia Evans, Brandur):
- **Anchor:** Must be grounded in a specific system, benchmark run, PR, or production incident timeline.
- **Physical & Systems Limits:** Respects CPU cache hierarchies, memory bandwidth, network roundtrips, and protocol semantics.
- **Checkable Proof Artifacts:** Claims backed by exact numbers, config keys, flame graphs, and reproduction steps.
- **Tradeoff Transparency:** Discloses what was sacrificed (throughput for latency, memory for CPU, simplicity for flexibility).
- **Executable Decision Procedures:** Concludes with an executable heuristic or diagnostic condition $\rightarrow$ choice mapping.
- **Zero Jargon Theater & Peer Respect:** Plain English headings ("dashboard" not "cockpit"), domain constraints as sole antagonist.

### Key Question Families
- **Systems Anchoring & Constraints (5 dims):** `concrete_anchor`, `domain_constraint_rigor`, `proof_artifact_strength`, `mechanism_over_adjectives`, `tradeoff_transparency`.
- **Engineering Utility & Reproducibility (6 dims):** `executable_decision_procedure`, `reproducibility_level`, `code_explanatory_utility`, `actionability`, `shelf_life`, `blog_archetype`.
- **Structure & Technical Prose (5 dims):** `hook_strength`, `payoff_delivery`, `technical_reading_ease`, `skimmability`, `information_density`.
- **Authorial Stance & Ethics (5 dims):** `peer_respect_framing`, `problem_explanation_framing`, `jargon_theater_density`, `author_seniority_stance`, `who_is_the_hero`.
- **Verdicts & Technical Integrity (6 dims):** `anti_slop_technical_integrity`, `is_slop`, `ai_generated_feel`, `provides_engineering_value`, `unearned_hype`, `technical_improvement_lever`.

---

## 4. General Writing Pack (`general-writing`)

**Target Use Case:** General blog posts, essays, newsletters, articles, and thought pieces.  
**Default Adapter:** `text` (reads markdown and text files).  
**State Fields:** `hook_text`, `post_body`, `preview_text`.  
**Questions:** 25 (16 primary, 9 exploratory).

### Design Philosophy
Evaluates writing on fundamental prose craft and intellectual substance rather than platform tricks:
- **Thesis Clarity:** Does the piece have a clear, defensible central thesis, or does it wander?
- **Logical Progression:** Do paragraphs build cumulatively with natural transitions?
- **Information Density:** High insight-to-word ratio without fluff or synthetic padding.
- **Intellectual Honesty:** Engages with counter-arguments, tradeoffs, and boundaries rather than dogmatism.
- **Voice Authenticity:** Genuine human perspective with conviction vs corporate vanilla.
- **Anti-Slop Integrity:** Detects AI-generated cadence, recycled platitudes, and unearned hype.

### Key Question Families
- **Attention & Openings (4 dims):** `preview_earns_expansion`, `hook_strength`, `payoff_delivery`, `hook_archetype`.
- **Craft & Structure (11 dims):** `thesis_clarity`, `logical_progression`, `reading_ease`, `skimmability`, `information_density`, `technicality`, `specificity`, `voice_confidence`, `cliche_density`, `ai_generated_feel`, `post_format`.
- **Substance & Value (7 dims):** `actionability`, `novelty`, `shelf_life`, `has_firsthand_evidence`, `teaches_transferable_skill`, `intellectual_honesty`, `ending_type`.
- **Social Dynamics & Stance (7 dims):** `provokes_disagreement`, `who_is_the_hero`, `vulnerability`, `emotional_register`, `is_self_promotional`, `is_engagement_bait`, `is_humblebrag`.
- **Overall Verdicts (6 dims):** `is_slop`, `provides_real_value`, `human_authorship_evidence`, `algorithmic_penalty_risk`, `unearned_hype`, `most_needed_improvement`.

---

## Selecting the Right Pack in the CLI

```bash
# Pre-flight audit a draft post or blog article
node src/cli.mjs audit post.md --pack linkedin-post
node src/cli.mjs audit post.md --pack technical-post
node src/cli.mjs audit blog.md --pack technical-blog
node src/cli.mjs audit essay.md --pack general-writing

# Build and rate a whole corpus
node src/cli.mjs build ./posts --adapter text
node src/cli.mjs rate --pack technical-blog
node src/cli.mjs analyze
node src/cli.mjs dashboard --pack technical-blog
```
