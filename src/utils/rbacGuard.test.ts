import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_DASHBOARD_ROUTE,
  ADMIN_LOGIN_ROUTE,
  CITIZEN_DEFAULT_ROUTE,
  evaluateRouteAccess,
  isAdminLoginPath,
  isAdminProtectedPath,
  mapCitizenTabToPathname,
  mapPathnameToCitizenTab,
  normalizePathname,
} from './rbacGuard';

test('normalizePathname and admin path matchers handle trailing slashes and queries', () => {
  assert.equal(normalizePathname('/admin/'), '/admin');
  assert.equal(normalizePathname('/admin/login?next=1'), '/admin/login');
  assert.equal(isAdminLoginPath('/admin/login/'), true);
  assert.equal(isAdminProtectedPath('/admin/login'), false);
  assert.equal(isAdminProtectedPath('/admin'), true);
  assert.equal(isAdminProtectedPath('/admin/dashboard'), true);
  assert.equal(isAdminProtectedPath('/'), false);
});

test('unauthenticated user attempting /admin or /admin/dashboard is blocked and redirected to /admin/login', () => {
  const res1 = evaluateRouteAccess('/admin', {
    authInitialized: true,
    isAuthenticated: false,
    portalScope: null,
    verifiedAdminRole: false,
  });
  assert.equal(res1.allowed, false);
  assert.equal(res1.redirectTo, ADMIN_LOGIN_ROUTE);
  assert.equal(res1.reason, 'unauthenticated_admin');

  const res2 = evaluateRouteAccess('/admin/schemes', {
    authInitialized: true,
    isAuthenticated: false,
    portalScope: null,
    verifiedAdminRole: false,
  });
  assert.equal(res2.allowed, false);
  assert.equal(res2.redirectTo, ADMIN_LOGIN_ROUTE);
});

test('authenticated Citizen attempting /admin is strictly blocked and redirected to Citizen Portal', () => {
  const res = evaluateRouteAccess('/admin', {
    authInitialized: true,
    isAuthenticated: true,
    portalScope: 'citizen',
    verifiedAdminRole: false,
  });
  assert.equal(res.allowed, false);
  assert.equal(res.redirectTo, CITIZEN_DEFAULT_ROUTE);
  assert.equal(res.reason, 'citizen_forbidden_admin');
});

test('session isolation: user with admin role signed in through Citizen scope cannot open /admin directly without admin portal login', () => {
  const res = evaluateRouteAccess('/admin', {
    authInitialized: true,
    isAuthenticated: true,
    portalScope: 'citizen',
    verifiedAdminRole: true,
  });
  assert.equal(res.allowed, false);
  assert.equal(res.redirectTo, CITIZEN_DEFAULT_ROUTE);
  assert.equal(res.reason, 'citizen_forbidden_admin');
});

test('server-verified Admin in admin portal scope is allowed on /admin and redirected from /admin/login', () => {
  const dashRes = evaluateRouteAccess('/admin', {
    authInitialized: true,
    isAuthenticated: true,
    portalScope: 'admin',
    verifiedAdminRole: true,
  });
  assert.equal(dashRes.allowed, true);
  assert.equal(dashRes.redirectTo, null);

  const loginRes = evaluateRouteAccess('/admin/login', {
    authInitialized: true,
    isAuthenticated: true,
    portalScope: 'admin',
    verifiedAdminRole: true,
  });
  assert.equal(loginRes.allowed, false);
  assert.equal(loginRes.redirectTo, ADMIN_DASHBOARD_ROUTE);
  assert.equal(loginRes.reason, 'already_authenticated_admin');
});

test('citizen tab mapping never maps to admin', () => {
  assert.equal(mapPathnameToCitizenTab('/'), 'schemes');
  assert.equal(mapPathnameToCitizenTab('/login'), 'auth');
  assert.equal(mapPathnameToCitizenTab('/samagra'), 'samagra');
  assert.equal(mapPathnameToCitizenTab('/digilocker'), 'digilocker');
  assert.equal(mapPathnameToCitizenTab('/tracker'), 'tracker');
  assert.equal(mapPathnameToCitizenTab('/admin'), 'schemes');
  assert.equal(mapCitizenTabToPathname('auth'), '/login');
  assert.equal(mapCitizenTabToPathname('admin'), '/');
});
