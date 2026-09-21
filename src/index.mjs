// Library entry point. The CLI is the other consumer of these same modules;
// nothing here is CLI-specific, so an agent or a notebook can drive the whole
// pipeline without shelling out.
//
// The subpath exports in package.json are the stable surface. Anything not
// re-exported here or listed there is internal and may change without a major.

export {
  rank,
  pearson,
  spearman,
  residualise,
  partialSpearman,
  permutationP,
  bootstrapCI,
  benjaminiHochberg,
  criticalR,
  minimumDetectableEffect,
  powerReport,
  testDimension,
} from './stats.mjs';

export {
  BANDS,
  bandEdges,
  bandFor,
  gradePost,
  buildReport,
  buildWritingPrompt,
  DIMENSION_LABELS,
  labelFor,
} from './report.mjs';

export {
  TIERS,
  validatePack,
  toApiQuestions,
  tiersOf,
  countByTier,
  buildState,
  score,
  choice,
  bool,
} from './rubrics/pack.mjs';

export { generalWritingPack, directions as generalDirections } from './rubrics/general-writing.mjs';
export { linkedinPostPack, directions as linkedinDirections } from './rubrics/linkedin-post.mjs';
export { technicalBlogPack, directions as technicalBlogDirections } from './rubrics/technical-blog.mjs';
export { technicalPostPack, directions as technicalPostDirections } from './rubrics/technical-post.mjs';

export { buildCorpus, textFeatures, splitHook } from './adapters/linkedin.mjs';
export { buildTextCorpus, parseTextFile } from './adapters/text.mjs';

export { PROVIDERS, detectProvider, availableProviders, evaluate } from './providers/index.mjs';

export { buildDashboard } from './dashboard.mjs';
export { auditPost, preparePostState, formatAuditTerminal, formatAuditMarkdown } from './audit.mjs';
