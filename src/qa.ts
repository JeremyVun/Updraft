declare const __QA__: boolean;

// Direct Node mechanics checks do not pass through Vite.
export const QA = typeof __QA__ === 'undefined' || __QA__;
