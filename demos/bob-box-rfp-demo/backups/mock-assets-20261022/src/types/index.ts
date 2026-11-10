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

export type ScreenState = 
  | 'landing'           // Screen 1: The Ask
  | 'investigating'     // Screen 2: Bob Investigates (Animation)
  | 'discovered_files'  // Screen 3: Box Content Discovered
  | 'demo_brief'        // Screen 4: Acme Demo Brief
  | 'demo_plan'         // Screen 6: Build Tailored Demo Plan
  | 'demo_assets'       // Screen 7: Generate Demo Assets
  | 'demo_ready';       // Screen 8: Acme Demo Ready
