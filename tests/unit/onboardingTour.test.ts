import { describe, expect, it } from 'vitest';
import {
  ADMIN_TOUR,
  BUSINESS_TOUR,
  CITIZEN_TOUR,
  getTeamTourSteps,
  getTourSteps,
} from '../../src/components/onboarding/tourSteps';

const LANGUAGES = ['pt', 'en', 'fr', 'es'] as const;

describe('guia de boas-vindas por tipo de conta', () => {
  it('dá percursos distintos a cidadão, empresa e administração', () => {
    expect(getTourSteps('user')).toBe(CITIZEN_TOUR);
    expect(getTourSteps('business')).toBe(BUSINESS_TOUR);
    expect(getTourSteps('admin')).toBe(ADMIN_TOUR);
    expect(CITIZEN_TOUR.length).toBeGreaterThan(4);
    expect(BUSINESS_TOUR.length).toBeGreaterThan(4);
    expect(ADMIN_TOUR.length).toBeGreaterThan(4);
  });

  it('tem todos os passos traduzidos nos quatro idiomas', () => {
    const steps = [...CITIZEN_TOUR, ...BUSINESS_TOUR, ...ADMIN_TOUR, ...getTeamTourSteps({})];
    for (const step of steps) {
      for (const language of LANGUAGES) {
        expect(step.copy[language]?.title, `${step.id}/${language}`).toBeTruthy();
        expect(step.copy[language]?.description, `${step.id}/${language}`).toBeTruthy();
      }
    }
  });

  it('constrói o guia do colaborador apenas com os módulos atribuídos', () => {
    const steps = getTourSteps('business', {
      teamRole: 'finance',
      teamAccess: { overview: ['view'], tickets: ['view'], clients: ['view'] },
    });
    const ids = steps.map((step) => step.id);
    expect(ids).toContain('tickets');
    expect(ids).toContain('clients');
    expect(ids).not.toContain('events');
    expect(ids).not.toContain('content');
    expect(ids[ids.length - 1]).toBe('security');
  });

  it('sem módulos atribuídos o guia do colaborador mantém apenas o essencial', () => {
    expect(getTeamTourSteps({}).map((step) => step.id)).toEqual(['overview', 'security']);
    expect(getTeamTourSteps(null).map((step) => step.id)).toEqual(['overview', 'security']);
    expect(getTeamTourSteps(undefined).map((step) => step.id)).toEqual(['overview', 'security']);
    // O mesmo quando o guia é pedido sem `teamAccess` (permissões desconhecidas).
    expect(getTourSteps('business', { teamRole: 'editor' }).map((step) => step.id)).toEqual(['overview', 'security']);
  });

  it('não trata um membro de equipa como dono da empresa', () => {
    const ownerSteps = getTourSteps('business', { teamRole: null });
    const memberSteps = getTourSteps('business', { teamRole: 'editor', teamAccess: { overview: ['view'] } });
    expect(ownerSteps).toBe(BUSINESS_TOUR);
    expect(memberSteps).not.toBe(BUSINESS_TOUR);
  });
});
