
export type MediaStatus = 'Want to Read' | 'Consuming' | 'Finished' | 'Paused' | 'Abandoned';
export type MediaType = 'book' | 'video' | 'podcast' | 'article' | 'course' | 'paper' | 'other';
export type AnnotationType = 'highlight' | 'thought' | 'question' | 'connection';
export type VaultType = 'belief' | 'principle' | 'mental_model' | 'life_rule' | 'worldview';
export type EventType = 'created' | 'refined' | 'challenged' | 'revised' | 'expanded' | 'abandoned';

export interface Annotation {
  id: string;
  text: string;
  type: AnnotationType;
  context?: string;
  date: string;
  answer?: string;
}

export interface SessionLog {
  id: string;
  date: string;
  notes: string;
}

export interface Media {
  id: string;
  title: string;
  creator: string;
  type: MediaType;
  status: MediaStatus;
  year?: string;
  genre?: string;
  description?: string;
  thumbnailUrl?: string;
  tags: string[];
  annotations: Annotation[];
  capture: {
    before?: {
      priorBeliefs?: string;
      expectation?: string;
      openQuestion?: string;
    };
    after?: {
      coreArgument?: string;
      heldUp?: string;
      didntHold?: string;
      lasting?: string;
      beliefChange?: string;
      crossRefs?: string;
    };
    sessions: SessionLog[];
  };
  dateAdded: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  type: VaultType;
  statement: string;
  description: string;
  confidence: number; // 1-5
  status: 'active' | 'questioning' | 'revised' | 'abandoned';
  tags: string[];
  sourceIds: string[];
  evidenceFor: string[];
  evidenceAgainst: string[];
  versionHistory: Array<{
    statement: string;
    reason: string;
    date: string;
  }>;
  dateCreated: string;
  dateUpdated: string;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  sourceIds: string[];
  tags: string[];
  dateCreated: string;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  links: string[]; // names of other concepts
  dateCreated: string;
  x?: number; // relative positions for atlas
  y?: number;
}

export interface Draft {
  id: string;
  title: string;
  body: string;
  type: 'essay' | 'script' | 'field_note';
  status: 'seed' | 'drafting' | 'revised' | 'final';
  conceptTags: string[];
  sourceIds: string[];
  questionIds: string[];
  beliefIds: string[];
  dateCreated: string;
  dateUpdated: string;
}

export interface TimelineEvent {
  id: string;
  entityId: string;
  entityType: 'vault' | 'media' | 'draft';
  entityTitle: string;
  eventType: EventType;
  reason: string;
  influencedBy: string[];
  date: string;
  timestamp: number;
}
