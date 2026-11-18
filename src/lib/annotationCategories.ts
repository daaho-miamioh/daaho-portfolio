/** Kinds of annotation, shared by the collection, the transcript and the visitors' form. */
export const ANNOTATION_CATEGORIES = [
  { label: 'Context', value: 'context' },
  { label: 'Person', value: 'person' },
  { label: 'Place', value: 'place' },
  { label: 'Translation', value: 'translation' },
  { label: 'Correction', value: 'correction' },
  { label: 'Harmful language', value: 'harmful-language' },
  { label: 'Other', value: 'other' },
] as const
