import type { Business, BusinessProfileNotApplicableField } from '../types';

export type BusinessProfileRequiredField =
  | 'name'
  | 'categoryId'
  | 'subcategoryId'
  | 'description'
  | 'phone'
  | 'neighborhood';

export const BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH = 30;
export const BUSINESS_PROFILE_DESCRIPTION_MAX_LENGTH = 600;
/** Número de caracteres da descrição apresentados no cartão do negócio. */
export const BUSINESS_DESCRIPTION_CARD_LIMIT = 140;

export interface BusinessDescriptionPreview {
  preview: string;
  truncated: boolean;
}

/** Recorta a descrição para o cartão, sem cortar palavras a meio, e assinala se há mais texto. */
export function getBusinessDescriptionPreview(
  text: string | undefined,
  limit = BUSINESS_DESCRIPTION_CARD_LIMIT,
): BusinessDescriptionPreview {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return { preview: normalized, truncated: false };
  const slice = normalized.slice(0, limit);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return { preview: `${cut.trimEnd()}…`, truncated: true };
}

export type BusinessProfileCompletionInput = Partial<
  Pick<Business, 'name' | 'categoryId' | 'subcategoryId' | 'description' | 'phone' | 'neighborhood'>
> & {
  notApplicableFields?: BusinessProfileNotApplicableField[];
};

export interface BusinessProfileCompletion {
  percentage: number;
  completedFields: BusinessProfileRequiredField[];
  missingFields: BusinessProfileRequiredField[];
}

function preferPopulatedValue(storedValue: string | undefined, currentValue: string | undefined): string | undefined {
  if (storedValue?.trim()) return storedValue;
  if (currentValue?.trim()) return currentValue;
  return storedValue ?? currentValue;
}

export function mergeStoredBusinessProfile(
  current: Partial<Business>,
  stored: Partial<Business>,
): Partial<Business> {
  const merged = { ...current };
  for (const [field, value] of Object.entries(stored)) {
    if (typeof value !== 'undefined') {
      Object.assign(merged, { [field]: value });
    }
  }

  merged.name = preferPopulatedValue(stored.name, current.name);
  merged.categoryId = preferPopulatedValue(stored.categoryId, current.categoryId);
  merged.subcategoryId = preferPopulatedValue(stored.subcategoryId, current.subcategoryId);
  merged.description = preferPopulatedValue(stored.description, current.description);
  merged.phone = preferPopulatedValue(stored.phone, current.phone);
  merged.neighborhood = preferPopulatedValue(stored.neighborhood, current.neighborhood);
  merged.address = preferPopulatedValue(stored.address, current.address);
  merged.whatsapp = preferPopulatedValue(stored.whatsapp, current.whatsapp);
  merged.publicEmail = preferPopulatedValue(stored.publicEmail, current.publicEmail);
  merged.website = preferPopulatedValue(stored.website, current.website);
  merged.openingHours = preferPopulatedValue(stored.openingHours, current.openingHours);
  merged.logo = preferPopulatedValue(stored.logo, current.logo);
  merged.coverImage = preferPopulatedValue(stored.coverImage, current.coverImage);
  merged.email = undefined;

  return merged;
}

const requiredFields: BusinessProfileRequiredField[] = [
  'name',
  'categoryId',
  'subcategoryId',
  'description',
  'phone',
  'neighborhood',
];

function hasMeaningfulValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getBusinessProfileCompletion(
  profile: BusinessProfileCompletionInput,
): BusinessProfileCompletion {
  const completedFields = requiredFields.filter((field) => {
    const value = profile[field];
    if (field === 'description') {
      return (value?.trim().length ?? 0) >= BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH;
    }
    return hasMeaningfulValue(value);
  });
  const missingFields = requiredFields.filter((field) => !completedFields.includes(field));

  return {
    percentage: Math.round((completedFields.length / requiredFields.length) * 100),
    completedFields,
    missingFields,
  };
}
