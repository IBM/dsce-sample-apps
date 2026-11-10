import type { StepSource } from '../models/types.js';

export interface StepDef {
  key: string;
  label: string;
  source: StepSource;
}

/**
 * Lifecycle. Backend steps are preparation/post-processing performed by this application.
 * `bob_processing` is the single Headless Bob phase: QSE analysis is executed by Bob inside its
 * own environment and is not separately observable through Headless Bob's API, so it is not
 * reported as its own step (no fabricated progress).
 */
export const STEPS: StepDef[] = [
  { key: 'validate_config', label: 'Validating configuration', source: 'backend' },
  { key: 'prepare_repo', label: 'Preparing repository', source: 'backend' },
  { key: 'validate_qse', label: 'Validating QSE CLI', source: 'backend' },
  { key: 'prepare_context', label: 'Preparing execution context', source: 'backend' },
  { key: 'submit_prompt', label: 'Submitting prompt to Headless Bob', source: 'backend' },
  { key: 'bob_processing', label: 'Headless Bob processing (includes QSE analysis)', source: 'headless-bob' },
  { key: 'retrieve_results', label: 'Processing results and artifacts', source: 'backend' },
  { key: 'generate_report', label: 'Generating end-to-end report', source: 'backend' },
  { key: 'completed', label: 'Execution completed', source: 'backend' }
];
