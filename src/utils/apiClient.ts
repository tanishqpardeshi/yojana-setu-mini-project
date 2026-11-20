export interface ApiErrorInfo {
  status: number;
  error: string;
  details?: string;
  code?: string;
  portalUrl?: string;
  liveConfigured?: boolean;
  allowManualEntry?: boolean;
}

export class ApiRequestError extends Error {
  status: number;
  details?: string;
  code?: string;
  portalUrl?: string;
  liveConfigured?: boolean;
  allowManualEntry?: boolean;

  constructor(info: ApiErrorInfo) {
    super(info.error);
    this.name = 'ApiRequestError';
    this.status = info.status;
    this.details = info.details;
    this.code = info.code;
    this.portalUrl = info.portalUrl;
    this.liveConfigured = info.liveConfigured;
    this.allowManualEntry = info.allowManualEntry;
  }
}

export async function parseApiResponse<T = any>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T | null; errorInfo: ApiErrorInfo | null }> {
  let parsed: any = null;
  try {
    const rawText = await res.text();
    if (rawText && rawText.trim()) {
      parsed = JSON.parse(rawText);
    }
  } catch {
    parsed = null;
  }

  if (res.ok) {
    return { ok: true, status: res.status, data: parsed as T, errorInfo: null };
  }

  const fallbackByStatus =
    res.status === 409
      ? 'This record already exists and duplicates are not allowed.'
      : res.status === 429
      ? 'Too many requests. Please wait before trying again.'
      : res.status === 503
      ? 'Required external government or SMS gateway service is not configured.'
      : res.status === 401
      ? 'Authentication required. Please sign in and retry.'
      : res.status === 403
      ? 'You do not have permission to perform this action.'
      : res.status === 404
      ? 'Requested record was not found.'
      : res.status === 400
      ? 'Invalid request inputs. Please review highlighted fields.'
      : `Server request failed with HTTP ${res.status}.`;

  const errorMessage =
    (parsed && typeof parsed.error === 'string' && parsed.error.trim()) || fallbackByStatus;

  const errorInfo: ApiErrorInfo = {
    status: res.status,
    error: errorMessage,
    details: parsed && typeof parsed.details === 'string' ? parsed.details : undefined,
    code: parsed && typeof parsed.code === 'string' ? parsed.code : undefined,
    portalUrl: parsed && typeof parsed.portalUrl === 'string' ? parsed.portalUrl : undefined,
    liveConfigured:
      parsed && typeof parsed.liveConfigured === 'boolean' ? parsed.liveConfigured : undefined,
    allowManualEntry:
      parsed && typeof parsed.allowManualEntry === 'boolean' ? parsed.allowManualEntry : undefined,
  };

  return { ok: false, status: res.status, data: parsed as T | null, errorInfo };
}
