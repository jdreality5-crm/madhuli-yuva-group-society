const DEFAULT_SOCIETY_ID = process.env.DEFAULT_SOCIETY_ID?.trim() || 'demo-society-v2';

export const appConfig = {
  societyId: DEFAULT_SOCIETY_ID,
} as const;
