export const EXPERIENCE_OPTIONS = {
  primaryPurpose: [
    ['explore', 'Explore new ideas'], ['organize', 'Organize what I know'],
    ['challenge', 'Challenge my thinking'], ['develop_philosophy', 'Develop my own philosophy'],
    ['create_share', 'Create and share knowledge'],
  ],
  guidance: [['active', 'Active guide'], ['occasional', 'Occasional collaborator'], ['independent', 'Independent workspace']],
  activationSensitivity: [['early', 'Early discovery'], ['gradual', 'Gradual discovery'], ['deep', 'Deep discovery'], ['manual', 'Manual discovery']],
  challengeStyle: [['gentle', 'Gentle exploration'], ['thoughtful_questions', 'Thoughtful questioning'], ['rigorous', 'Rigorous examination'], ['dialectical', 'Dialectical debate']],
} as const;

type Dimension = keyof typeof EXPERIENCE_OPTIONS;
type Choice<K extends Dimension> = typeof EXPERIENCE_OPTIONS[K][number][0];

export type NoesisExperience = {
  [K in Dimension]: Choice<K>;
} & {
  schemaVersion: 1;
  onboardingCompleted: boolean;
  purposes: Choice<'primaryPurpose'>[];
};

export const DEFAULT_EXPERIENCE: NoesisExperience = {
  schemaVersion: 1,
  onboardingCompleted: false,
  primaryPurpose: 'develop_philosophy',
  purposes: ['develop_philosophy'],
  guidance: 'occasional',
  activationSensitivity: 'gradual',
  challengeStyle: 'thoughtful_questions',
};

function isChoice<K extends Dimension>(key: K, value: unknown): value is Choice<K> {
  return EXPERIENCE_OPTIONS[key].some(([id]) => id === value);
}

export function readExperience(raw: Partial<NoesisExperience> | null): NoesisExperience {
  if (raw?.schemaVersion !== 1) return DEFAULT_EXPERIENCE;
  const primaryPurpose = isChoice('primaryPurpose', raw.primaryPurpose) ? raw.primaryPurpose : DEFAULT_EXPERIENCE.primaryPurpose;
  return {
    ...DEFAULT_EXPERIENCE,
    onboardingCompleted: raw.onboardingCompleted === true,
    primaryPurpose,
    purposes: [...new Set([primaryPurpose, ...(Array.isArray(raw.purposes) ? raw.purposes.filter(value => isChoice('primaryPurpose', value)) : [])])],
    guidance: isChoice('guidance', raw.guidance) ? raw.guidance : DEFAULT_EXPERIENCE.guidance,
    activationSensitivity: isChoice('activationSensitivity', raw.activationSensitivity) ? raw.activationSensitivity : DEFAULT_EXPERIENCE.activationSensitivity,
    challengeStyle: isChoice('challengeStyle', raw.challengeStyle) ? raw.challengeStyle : DEFAULT_EXPERIENCE.challengeStyle,
  };
}

/** Offer automatic setup only during the account's initial sign-in window. */
export function isInitialSignIn(created?: string, signedIn?: string, now = Date.now()) {
  const creation = Date.parse(created || ''), login = Date.parse(signedIn || '');
  return Math.abs(login - creation) < 60_000 && now >= creation && now - creation < 15 * 60_000;
}
