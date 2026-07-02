import { READEX_COLLECTIONS, READEX_SETTINGS_DOCS } from './firestore-schema';

export interface GuideSection {
  id: string;
  label: string;
  viewId?: string;
  section: 'Mind' | 'Inputs' | 'Outputs' | 'Self' | 'System';
  definition: string;
  whatYouDo: string[];
  connectsTo: string[];
  importantActions: string[];
}

export interface GuideObject {
  id: string;
  label: string;
  collection?: string;
  definition: string;
  appearsIn: string[];
  createdBy: string[];
  connectsTo: string[];
}

export interface GuideWorkflow {
  id: string;
  label: string;
  steps: string[];
}

export const noesisGuide = {
  title: 'How Noesis Works',
  overview:
    'Noesis is built around connected thinking. Different sections help you capture, organize, question, connect, and develop your ideas without forcing every thought into one rigid path.',
  sections: [
    {
      id: 'atlas',
      label: 'Atlas',
      viewId: 'atlas',
      section: 'Mind',
      definition: 'The map view for concepts and their links.',
      whatYouDo: [
        'Pan around the map and inspect connected concepts.',
        'Create or edit custom maps.',
        'Review typed links and shared evidence relationships.',
      ],
      connectsTo: ['Concepts', 'Positions', 'Inquiries', 'Works', 'Practices'],
      importantActions: ['Select node', 'Create map', 'Edit links', 'Filter link types'],
    },
    {
      id: 'concepts',
      label: 'Concepts',
      viewId: 'concepts',
      section: 'Mind',
      definition: 'The encyclopedia of recurring ideas and terms in your system.',
      whatYouDo: [
        'Define concepts and edit their descriptions.',
        'Review linked sources, annotations, inquiries, positions, works, and practices.',
        'See growth areas and related history.',
      ],
      connectsTo: ['Annotations', 'Library', 'Inquiries', 'Positions', 'Works', 'Practices', 'Evolution'],
      importantActions: ['Create concept', 'Edit definition', 'Open linked items', 'Generate description suggestion'],
    },
    {
      id: 'inquiries',
      label: 'Inquiries',
      viewId: 'questions',
      section: 'Mind',
      definition: 'The workspace for open questions and developing answers.',
      whatYouDo: [
        'Open a question and work through an answer.',
        'Review related sources, concepts, positions, and works.',
        'Form a position from an inquiry when the question hardens into a claim.',
      ],
      connectsTo: ['Annotations', 'Library', 'Concepts', 'Positions', 'Works'],
      importantActions: ['Add inquiry', 'Investigate', 'Mark resolved', 'Form position from inquiry'],
    },
    {
      id: 'library',
      label: 'Library',
      viewId: 'library',
      section: 'Inputs',
      definition: 'The source-detail workspace for books, articles, papers, films, and other media.',
      whatYouDo: [
        'Add or edit a source.',
        'Capture pre- and post-consumption notes.',
        'Create annotations and tag concepts on a source.',
      ],
      connectsTo: ['Source Index', 'Annotations', 'Concepts', 'Inquiries', 'Positions'],
      importantActions: ['Add source', 'Edit source', 'Save capture', 'Distill position'],
    },
    {
      id: 'source-index',
      label: 'Source Index',
      viewId: 'source-index',
      section: 'Inputs',
      definition: 'The searchable catalog of every source in your account.',
      whatYouDo: [
        'Browse the full source library at once.',
        'Filter by media type, status, tags, and linked work.',
        'Jump into a source thread in Library.',
      ],
      connectsTo: ['Library', 'Annotations', 'Positions', 'Works', 'Practices'],
      importantActions: ['Search', 'Filter', 'Open source thread'],
    },
    {
      id: 'annotations',
      label: 'Annotations',
      viewId: 'annotations',
      section: 'Inputs',
      definition: 'The cross-source stream of highlights, thoughts, questions, and connections.',
      whatYouDo: [
        'Review annotations from all sources in one place.',
        'Edit or delete an annotation.',
        'Turn an annotation into an inquiry or position, or link it to an existing position.',
      ],
      connectsTo: ['Library', 'Concepts', 'Inquiries', 'Positions'],
      importantActions: ['Edit annotation', 'Support position', 'Challenge position', 'Form position', 'Open in query'],
    },
    {
      id: 'positions',
      label: 'Positions',
      viewId: 'vault',
      section: 'Outputs',
      definition: 'The place where current beliefs, principles, mental models, and worldview statements live.',
      whatYouDo: [
        'Review and refine your current positions.',
        'Track evidence for and against each position.',
        'Link positions to concepts, inquiries, works, and practices.',
      ],
      connectsTo: ['Concepts', 'Annotations', 'Inquiries', 'Works', 'Practices', 'Evolution'],
      importantActions: ['Create position', 'Edit position', 'Resolve tensions', 'Ask AI', 'Create links'],
    },
    {
      id: 'works',
      label: 'Works',
      viewId: 'writing',
      section: 'Outputs',
      definition: 'The studio for longer writing, notes, drawings, recordings, and external-doc linked drafts.',
      whatYouDo: [
        'Open a writing workspace from the Add Work launcher.',
        'Draft in different work modes and paper styles.',
        'Connect an external document and sync readable text back into Noesis.',
      ],
      connectsTo: ['Concepts', 'Inquiries', 'Positions', 'Practices'],
      importantActions: ['Add Work', 'Save draft', 'Export', 'Connect Doc', 'Sync external doc'],
    },
    {
      id: 'practices',
      label: 'Practices',
      viewId: 'practices',
      section: 'Outputs',
      definition: 'The place where ideas become tests, commitments, habits, and experiments.',
      whatYouDo: [
        'Create a practice tied to a concept, position, inquiry, source, or work.',
        'Track notes and streak-like log dates over time.',
        'Use practices to test positions in lived experience.',
      ],
      connectsTo: ['Concepts', 'Library', 'Inquiries', 'Positions', 'Works', 'Evolution'],
      importantActions: ['Add practice', 'Edit practice', 'Log progress', 'Link to position'],
    },
    {
      id: 'evolution',
      label: 'Evolution',
      viewId: 'evolution',
      section: 'Outputs',
      definition: 'The timeline of meaningful changes across your Noesis system.',
      whatYouDo: [
        'Review created, refined, challenged, revised, and abandoned events.',
        'Use the timeline to see how ideas and positions changed over time.',
      ],
      connectsTo: ['Concepts', 'Positions', 'Works', 'Practices', 'Library'],
      importantActions: ['Review timeline', 'Open related entity'],
    },
    {
      id: 'profile',
      label: 'Profile',
      viewId: 'profile',
      section: 'Self',
      definition: 'The reflective self layer showing who the user is becoming intellectually.',
      whatYouDo: [
        'Edit identity, focus, themes, and learning season.',
        'Review intellectual identity, belief biography, unknowns, and thinking patterns.',
        'Prepare a future public philosophy view without exposing anything by default.',
      ],
      connectsTo: ['Concepts', 'Inquiries', 'Positions', 'Works', 'Practices', 'Evolution'],
      importantActions: ['Save profile', 'Open linked objects', 'Review unknowns', 'Adjust public view'],
    },
    {
      id: 'goals',
      label: 'Goals',
      viewId: 'goals',
      section: 'Self',
      definition: 'The progress planner for source-based targets grouped by goal categories.',
      whatYouDo: [
        'Name a goal set.',
        'Create goal categories and decide which media types count toward them.',
        'Set targets and monitor completed versus target progress.',
      ],
      connectsTo: ['Library', 'Source Index', 'Settings'],
      importantActions: ['Add Goal Category', 'Edit target', 'Reorder categories', 'Save goals'],
    },
    {
      id: 'settings',
      label: 'Settings',
      viewId: 'settings',
      section: 'System',
      definition: 'The control surface for account behavior, appearance, defaults, privacy, AI, and system preferences.',
      whatYouDo: [
        'Manage account access, appearance, and workspace defaults.',
        'Control AI, metacognition, privacy, and export behavior.',
        'Tune source intake, works, Atlas, notifications, and developer review settings.',
      ],
      connectsTo: ['Profile', 'Goals', 'Works', 'Atlas'],
      importantActions: ['Save section', 'Export data', 'Reset password'],
    },
  ] satisfies GuideSection[],
  objects: [
    {
      id: 'media',
      label: 'Source',
      collection: READEX_COLLECTIONS.media,
      definition: 'A saved book, article, paper, film, course, conversation, or other input item.',
      appearsIn: ['Library', 'Source Index'],
      createdBy: ['Library add/edit source dialog'],
      connectsTo: ['Annotations', 'Concepts via tags', 'Inquiries via sourceIds', 'Positions via sourceIds', 'Works via sourceIds'],
    },
    {
      id: 'annotation',
      label: 'Annotation',
      definition: 'A highlight, thought, question, or connection attached to a source.',
      appearsIn: ['Library', 'Annotations'],
      createdBy: ['Source detail annotation capture'],
      connectsTo: ['Positions via createdPositionId or linkedPositionIds', 'Inquiries via createdInquiryId', 'Concepts via conceptTags'],
    },
    {
      id: 'concept',
      label: 'Concept',
      collection: READEX_COLLECTIONS.concepts,
      definition: 'A named idea used to organize related sources, questions, positions, works, and practices.',
      appearsIn: ['Atlas', 'Concepts'],
      createdBy: ['Concept creation flow', 'Tag creation in pickers', 'Fallback term creation'],
      connectsTo: ['Sources', 'Annotations', 'Inquiries', 'Positions', 'Works', 'Practices', 'Atlas maps'],
    },
    {
      id: 'question',
      label: 'Inquiry',
      collection: READEX_COLLECTIONS.questions,
      definition: 'A user-created or annotation-derived question with evidence and an evolving answer.',
      appearsIn: ['Inquiries'],
      createdBy: ['Add Inquiry', 'Annotation -> Open in Query'],
      connectsTo: ['Sources via sourceIds', 'Concepts via conceptIds', 'Positions via beliefIds', 'Works via draftIds'],
    },
    {
      id: 'vault',
      label: 'Position',
      collection: READEX_COLLECTIONS.vault,
      definition: 'A belief, principle, mental model, life rule, or worldview statement.',
      appearsIn: ['Positions'],
      createdBy: ['Manual position creation', 'Idea formation', 'Annotation -> Form Position', 'Inquiry -> Form Position'],
      connectsTo: ['Sources via sourceIds', 'Annotations via sourceAnnotationId and typed links', 'Works via beliefIds', 'Practices via positionIds'],
    },
    {
      id: 'draft',
      label: 'Work',
      collection: READEX_COLLECTIONS.drafts,
      definition: 'A writing, note, drawing, recording, or other work artifact in progress.',
      appearsIn: ['Works'],
      createdBy: ['Add Work launcher'],
      connectsTo: ['Concepts via conceptTags', 'Sources via sourceIds', 'Inquiries via questionIds', 'Positions via beliefIds', 'External docs via externalDoc'],
    },
    {
      id: 'practice',
      label: 'Practice',
      collection: READEX_COLLECTIONS.practices,
      definition: 'A test, commitment, habit, rule, or experiment connected to your thinking.',
      appearsIn: ['Practices'],
      createdBy: ['Practice editor'],
      connectsTo: ['Concepts via conceptTags', 'Sources via sourceIds', 'Inquiries via questionIds', 'Positions via positionIds', 'Works via draftIds'],
    },
    {
      id: 'event',
      label: 'Evolution Event',
      collection: READEX_COLLECTIONS.timeline,
      definition: 'A recorded moment of creation or change in the system.',
      appearsIn: ['Evolution'],
      createdBy: ['System timeline events when major entities are created or updated'],
      connectsTo: ['Sources', 'Positions', 'Concepts', 'Inquiries', 'Works', 'Practices'],
    },
    {
      id: 'goal-set',
      label: 'Goal Set',
      collection: `${READEX_COLLECTIONS.settings}/${READEX_SETTINGS_DOCS.goal}`,
      definition: 'The named plan for your current progress targets.',
      appearsIn: ['Goals', 'Sidebar goals card'],
      createdBy: ['Goals page save flow'],
      connectsTo: ['Goal Categories', 'Source progress counts'],
    },
  ] satisfies GuideObject[],
  relationshipFields: [
    'tags',
    'annotations',
    'sourceIds',
    'conceptIds',
    'beliefIds',
    'questionIds',
    'draftIds',
    'positionIds',
    'createdPositionId',
    'createdInquiryId',
    'linkedPositionIds',
    'sourceAnnotationId',
    'externalDoc',
    'manualLinks',
  ],
  workflows: [
    {
      id: 'create-work',
      label: 'Create a Work',
      steps: [
        'Start in Works.',
        'Click Add Work.',
        'Choose Writing, Recording, Notes, or Quick Text.',
        'Noesis opens the matching workspace immediately.',
        'You can reopen it later in Works.',
      ],
    },
    {
      id: 'annotation-to-inquiry',
      label: 'Turn an Annotation into an Inquiry',
      steps: [
        'Start in Annotations.',
        'Open the What does this affect? panel on an annotation.',
        'Choose Open in Query.',
        'Review the preflight text, then confirm.',
        'The created inquiry opens in Inquiries and the annotation remembers that link.',
      ],
    },
    {
      id: 'annotation-to-position',
      label: 'Turn an Annotation into a Position',
      steps: [
        'Start in Annotations.',
        'Choose Form Position from the action panel.',
        'Review the preflight text and confirm.',
        'Noesis creates a position and stores the annotation as its source annotation.',
        'You can reopen it later from Positions or from the annotation itself.',
      ],
    },
    {
      id: 'link-annotation',
      label: 'Use an Annotation as Support or Challenge',
      steps: [
        'Start in Annotations.',
        'Choose Support Position or Challenge Position.',
        'Select an existing position.',
        'Noesis creates a typed link and records the relationship on the annotation.',
      ],
    },
    {
      id: 'manage-goals',
      label: 'Create or Edit Goals',
      steps: [
        'Open Goals from the sidebar goals card or the Goals shortcut.',
        'Set the Goal Set Name.',
        'Add a Goal Category and choose the Included Media Types.',
        'Set the target amount and save.',
        'The sidebar goals card updates from the same saved goal data.',
      ],
    },
  ] satisfies GuideWorkflow[],
  glossary: [
    ['Atlas Map', 'A saved map layout with node positions, manual links, and auto-link filters.'],
    ['Goal Category', 'A bucket such as Books or Articles that counts one or more media types.'],
    ['Included Media Types', 'The source formats that count toward a goal category.'],
    ['Insight', 'An internal idea record created when some idea flows create a mirrored position.'],
    ['Typed Link', 'A saved relationship such as supports, challenges, defines, refines, or tested_by.'],
    ['View ID', 'The internal sidebar view key, such as atlas, library, or vault, used by the single-page workspace.'],
  ] as Array<[string, string]>,
  commonFlowDiagram: [
    'Common flow in the current app',
    '',
    '[Library / Source Index]',
    '        |',
    '        v',
    '[Annotations] ---> [Inquiries]',
    '      |              |',
    '      v              v',
    '   [Positions] <--> [Works]',
    '      |               |',
    '      v               v',
    '   [Practices] --> [Evolution]',
    '',
    'Atlas reads across concepts, links, positions, works, inquiries, and practices.',
  ].join('\n'),
};
