/** The only sort orders of the application list (a controlled list, never a free column name). */
export const APPLICATION_SORT_VALUES = ['appliedAt_desc', 'appliedAt_asc'] as const;

export type ApplicationSort = (typeof APPLICATION_SORT_VALUES)[number];

export const DEFAULT_APPLICATION_SORT: ApplicationSort = 'appliedAt_desc';
