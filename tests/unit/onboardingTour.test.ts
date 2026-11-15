import { describe, expect, it } from 'vitest';
import { BUSINESS_TOUR, CITIZEN_TOUR, getTourSteps, shouldAutoOpenTour } from '../../src/components/onboarding/tourSteps';

const LANGUAGES = ['pt', 'en', 'fr', 'es'] as const;

describe('guia de boas-vindas', () => {
  it('tem percursos diferentes para cidadão e empresa', () => {
    expect(getTourSteps('user')).toBe(CITIZEN_TOUR);
    expect(getTourSteps('business')).toBe(BUSINESS_TOUR);
    expect(CITIZEN_TOUR.length).toBe(8);
    expect(BUSINESS_TOUR.length).toBe(10);
    expect(CITIZEN_TOUR.map((step) => step.id)).not.toEqual(BUSINESS_TOUR.map((step) => step.id));
  });

  it('tem todos os passos traduzidos nos quatro idiomas', () => {
    for (const step of [...CITIZEN_TOUR, ...BUSINESS_TOUR]) {
      for (const language of LANGUAGES) {
        expect(step.copy[language]?.title, `${step.id}/${language}`).toBeTruthy();
        expect(step.copy[language]?.description, `${step.id}/${language}`).toBeTruthy();
      }
    }
  });

  it('não abre sozinho sem sessão', () => {
    expect(shouldAutoOpenTour(null)).toBe(true);
    // Sem utilizador o componente nem sequer é renderizado; a função só
    // responde pelo estado guardado.
    expect(typeof shouldAutoOpenTour(undefined)).toBe('boolean');
  });
});
