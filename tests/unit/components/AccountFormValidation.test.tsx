// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  window.localStorage.clear();
});

describe('Account Data Form Validation', () => {
  // Test functions extracted from ClientSettingsHub.tsx validation logic
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

  function validateFullName(name: string): boolean {
    if (!name.trim()) return false;
    if (name.trim().length < 2) return false;
    return true;
  }

  function validateEmail(email: string): boolean {
    if (!email.trim()) return false;
    if (!emailRegex.test(email)) return false;
    return true;
  }

  function validatePhone(phone: string): boolean {
    if (!phone.trim()) return false;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) return false;
    return true;
  }

  function validateDateOfBirth(dob: string): boolean {
    if (!dob.trim()) return false;
    const date = new Date(dob);
    if (isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDate = new Date(dob);
    inputDate.setHours(0, 0, 0, 0);
    if (inputDate >= today) return false;
    return true;
  }

  function validateAccountType(type: string): boolean {
    if (!type) return false;
    return true;
  };

  describe('validateFullName', () => {
    it('returns false for empty string', () => {
      expect(validateFullName('')).toBe(false);
    });

    it('returns false for single character', () => {
      expect(validateFullName('A')).toBe(false);
    });

    it('returns true for 2+ characters', () => {
      expect(validateFullName('João')).toBe(true);
    });

    it('returns true for name with spaces', () => {
      expect(validateFullName('Maria Silva')).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('returns false for empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('returns false for invalid format', () => {
      expect(validateEmail('invalid-email')).toBe(false);
    });

    it('returns true for valid email', () => {
      expect(validateEmail('teste@exemplo.com')).toBe(true);
    });

    it('returns true for email with subdomain', () => {
      expect(validateEmail('user@sub.dominio.com')).toBe(true);
    });

    it('returns true for email with +', () => {
      expect(validateEmail('user+tag@gmail.com')).toBe(true);
    });

    it('returns true for email with dots', () => {
      expect(validateEmail('first.last@domain.com')).toBe(true);
    });
  });

  describe('validatePhone', () => {
    it('returns false for empty string', () => {
      expect(validatePhone('')).toBe(false);
    });

    it('returns false for invalid format', () => {
      expect(validatePhone('invalid')).toBe(false);
    });

    it('returns true for US format (123) 456-7890', () => {
      expect(validatePhone('(123) 456-7890')).toBe(true);
    });

    it('returns true for international +1 123 456 7890', () => {
      expect(validatePhone('+1 123 456 7890')).toBe(true);
    });

    it('returns true for dashes 123-456-7890', () => {
      expect(validatePhone('123-456-7890')).toBe(true);
    });

    it('returns true for spaces 123 456 7890', () => {
      expect(validatePhone('123 456 7890')).toBe(true);
    });
  });

  describe('validateDateOfBirth', () => {
    it('returns false for empty string', () => {
      expect(validateDateOfBirth('')).toBe(false);
    });

    it('returns false for invalid date', () => {
      expect(validateDateOfBirth('not-a-date')).toBe(false);
    });

    it('returns false for future date', () => {
      expect(validateDateOfBirth('2030-01-01')).toBe(false);
    });

    it('returns true for valid past date', () => {
      expect(validateDateOfBirth('1990-05-15')).toBe(true);
    });

    it('returns false for today', () => {
      expect(validateDateOfBirth(new Date().toISOString().split('T')[0])).toBe(false);
    });
  });

  describe('validateAccountType', () => {
    it('returns false for empty string', () => {
      expect(validateAccountType('')).toBe(false);
    });

    it('returns true for valid type', () => {
      expect(validateAccountType('active')).toBe(true);
    });

    it('returns true for business type', () => {
      expect(validateAccountType('business')).toBe(true);
    });
  });
});
