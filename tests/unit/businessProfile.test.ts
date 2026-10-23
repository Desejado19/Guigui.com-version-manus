import { describe, expect, it } from 'vitest';
import {
  getBusinessProfileCompletion,
  type BusinessProfileRequiredField,
} from '../../src/utils/businessProfile';

const completeProfile = {
  name: 'Atelier Nô Pintcha',
  categoryId: 'services',
  subcategoryId: 'tailoring',
  description: 'Costura e reparação de roupas.',
  phone: '+245 955 123 456',
  neighborhood: 'Bissau Velho',
};

describe('business profile completion', () => {
  it.each([
    ['name', { name: '  ' }],
    ['categoryId', { categoryId: '' }],
    ['subcategoryId', { subcategoryId: ' ' }],
    ['description', { description: 'Costura e reparação de roupa.' }],
    ['phone', { phone: '' }],
    ['neighborhood', { neighborhood: '  ' }],
  ] as Array<[BusinessProfileRequiredField, Partial<typeof completeProfile>]>)(
    'marks a blank or insufficient %s as incomplete',
    (field, override) => {
      const result = getBusinessProfileCompletion({ ...completeProfile, ...override });

      expect(result.missingFields).toEqual([field]);
      expect(result.percentage).toBe(83);
    },
  );

  it('counts all six required fields as complete when each has a meaningful value', () => {
    expect(getBusinessProfileCompletion(completeProfile)).toEqual({
      percentage: 100,
      completedFields: ['name', 'categoryId', 'subcategoryId', 'description', 'phone', 'neighborhood'],
      missingFields: [],
    });
  });

  it('does not let optional not-applicable markers satisfy a missing required field', () => {
    const result = getBusinessProfileCompletion({
      ...completeProfile,
      phone: '',
      notApplicableFields: ['publicEmail'],
    });

    expect(result.missingFields).toEqual(['phone']);
    expect(result.percentage).toBe(83);
  });

  it('does not reduce completion for optional fields marked not applicable', () => {
    expect(getBusinessProfileCompletion({
      ...completeProfile,
      notApplicableFields: ['address', 'openingHours', 'publicEmail', 'whatsapp', 'website', 'socialLinks', 'serviceLanguages'],
    }).percentage).toBe(100);
  });
});
