export type FileType = 'docx' | 'xlsx' | 'pdf' | 'pptx' | 'email';

export interface BoxDocument {
  id: string;
  name: string;
  type: FileType;
  size: string;
  modifiedAt: string;
  owner: {
    name: string;
    role: string;
    avatar?: string;
  };
  folderPath: string;
  summary: string;
  excerptCount: number;
  supportedFindingIds: string[];
  fullContent: string;
  metadata: {
    tags: string[];
    classification: string;
    department: string;
    lastSynced: string;
    boxFileId: string;
  };
}

export type EvidenceStrength = 'strongly_supported' | 'supported' | 'not_found';

export interface DocumentExcerpt {
  documentId: string;
  documentName: string;
  folderPath: string;
  section: string;
  pageOrSheet?: string;
  text: string;
  relevanceNote: string;
}

export interface Finding {
  id: string;
  category: 'what_acme_wants_to_see' | 'pain_points' | 'technical_requirements' | 'open_questions' | 'recent_requests' | 'deprioritized';
  title: string;
  statement: string;
  groundedSummary: string;
  strength: EvidenceStrength;
  strengthLabel: string;
  supportingSourceCount: number;
  supportingDocumentIds: string[];
  excerpts: DocumentExcerpt[];
  insufficientEvidence?: boolean;
  missingInfoNote?: string;
}

export interface DemoPlanStep {
  stepNumber: number;
  title: string;
  actionToDemonstrate: string;
  presenterTalkingPoint: string;
  whyItMattersToAcme: string;
  supportingDocumentIds: string[];
  suggestedTransition: string;
  durationMinutes: number;
  category: string;
}

export interface TechnicalValidationItem {
  id: string;
  requirement: string;
  status: 'documented' | 'needs_confirmation';
  sourceDocumentIds: string[];
  notes: string;
  category: 'Security' | 'Integration' | 'Architecture' | 'Compliance' | 'Operations';
}

export interface FollowUpQuestionItem {
  category: 'Business Process' | 'Architecture' | 'Security' | 'Integration' | 'Operations';
  question: string;
  context: string;
  relevantStakeholder: string;
}

export interface DemoAsset {
  id: string;
  title: string;
  type: 'script' | 'talking_points' | 'checklist' | 'workflow' | 'questions' | 'interactive_prototype';
  description: string;
  supportedDocumentCount: number;
}

export interface AskBobQA {
  id: string;
  questionPatterns: string[];
  suggestedQuestion: string;
  answer: string;
  grounded: boolean;
  insufficientEvidence: boolean;
  supportingDocumentIds: string[];
  excerpts?: DocumentExcerpt[];
  category: 'requirements' | 'scope' | 'security' | 'open_questions' | 'strategy';
}

/**
 * A single message in a chat thread (AskBobDrawer and the workspace chat panel).
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'bob';
  text: string;
  grounded: boolean;
  insufficientEvidence?: boolean;
  supportingDocIds?: string[];
  timestamp: string;
  /** Id of the WorkspaceArtifact this message produced, if any. */
  artifactId?: string;
}

/**
 * Known artifact types. `string` is allowed so new types can be added without a type change.
 */
export type WorkspaceArtifactType = 'context' | 'rfp_response' | 'presentation' | (string & {});

/**
 * A tab in the workspace. Every generation creates a new versioned artifact;
 * only the newest artifact of a given `type` has `isLatest === true`.
 * `context` artifacts are never versioned (always version 1).
 */
export interface WorkspaceArtifact {
  id: string;
  type: WorkspaceArtifactType;
  title: string;
  /** Markdown/plain text body. For structured artifacts (e.g. presentation) this may be a text fallback. */
  content: string;
  /** Optional structured payload, e.g. slide deck data for the `presentation` type. */
  data?: unknown;
  /** 1-based version number within the artifact's `type`. */
  version: number;
  isLatest: boolean;
  /** ISO 8601 timestamp. */
  lastUpdated: string;
}

export type ScreenState =
  | 'landing'           // Screen 1: The Ask
  | 'investigating'     // Screen 2: Bob Investigates (Animation)
  | 'workspace';        // Persistent chat-driven workspace

// ─── Workspace Context tab ────────────────────────────────────────────────────

/** Reference from an extracted context item back to the Box document it came from. */
export interface ContextSourceRef {
  /** `BoxDocument.id` of the source document. */
  documentId: string;
  documentName: string;
}

export interface ContextItem {
  id: string;
  /** Short headline, e.g. "Section 3: Security, Privacy & Compliance". */
  title: string;
  /** Optional longer explanation. */
  detail?: string;
  sources: ContextSourceRef[];
}

/**
 * How the context was produced:
 * - `bob`: extracted by Headless Bob (LLM) from the live Box documents
 * - `derived`: deterministic text extraction from the live Box documents (Headless Bob unavailable)
 * - `mock`: built from the synthetic findings layer (mock mode, no live Box)
 */
export type WorkspaceContextOrigin = 'bob' | 'derived' | 'mock';

/** Content of the Context tab (everything except the Source Documents list, which is the document list itself). */
export interface WorkspaceContext {
  origin: WorkspaceContextOrigin;
  customerName: string;
  companyBackground: ContextItem[];
  requirements: ContextItem[];
  /** Gaps / unclear items. */
  openQuestions: ContextItem[];
  /** ISO 8601 timestamp. */
  generatedAt: string;
}

export type WorkspaceContextStatus = 'idle' | 'loading' | 'ready' | 'error';
