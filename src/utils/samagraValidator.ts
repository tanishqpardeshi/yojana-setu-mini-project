export const SAMAGRA_PORTAL_URL = 'https://samagra.gov.in/';

export interface SamagraValidationResult {
  valid: boolean;
  cleaned: string;
  kind: 'family' | 'member' | null;
  error?: string;
}

export function validateSamagraFamilyId(raw: string): SamagraValidationResult {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      kind: null,
      error: 'Samagra Family ID is required (must be exactly 8 numeric digits).',
    };
  }
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      kind: null,
      error: 'Samagra Family ID must contain numeric digits only (0–9), no spaces or letters.',
    };
  }
  if (cleaned.length !== 8) {
    return {
      valid: false,
      cleaned,
      kind: null,
      error: `Samagra Family ID must be exactly 8 digits (entered ${cleaned.length} digit${cleaned.length === 1 ? '' : 's'}).`,
    };
  }
  return { valid: true, cleaned, kind: 'family' };
}

export function validateSamagraMemberId(raw: string): SamagraValidationResult {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      kind: null,
      error: 'Samagra Member ID is required (must be exactly 9 numeric digits).',
    };
  }
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      kind: null,
      error: 'Samagra Member ID must contain numeric digits only (0–9), no spaces or letters.',
    };
  }
  if (cleaned.length !== 9) {
    return {
      valid: false,
      cleaned,
      kind: null,
      error: `Samagra Member ID must be exactly 9 digits (entered ${cleaned.length} digit${cleaned.length === 1 ? '' : 's'}).`,
    };
  }
  return { valid: true, cleaned, kind: 'member' };
}

export function validateSamagraLookupId(raw: string): SamagraValidationResult {
  const cleaned = String(raw ?? '').trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      kind: null,
      error: 'Enter an 8-digit Samagra Family ID or 9-digit Samagra Member ID.',
    };
  }
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      kind: null,
      error: 'Invalid Samagra ID format: only numeric digits (0–9) are allowed.',
    };
  }
  if (cleaned.length === 8) {
    return { valid: true, cleaned, kind: 'family' };
  }
  if (cleaned.length === 9) {
    return { valid: true, cleaned, kind: 'member' };
  }
  return {
    valid: false,
    cleaned,
    kind: null,
    error: `Invalid Samagra ID length (${cleaned.length} digits). Enter an 8-digit Family ID or a 9-digit Member ID.`,
  };
}

export interface MobileValidationResult {
  valid: boolean;
  cleaned: string; // 10-digit local number (starts with 6-9)
  e164: string; // +91XXXXXXXXXX
  error?: string;
}

export function validateIndianMobile(raw: string): MobileValidationResult {
  const compact = String(raw ?? '').trim().replace(/[\s\-()]/g, '');
  if (!compact) {
    return {
      valid: false,
      cleaned: '',
      e164: '',
      error: 'Indian mobile number (+91 followed by 10 digits) is required.',
    };
  }

  let tenDigits = compact;
  if (compact.startsWith('+91')) {
    tenDigits = compact.slice(3);
  } else if (compact.startsWith('91') && compact.length === 12) {
    tenDigits = compact.slice(2);
  } else if (compact.startsWith('0') && compact.length === 11) {
    tenDigits = compact.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    return {
      valid: false,
      cleaned: tenDigits,
      e164: '',
      error: 'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6–9).',
    };
  }

  return {
    valid: true,
    cleaned: tenDigits,
    e164: `+91${tenDigits}`,
  };
}
