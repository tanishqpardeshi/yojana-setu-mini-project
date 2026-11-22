export const CITIZEN_DEFAULT_ROUTE = '/';
export const CITIZEN_LOGIN_ROUTE = '/login';
export const ADMIN_LOGIN_ROUTE = '/admin/login';
export const ADMIN_DASHBOARD_ROUTE = '/admin';

export type PortalScope = 'citizen' | 'admin';

export interface RouteAuthSnapshot {
  authInitialized: boolean;
  isAuthenticated: boolean;
  portalScope: PortalScope | null;
  verifiedAdminRole: boolean;
}

export interface RouteGuardDecision {
  allowed: boolean;
  redirectTo: string | null;
  reason: 'ok' | 'loading' | 'unauthenticated_admin' | 'citizen_forbidden_admin' | 'already_authenticated_admin';
  bannerMessage?: string;
}

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const cleaned = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return cleaned === '' ? '/' : cleaned;
}

export function isAdminLoginPath(pathname: string): boolean {
  const norm = normalizePathname(pathname);
  return norm === '/admin/login';
}

export function isAdminProtectedPath(pathname: string): boolean {
  const norm = normalizePathname(pathname);
  if (norm === '/admin/login') return false;
  return norm === '/admin' || norm.startsWith('/admin/');
}

export function isAnyAdminPath(pathname: string): boolean {
  const norm = normalizePathname(pathname);
  return norm === '/admin' || norm.startsWith('/admin/');
}

export function mapPathnameToCitizenTab(pathname: string): string {
  const norm = normalizePathname(pathname);
  switch (norm) {
    case '/governance':
      return 'governance';
    case '/samagra':
      return 'samagra';
    case '/digilocker':
      return 'digilocker';
    case '/tracker':
      return 'tracker';
    case '/login':
    case '/signup':
    case '/auth':
      return 'auth';
    default:
      return 'schemes';
  }
}

export function mapCitizenTabToPathname(tab: string): string {
  switch (tab) {
    case 'governance':
      return '/governance';
    case 'samagra':
      return '/samagra';
    case 'digilocker':
      return '/digilocker';
    case 'tracker':
      return '/tracker';
    case 'auth':
      return '/login';
    default:
      return '/';
  }
}

/**
 * Pure frontend Route Guard enforcing strict Citizen vs Admin RBAC and session isolation.
 * - Unauthenticated users accessing /admin/* are redirected to /admin/login.
 * - Authenticated Citizens (or unverified admin claims) accessing /admin/* are blocked and redirected to /.
 * - Authenticated verified Admins on /admin/login are redirected to /admin.
 * - Citizen Portal routes never grant Admin access.
 */
export function evaluateRouteAccess(
  pathname: string,
  auth: RouteAuthSnapshot
): RouteGuardDecision {
  const norm = normalizePathname(pathname);

  if (isAdminProtectedPath(norm)) {
    if (!auth.authInitialized) {
      return { allowed: false, redirectTo: null, reason: 'loading' };
    }
    if (!auth.isAuthenticated) {
      return {
        allowed: false,
        redirectTo: ADMIN_LOGIN_ROUTE,
        reason: 'unauthenticated_admin',
        bannerMessage: 'Administrator authentication is required to access the District Admin Console.',
      };
    }
    if (!auth.verifiedAdminRole || auth.portalScope !== 'admin') {
      return {
        allowed: false,
        redirectTo: CITIZEN_DEFAULT_ROUTE,
        reason: 'citizen_forbidden_admin',
        bannerMessage: 'Access Denied: Administrator privileges verified via /admin/login are required.',
      };
    }
    return { allowed: true, redirectTo: null, reason: 'ok' };
  }

  if (isAdminLoginPath(norm)) {
    if (!auth.authInitialized) {
      return { allowed: true, redirectTo: null, reason: 'loading' };
    }
    if (auth.isAuthenticated && auth.verifiedAdminRole && auth.portalScope === 'admin') {
      return {
        allowed: false,
        redirectTo: ADMIN_DASHBOARD_ROUTE,
        reason: 'already_authenticated_admin',
      };
    }
    return { allowed: true, redirectTo: null, reason: 'ok' };
  }

  return { allowed: true, redirectTo: null, reason: 'ok' };
}
