import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, ShieldCheck, ShieldAlert, LogOut, Loader2, Lock, Filter, RotateCcw } from 'lucide-react';
import {
  SupportedLanguage,
  CitizenAccountProfile,
  CitizenProfile,
  Scheme,
  ApplicationRecord,
  LiveNotification,
  FamilyMember,
  SamagraFamily,
  GovernanceLevel,
  JanpadBlock,
  DistrictStats,
  DigiLockerCredentialRecord,
  DigiLockerDocumentRecord,
  SchemesRealtimeReport,
  VerifiedDocumentMeta,
} from './types';
import { searchSchemes } from './utils/searchEngine';
import { evaluateSchemeEligibility, rankSchemesForCitizen } from './utils/rulesEngine';
import { createEmptyCitizenProfile, evaluateSchemesRealtimeStatus } from './utils/liveDataEngine';
import {
  getCategoryLabel,
  getGenderLabel,
  getOccupationLabel,
  pickText,
} from './utils/i18n';
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
  PortalScope,
} from './utils/rbacGuard';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { EligibilityCalculator } from './components/EligibilityCalculator';
import { GovernanceLevelsView } from './components/GovernanceLevelsView';
import { SamagraFamilyView } from './components/SamagraFamilyView';
import { DigiLockerTrackerView } from './components/DigiLockerTrackerView';
import { ApplicationTrackerView } from './components/ApplicationTrackerView';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginPage } from './components/AdminLoginPage';
import { ApplicationIntakeModal } from './components/ApplicationIntakeModal';
import { CitizenEntitlementCardModal } from './components/CitizenEntitlementCardModal';
import { SchemeComparisonModal } from './components/SchemeComparisonModal';
import { SavedSchemesModal } from './components/SavedSchemesModal';
import { AuthPage } from './components/AuthPage';
import { ToastContainer, ToastItem } from './components/ToastContainer';
import { ApiRequestError, parseApiResponse } from './utils/apiClient';
import {
  AdminAuthResult,
  AdminSessionInfo,
  auth,
  AuthResult,
  fetchUserProfileFromFirestore,
  getAuthBearerHeader,
  handleFirestoreError,
  logOutUser,
  mapUserProfileToCitizenProfile,
  OperationType,
  removeSavedSchemeFromUserFirestore,
  saveApplicationToFirestore,
  saveSchemeToUserFirestore,
  updateCitizenProfileInFirestore,
  UserProfileDoc,
  verifyAdminSessionWithServer,
  db,
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

const ACTIVE_SAMAGRA_STORAGE_KEY = 'yojanasetu_live_samagra_session';
const CITIZEN_TOKEN_STORAGE_KEY = 'yojanasetu_citizen_token';
const PORTAL_SCOPE_STORAGE_KEY = 'yojanasetu_portal_scope';
const MY_ARNS_STORAGE_KEY = 'yojanasetu_my_arns';

function readCitizenToken(): string | null {
  try {
    const val = localStorage.getItem(CITIZEN_TOKEN_STORAGE_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

function writeCitizenToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(CITIZEN_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(CITIZEN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function readPortalScope(): PortalScope | null {
  try {
    const val = sessionStorage.getItem(PORTAL_SCOPE_STORAGE_KEY);
    return val === 'admin' || val === 'citizen' ? val : null;
  } catch {
    return null;
  }
}

function writePortalScope(scope: PortalScope | null) {
  try {
    if (scope) {
      sessionStorage.setItem(PORTAL_SCOPE_STORAGE_KEY, scope);
    } else {
      sessionStorage.removeItem(PORTAL_SCOPE_STORAGE_KEY);
    }
  } catch {
    // ignore sessionStorage errors
  }
}

function readMyArns(): string[] {
  try {
    const raw = localStorage.getItem(MY_ARNS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((arn): arn is string => typeof arn === 'string' && arn.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function rememberMyArn(arn: string) {
  try {
    const clean = arn.trim();
    if (!clean) return;
    const updated = Array.from(new Set([clean, ...readMyArns()])).slice(0, 25);
    localStorage.setItem(MY_ARNS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

function mapDigiLockerRecordsToProfileMap(
  docs: DigiLockerDocumentRecord[],
  creds: DigiLockerCredentialRecord[] = []
): Record<string, VerifiedDocumentMeta> {
  const map: Record<string, VerifiedDocumentMeta> = {};
  for (const c of creds) {
    if (c.docId) {
      map[c.docId] = {
        verified: true,
        source: 'digilocker',
        docNumber: c.docNumber || c.docUri,
        issuer: c.issuer,
        verifiedAt: c.verifiedAt,
      };
    }
  }
  for (const d of docs) {
    map[d.docId] = {
      verified: Boolean(d.verified),
      source: d.source,
      docNumber: d.docNumber,
      issuer: d.issuer,
      verifiedAt: d.verifiedAt,
    };
  }
  return map;
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => normalizePathname(window.location.pathname));
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [isEntitlementCardOpen, setIsEntitlementCardOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonInitialId, setComparisonInitialId] = useState<string | undefined>(undefined);

  // Strict separated Citizen vs Admin auth state
  const [authInitialized, setAuthInitialized] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [citizenAuthToken, setCitizenAuthToken] = useState<string | null>(() => readCitizenToken());
  const [citizenAccountUser, setCitizenAccountUser] = useState<CitizenAccountProfile | null>(null);
  const [portalScope, setPortalScope] = useState<PortalScope | null>(() => readPortalScope());
  const [adminSession, setAdminSession] = useState<AdminSessionInfo | null>(null);
  const [userProfileDoc, setUserProfileDoc] = useState<UserProfileDoc | null>(null);

  const [authBannerMessage, setAuthBannerMessage] = useState<string | null>(null);
  const [adminRedirectNotice, setAdminRedirectNotice] = useState<string | null>(null);
  const [citizenSecurityBanner, setCitizenSecurityBanner] = useState<string | null>(null);

  const [savedSchemes, setSavedSchemes] = useState<
    Array<{ schemeId: string; schemeTitle: string; savedAt: string }>
  >([]);
  const [isSavedSchemesOpen, setIsSavedSchemesOpen] = useState(false);

  // Clean unlinked initial citizen profile (zero demo defaults)
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfile>(() => createEmptyCitizenProfile());
  const [isProfileFilterApplied, setIsProfileFilterApplied] = useState(false);
  const [digiLockerCredentials, setDigiLockerCredentials] = useState<DigiLockerCredentialRecord[]>([]);
  const [digiLockerOAuthMeta, setDigiLockerOAuthMeta] = useState<{
    oauthConfigured: boolean;
    redirectUri?: string;
  }>({ oauthConfigured: false });

  // Public schemes catalog
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [schemesRealtimeReport, setSchemesRealtimeReport] = useState<SchemesRealtimeReport | null>(null);
  const [isCheckingRealtime, setIsCheckingRealtime] = useState(false);

  // Citizen-scoped applications (only own Samagra ID / own ARNs)
  const [citizenApplications, setCitizenApplications] = useState<ApplicationRecord[]>([]);

  // Admin-only district datasets (loaded strictly with verified Admin Bearer token)
  const [adminApplications, setAdminApplications] = useState<ApplicationRecord[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<LiveNotification[]>([]);
  const [adminSamagraFamilies, setAdminSamagraFamilies] = useState<SamagraFamily[]>([]);
  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);

  const [intakeScheme, setIntakeScheme] = useState<Scheme | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev.slice(-3), { ...toast, id }]);
    const duration = toast.type === 'error' || toast.type === 'warning' ? 9000 : 5500;
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const navigateTo = useCallback((targetPath: string, replace = false) => {
    const normalized = normalizePathname(targetPath);
    if (normalizePathname(window.location.pathname) !== normalized) {
      if (replace) {
        window.history.replaceState({}, '', normalized);
      } else {
        window.history.pushState({}, '', normalized);
      }
    }
    setPathname(normalized);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const activeTab = useMemo(() => mapPathnameToCitizenTab(pathname), [pathname]);

  const handleSelectCitizenTab = useCallback(
    (tab: string) => {
      setCitizenSecurityBanner(null);
      navigateTo(mapCitizenTabToPathname(tab));
    },
    [navigateTo]
  );

  // Active Citizen session is strictly isolated from Admin sessions
  const activeCitizenFirebaseUser = portalScope === 'admin' ? null : firebaseUser;
  const activeCitizenAccountUser = portalScope === 'admin' ? null : citizenAccountUser;
  const activeCitizenHeaderUser =
    activeCitizenFirebaseUser ||
    (activeCitizenAccountUser
      ? {
          uid: activeCitizenAccountUser.uid,
          displayName: activeCitizenAccountUser.displayName,
          email: activeCitizenAccountUser.email,
          photoURL: null,
        }
      : null);
  const activeCitizenKey =
    citizenProfile.samagraMemberId ||
    activeCitizenFirebaseUser?.uid ||
    activeCitizenAccountUser?.uid ||
    null;

  const isVerifiedAdmin = Boolean(
    firebaseUser && portalScope === 'admin' && adminSession?.authenticated && adminSession.role === 'admin'
  );

  // Evaluate pure RBAC route guard decision
  const routeGuard = useMemo(
    () =>
      evaluateRouteAccess(pathname, {
        authInitialized,
        isAuthenticated: Boolean(firebaseUser || citizenAccountUser || citizenAuthToken),
        portalScope,
        verifiedAdminRole: Boolean(adminSession?.authenticated && adminSession.role === 'admin'),
      }),
    [pathname, authInitialized, firebaseUser, citizenAccountUser, citizenAuthToken, portalScope, adminSession]
  );

  // Enforce RBAC redirects immediately whenever guard blocks a route
  useEffect(() => {
    if (!routeGuard.allowed && routeGuard.redirectTo) {
      if (routeGuard.reason === 'unauthenticated_admin') {
        setAdminRedirectNotice(
          routeGuard.bannerMessage ||
            'Administrator authentication is required to access the District Admin Console.'
        );
      } else if (routeGuard.reason === 'citizen_forbidden_admin') {
        setCitizenSecurityBanner(
          routeGuard.bannerMessage ||
            'Access Denied: Citizen sessions cannot access the District Admin Console.'
        );
      }
      navigateTo(routeGuard.redirectTo, true);
    }
  }, [routeGuard, navigateTo]);

  // Public schemes loader
  const fetchLiveSchemes = useCallback(async () => {
    try {
      const [schemesRes, statusRes] = await Promise.all([
        fetch('/api/schemes'),
        fetch('/api/schemes/realtime-status'),
      ]);
      const schemesParsed = await parseApiResponse<{ schemes?: Scheme[] }>(schemesRes);
      const statusParsed = await parseApiResponse<{ report?: SchemesRealtimeReport }>(statusRes);

      if (schemesParsed.ok && Array.isArray(schemesParsed.data?.schemes)) {
        setSchemes(schemesParsed.data.schemes);
        if (!statusParsed.ok) {
          setSchemesRealtimeReport(evaluateSchemesRealtimeStatus(schemesParsed.data.schemes));
        }
      } else if (!schemesParsed.ok) {
        showToast({
          type: 'error',
          title: 'Failed to Load Schemes Catalog',
          message: schemesParsed.errorInfo?.error || 'Could not retrieve scheme catalog.',
          details: schemesParsed.errorInfo?.details,
        });
      }

      if (statusParsed.ok && statusParsed.data?.report) {
        setSchemesRealtimeReport(statusParsed.data.report);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to load schemes catalog from the server.',
        details: err instanceof Error ? err.message : undefined,
      });
    }
  }, [showToast]);

  // Citizen-scoped applications loader (never hits unfiltered admin endpoints)
  const fetchCitizenScopedApplications = useCallback(async () => {
    try {
      const samagraLookupId = citizenProfile.samagraMemberId || citizenProfile.samagraFamilyId;
      const myArns = readMyArns();
      const collected = new Map<string, ApplicationRecord>();

      if (samagraLookupId) {
        const res = await fetch(
          `/api/applications?samagraId=${encodeURIComponent(samagraLookupId)}`
        );
        const parsed = await parseApiResponse<{ records?: ApplicationRecord[] }>(res);
        if (parsed.ok && Array.isArray(parsed.data?.records)) {
          for (const rec of parsed.data.records) {
            collected.set(rec.arn, rec);
          }
        }
      }

      if (myArns.length > 0) {
        const arnResults = await Promise.all(
          myArns.slice(0, 15).map(async arn => {
            try {
              const res = await fetch(`/api/applications/${encodeURIComponent(arn)}`);
              if (!res.ok) return null;
              const data = await res.json();
              return (data?.record as ApplicationRecord) || null;
            } catch {
              return null;
            }
          })
        );
        for (const rec of arnResults) {
          if (rec) collected.set(rec.arn, rec);
        }
      }

      const sorted = Array.from(collected.values()).sort((a, b) =>
        (b.appliedDate || '').localeCompare(a.appliedDate || '')
      );
      setCitizenApplications(sorted);
    } catch (err) {
      console.warn('Could not load citizen applications:', err);
    }
  }, [citizenProfile.samagraFamilyId, citizenProfile.samagraMemberId]);

  // Admin-only datasets loader (requires verified Admin Bearer token)
  const fetchAdminDistrictData = useCallback(async () => {
    if (!isVerifiedAdmin) return;
    try {
      const authHeaders = await getAuthBearerHeader(false);
      if (!authHeaders.Authorization) return;

      const [appsRes, statsRes, famRes, notifRes] = await Promise.all([
        fetch('/api/admin/applications', { headers: authHeaders }),
        fetch('/api/admin/stats', { headers: authHeaders }),
        fetch('/api/admin/samagra', { headers: authHeaders }),
        fetch('/api/admin/notifications?limit=50', { headers: authHeaders }),
      ]);

      // If token lost admin authorization server-side, immediately invalidate admin session
      if (
        appsRes.status === 401 ||
        appsRes.status === 403 ||
        statsRes.status === 401 ||
        statsRes.status === 403
      ) {
        setAdminSession(null);
        writePortalScope(null);
        setPortalScope(null);
        await logOutUser().catch(() => {});
        setAdminRedirectNotice('Administrator session expired or revoked. Please sign in again.');
        navigateTo(ADMIN_LOGIN_ROUTE, true);
        return;
      }

      const [appsParsed, statsParsed, famParsed, notifParsed] = await Promise.all([
        parseApiResponse<{ records?: ApplicationRecord[] }>(appsRes),
        parseApiResponse<{ stats?: DistrictStats }>(statsRes),
        parseApiResponse<{ families?: SamagraFamily[] }>(famRes),
        parseApiResponse<{ notifications?: LiveNotification[] }>(notifRes),
      ]);

      if (appsParsed.ok && Array.isArray(appsParsed.data?.records)) {
        setAdminApplications(appsParsed.data.records);
      } else if (!appsParsed.ok) {
        showToast({
          type: 'error',
          title: 'Admin Queue Error',
          message: appsParsed.errorInfo?.error || 'Failed to load district applications.',
          details: appsParsed.errorInfo?.details,
        });
      }

      if (statsParsed.ok && statsParsed.data?.stats) {
        setDistrictStats(statsParsed.data.stats);
      }
      if (famParsed.ok && Array.isArray(famParsed.data?.families)) {
        setAdminSamagraFamilies(famParsed.data.families);
      }
      if (notifParsed.ok && Array.isArray(notifParsed.data?.notifications)) {
        setAdminNotifications(notifParsed.data.notifications);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Admin Telemetry Error',
        message: 'Unable to load protected admin datasets.',
        details: err instanceof Error ? err.message : undefined,
      });
    }
  }, [isVerifiedAdmin, navigateTo, showToast]);

  const syncCitizenDigiLockerWallet = useCallback(
    async (citizenKey: string) => {
      try {
        const res = await fetch(`/api/digilocker/${encodeURIComponent(citizenKey)}`);
        const parsed = await parseApiResponse<{
          documents?: DigiLockerDocumentRecord[];
          credentials?: DigiLockerCredentialRecord[];
          oauthConfigured?: boolean;
          redirectUri?: string;
        }>(res);
        if (parsed.ok && Array.isArray(parsed.data?.documents)) {
          const creds = Array.isArray(parsed.data.credentials) ? parsed.data.credentials : [];
          const verifiedMap = mapDigiLockerRecordsToProfileMap(parsed.data.documents, creds);
          setDigiLockerCredentials(creds);
          setDigiLockerOAuthMeta({
            oauthConfigured: Boolean(parsed.data.oauthConfigured),
            redirectUri: parsed.data.redirectUri,
          });
          setCitizenProfile(prev => ({
            ...prev,
            verifiedDocuments: verifiedMap,
          }));
        } else if (!parsed.ok) {
          showToast({
            type: 'error',
            title: 'DigiLocker Sync Failed',
            message: parsed.errorInfo?.error || 'Could not load DigiLocker wallet.',
            details: parsed.errorInfo?.details,
          });
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'DigiLocker Connection Error',
          message: 'Unable to sync DigiLocker wallet with backend.',
          details: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [showToast]
  );

  const buildProfileFromSamagraMember = useCallback(
    (member: FamilyMember, family: SamagraFamily): CitizenProfile => {
      const wardMatch = family.wardOrBlock?.match(/ward\s*(\d+)/i);
      const parsedWard = wardMatch ? Math.min(85, Math.max(1, Number(wardMatch[1]))) : 1;
      const blockLower = (family.wardOrBlock || '').toLowerCase();
      const parsedBlock: JanpadBlock = blockLower.includes('depalpur')
        ? 'Depalpur'
        : blockLower.includes('mhow')
        ? 'Mhow'
        : blockLower.includes('sanwer')
        ? 'Sanwer'
        : 'Indore';

      return {
        fullName: member.name,
        age: member.age,
        gender: member.gender,
        category: member.category || 'GEN',
        areaType: family.areaType,
        wardNumber: family.areaType === 'urban' ? parsedWard : undefined,
        blockName: family.areaType === 'rural' ? parsedBlock : undefined,
        annualIncome: member.annualIncome ?? (family.rationCardType === 'BPL' ? 120000 : 250000),
        occupation: member.occupation,
        landHoldingHectares: member.landHoldingHectares ?? (member.occupation === 'Farmer' ? 1.5 : 0),
        isBPL: family.rationCardType === 'BPL' || family.rationCardType === 'Antyodaya',
        hasDisability: Boolean(member.hasDisability),
        disabilityPercent: member.hasDisability ? 45 : 0,
        maritalStatus: member.maritalStatus || 'Married',
        isMpDomicile: true,
        isIndoreResident: true,
        samagraFamilyId: family.familyId,
        samagraMemberId: member.memberId,
        verifiedDocuments: {},
      };
    },
    []
  );

  // Initial public schemes load, Citizen Email/Password DB session restore, & Samagra restore
  useEffect(() => {
    fetchLiveSchemes();

    const storedToken = readCitizenToken();
    const storedScope = readPortalScope();
    if (storedToken && storedScope !== 'admin') {
      fetch('/api/citizen/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data?.authenticated && data?.profile) {
            const acct = data.profile as CitizenAccountProfile;
            setCitizenAuthToken(storedToken);
            setCitizenAccountUser(acct);
            writePortalScope('citizen');
            setPortalScope('citizen');
            setCitizenProfile(prev => mapUserProfileToCitizenProfile(acct, prev));
            if (acct.samagraMemberId || acct.uid) {
              syncCitizenDigiLockerWallet(acct.samagraMemberId || acct.uid);
            }
          } else {
            writeCitizenToken(null);
            setCitizenAuthToken(null);
            setCitizenAccountUser(null);
          }
        })
        .catch(() => {});
    }

    try {
      const savedRaw = localStorage.getItem(ACTIVE_SAMAGRA_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as { familyId?: string; memberId?: string };
        if (parsed.familyId && parsed.memberId) {
          fetch(`/api/samagra/${encodeURIComponent(parsed.familyId)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
              const fam: SamagraFamily | undefined = data?.family;
              const mem = fam?.members.find(m => m.memberId === parsed.memberId);
              if (fam && mem) {
                setCitizenProfile(buildProfileFromSamagraMember(mem, fam));
                syncCitizenDigiLockerWallet(mem.memberId);
              } else {
                localStorage.removeItem(ACTIVE_SAMAGRA_STORAGE_KEY);
              }
            })
            .catch(() => {});
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [fetchLiveSchemes, buildProfileFromSamagraMember, syncCitizenDigiLockerWallet]);

  // Hydrate Citizen-scoped applications whenever Citizen Samagra ID updates
  useEffect(() => {
    if (!isAdminProtectedPath(pathname) && !isAdminLoginPath(pathname)) {
      fetchCitizenScopedApplications();
    }
  }, [pathname, fetchCitizenScopedApplications]);

  // Hydrate Admin datasets strictly when verified Admin is active
  useEffect(() => {
    if (isVerifiedAdmin && isAdminProtectedPath(pathname)) {
      fetchAdminDistrictData();
    }
  }, [isVerifiedAdmin, pathname, fetchAdminDistrictData]);

  // Sync DigiLocker whenever activeCitizenKey or DigiLocker tab is active
  useEffect(() => {
    if (activeCitizenKey) {
      syncCitizenDigiLockerWallet(activeCitizenKey);
    } else if (activeTab === 'digilocker') {
      syncCitizenDigiLockerWallet('citizen_oauth');
    }
  }, [activeCitizenKey, activeTab, syncCitizenDigiLockerWallet]);

  // Subscribe to non-PII live SSE signals from server
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/stream/events');
      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (!data || data.type === 'connected') return;

          if (data.eventType === 'schemes_updated') {
            fetchLiveSchemes();
          } else if (
            data.eventType === 'application_updated' ||
            data.eventType === 'samagra_updated' ||
            data.eventType === 'digilocker_updated'
          ) {
            if (isVerifiedAdmin) {
              fetchAdminDistrictData();
            } else {
              fetchCitizenScopedApplications();
            }
          }
        } catch {
          // ignore malformed event
        }
      };
    } catch (err) {
      console.warn('SSE connection error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [fetchLiveSchemes, fetchAdminDistrictData, fetchCitizenScopedApplications, isVerifiedAdmin]);

  // Firebase Auth State Listener with Strict Citizen vs Admin Session Isolation
  useEffect(() => {
    let cancelled = false;
    const unsubscribeAuth = onAuthStateChanged(auth, async user => {
      if (cancelled) return;
      setFirebaseUser(user);

      if (!user) {
        setUserProfileDoc(null);
        setAdminSession(null);
        setAdminApplications([]);
        setAdminNotifications([]);
        setAdminSamagraFamilies([]);
        setDistrictStats(null);
        if (readCitizenToken()) {
          writePortalScope('citizen');
          setPortalScope('citizen');
        } else {
          setSavedSchemes([]);
          writePortalScope(null);
          setPortalScope(null);
        }
        setAuthInitialized(true);
        return;
      }

      const storedScope = readPortalScope();
      if (storedScope === 'admin') {
        // Re-verify Admin claim cryptographically on the server before restoring Admin session
        try {
          const verified = await verifyAdminSessionWithServer(user, false);
          if (cancelled) return;
          setAdminSession(verified.session);
          setPortalScope('admin');
          setUserProfileDoc(null);
        } catch {
          if (cancelled) return;
          setAdminSession(null);
          writePortalScope('citizen');
          setPortalScope('citizen');
        } finally {
          if (!cancelled) setAuthInitialized(true);
        }
        return;
      }

      // Default strictly to Citizen scope — never escalate Citizen sessions into Admin
      setAdminSession(null);
      writePortalScope('citizen');
      setPortalScope('citizen');
      setAuthBannerMessage(null);

      try {
        const docData = await fetchUserProfileFromFirestore(user.uid);
        if (cancelled) return;
        if (docData) {
          const citizenScopedDoc: UserProfileDoc = { ...docData, role: 'citizen' };
          setUserProfileDoc(citizenScopedDoc);
          setCitizenProfile(prev => mapUserProfileToCitizenProfile(citizenScopedDoc, prev));
        } else {
          setCitizenProfile(prev => ({
            ...prev,
            fullName: user.displayName || prev.fullName,
          }));
        }
      } catch (err) {
        console.warn('Could not load Firestore citizen profile:', err);
        setCitizenProfile(prev => ({
          ...prev,
          fullName: user.displayName || prev.fullName,
        }));
      } finally {
        if (!cancelled) setAuthInitialized(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
  }, []);

  // Saved Schemes Listener (Firestore for Google citizens, Backend DB for Email/Password citizens)
  useEffect(() => {
    if (activeCitizenFirebaseUser) {
      const savedPath = `users/${activeCitizenFirebaseUser.uid}/savedSchemes`;
      const savedSchemesCol = collection(db, 'users', activeCitizenFirebaseUser.uid, 'savedSchemes');
      const unsubscribeSaved = onSnapshot(
        savedSchemesCol,
        snapshot => {
          const items = snapshot.docs.map(docSnap => ({
            schemeId: docSnap.id,
            schemeTitle: (docSnap.data().schemeTitle as string) || docSnap.id,
            savedAt: (docSnap.data().savedAt as string) || new Date().toISOString(),
          }));
          setSavedSchemes(items);
        },
        err => {
          handleFirestoreError(err, OperationType.LIST, savedPath);
        }
      );
      return () => unsubscribeSaved();
    }

    if (activeCitizenAccountUser && citizenAuthToken) {
      fetch('/api/citizen/saved-schemes', {
        headers: { Authorization: `Bearer ${citizenAuthToken}` },
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (Array.isArray(data?.items)) {
            setSavedSchemes(data.items);
          }
        })
        .catch(() => {});
      return;
    }

    setSavedSchemes([]);
  }, [activeCitizenFirebaseUser, activeCitizenAccountUser, citizenAuthToken]);

  // Citizen Google Auth Success Handler (strictly Citizen role & Citizen Dashboard)
  const handleCitizenAuthSuccess = (result: AuthResult) => {
    writeCitizenToken(null);
    setCitizenAuthToken(null);
    setCitizenAccountUser(null);
    writePortalScope('citizen');
    setPortalScope('citizen');
    setAdminSession(null);
    setFirebaseUser(result.user);
    const citizenDoc: UserProfileDoc = { ...result.profile, role: 'citizen' };
    setUserProfileDoc(citizenDoc);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(citizenDoc, prev));
    setAuthBannerMessage(null);
    setCitizenSecurityBanner(null);
    navigateTo(CITIZEN_DEFAULT_ROUTE);
  };

  // Citizen Email/Password Auth Success Handler (PostgreSQL / SQLite backed, Citizen role only)
  const handleCitizenEmailAuthSuccess = (token: string, profile: CitizenAccountProfile) => {
    writeCitizenToken(token);
    setCitizenAuthToken(token);
    setCitizenAccountUser(profile);
    writePortalScope('citizen');
    setPortalScope('citizen');
    setAdminSession(null);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(profile, prev));
    if (profile.samagraFamilyId && profile.samagraMemberId) {
      try {
        localStorage.setItem(
          ACTIVE_SAMAGRA_STORAGE_KEY,
          JSON.stringify({ familyId: profile.samagraFamilyId, memberId: profile.samagraMemberId })
        );
      } catch {
        // ignore storage errors
      }
    }
    if (profile.samagraMemberId || profile.uid) {
      syncCitizenDigiLockerWallet(profile.samagraMemberId || profile.uid);
    }
    setAuthBannerMessage(null);
    setCitizenSecurityBanner(null);
    navigateTo(CITIZEN_DEFAULT_ROUTE);
  };

  // Dedicated Admin Auth Success Handler (strictly verified Admin session -> /admin)
  const handleAdminAuthenticated = (result: AdminAuthResult) => {
    writeCitizenToken(null);
    setCitizenAuthToken(null);
    setCitizenAccountUser(null);
    writePortalScope('admin');
    setPortalScope('admin');
    setFirebaseUser(result.user);
    setAdminSession(result.session);
    setUserProfileDoc(null);
    setAdminRedirectNotice(null);
    setCitizenSecurityBanner(null);
    navigateTo(ADMIN_DASHBOARD_ROUTE, true);
  };

  const handleUpdateCitizenProfileInCloud = async (updates: Partial<UserProfileDoc>) => {
    if (activeCitizenAccountUser && citizenAuthToken) {
      const res = await fetch('/api/citizen/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAuthToken}`,
        },
        body: JSON.stringify(updates),
      });
      const parsed = await parseApiResponse<{ profile?: CitizenAccountProfile }>(res);
      if (!parsed.ok || !parsed.data?.profile) {
        throw new ApiRequestError(
          parsed.errorInfo || { status: parsed.status, error: 'Failed to update citizen profile.' }
        );
      }
      const updatedAccount = parsed.data.profile;
      setCitizenAccountUser(updatedAccount);
      setCitizenProfile(prev => mapUserProfileToCitizenProfile(updatedAccount, prev));
      return;
    }

    if (!activeCitizenFirebaseUser) return;
    const updatedDoc = await updateCitizenProfileInFirestore(activeCitizenFirebaseUser.uid, updates);
    const citizenDoc: UserProfileDoc = { ...updatedDoc, role: 'citizen' };
    setUserProfileDoc(citizenDoc);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(citizenDoc, prev));
  };

  const handleCitizenSignOut = async () => {
    try {
      writeCitizenToken(null);
      setCitizenAuthToken(null);
      setCitizenAccountUser(null);
      if (firebaseUser) {
        await logOutUser();
      }
      writePortalScope(null);
      setPortalScope(null);
      setUserProfileDoc(null);
      setAdminSession(null);
      setSavedSchemes([]);
      setAuthBannerMessage(null);
    } catch (err) {
      console.error('Citizen Sign-Out failed:', err);
    }
  };

  const handleAdminSignOut = async () => {
    try {
      await logOutUser();
      writePortalScope(null);
      setPortalScope(null);
      setAdminSession(null);
      setAdminApplications([]);
      setAdminNotifications([]);
      setAdminSamagraFamilies([]);
      setDistrictStats(null);
      setAdminRedirectNotice('You have signed out of the District Admin Console.');
      navigateTo(ADMIN_LOGIN_ROUTE, true);
    } catch (err) {
      console.error('Admin Sign-Out failed:', err);
    }
  };

  const handleToggleSaveScheme = async (scheme: Scheme) => {
    if (activeCitizenFirebaseUser) {
      try {
        const isAlreadySaved = savedSchemes.some(s => s.schemeId === scheme.id);
        if (isAlreadySaved) {
          await removeSavedSchemeFromUserFirestore(activeCitizenFirebaseUser.uid, scheme.id);
          showToast({
            type: 'info',
            title: 'Bookmark Removed',
            message: `Removed "${scheme.title}" from your saved schemes.`,
          });
        } else {
          await saveSchemeToUserFirestore(activeCitizenFirebaseUser.uid, scheme.id, scheme.title);
          showToast({
            type: 'success',
            title: 'Scheme Saved',
            message: `Bookmarked "${scheme.title}" to your citizen profile.`,
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not update saved scheme in cloud storage. Please try again.';
        setAuthBannerMessage(msg);
        showToast({ type: 'error', title: 'Bookmark Update Failed', message: msg });
      }
      return;
    }

    if (activeCitizenAccountUser && citizenAuthToken) {
      try {
        const isAlreadySaved = savedSchemes.some(s => s.schemeId === scheme.id);
        const res = isAlreadySaved
          ? await fetch(`/api/citizen/saved-schemes/${encodeURIComponent(scheme.id)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${citizenAuthToken}` },
            })
          : await fetch('/api/citizen/saved-schemes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${citizenAuthToken}`,
              },
              body: JSON.stringify({ schemeId: scheme.id, schemeTitle: scheme.title }),
            });
        const parsed = await parseApiResponse<{
          items?: Array<{ schemeId: string; schemeTitle: string; savedAt: string }>;
        }>(res);
        if (!parsed.ok) {
          const errMsg = parsed.errorInfo?.error || 'Could not update saved scheme.';
          setAuthBannerMessage(errMsg);
          showToast({
            type: 'error',
            title: 'Bookmark Update Failed',
            message: errMsg,
            details: parsed.errorInfo?.details,
          });
          return;
        }
        if (Array.isArray(parsed.data?.items)) {
          setSavedSchemes(parsed.data.items);
          showToast({
            type: isAlreadySaved ? 'info' : 'success',
            title: isAlreadySaved ? 'Bookmark Removed' : 'Scheme Saved',
            message: isAlreadySaved
              ? `Removed "${scheme.title}" from saved schemes.`
              : `Bookmarked "${scheme.title}" to your citizen account.`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not update saved scheme.';
        setAuthBannerMessage(msg);
        showToast({ type: 'error', title: 'Bookmark Error', message: msg });
      }
      return;
    }

    setAuthBannerMessage(
      `Sign in or register as a citizen to bookmark "${scheme.title}" to your profile.`
    );
    showToast({
      type: 'info',
      title: 'Sign In Required',
      message: `Please sign in to bookmark "${scheme.title}".`,
    });
    handleSelectCitizenTab('auth');
  };

  // Run live server-side verification against official scheme portals
  const handleRunSchemesRealtimeCheck = async () => {
    setIsCheckingRealtime(true);
    try {
      const res = await fetch('/api/schemes/verify-realtime', { method: 'POST' });
      const parsed = await parseApiResponse<{
        schemes?: Scheme[];
        report?: SchemesRealtimeReport;
      }>(res);
      if (!parsed.ok) {
        showToast({
          type: 'error',
          title: 'Portal Reachability Check Failed',
          message: parsed.errorInfo?.error || 'Failed to verify official scheme portals.',
          details: parsed.errorInfo?.details,
        });
        return;
      }
      if (Array.isArray(parsed.data?.schemes)) {
        setSchemes(parsed.data.schemes);
      }
      if (parsed.data?.report) {
        setSchemesRealtimeReport(parsed.data.report);
        showToast({
          type: 'success',
          title: 'Official Portal Audit Complete',
          message: `${parsed.data.report.reachableSchemesCount}/${parsed.data.report.totalSchemes} schemes reachable across official portals.`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Portal Check Network Error',
        message: 'Could not reach server to probe official scheme portals.',
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsCheckingRealtime(false);
    }
  };

  // Live Admin Create Scheme (strictly authenticated with Admin Bearer token)
  const handleCreateLiveScheme = async (
    schemePayload: Partial<Scheme> & { id: string; title: string }
  ): Promise<boolean> => {
    if (!isVerifiedAdmin) {
      showToast({
        type: 'error',
        title: 'Admin Authorization Required',
        message: 'Only verified administrators can publish schemes.',
      });
      throw new ApiRequestError({
        status: 403,
        error: 'Only verified administrators can publish schemes.',
      });
    }
    const authHeaders = await getAuthBearerHeader(false);
    const res = await fetch('/api/schemes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(schemePayload),
    });
    const parsed = await parseApiResponse<{ scheme?: Scheme }>(res);
    if (!parsed.ok) {
      showToast({
        type: 'error',
        title: 'Publish Scheme Failed',
        message: parsed.errorInfo?.error || 'Failed to save new scheme.',
        details: parsed.errorInfo?.details,
      });
      throw new ApiRequestError(
        parsed.errorInfo || { status: parsed.status, error: 'Failed to save new scheme.' }
      );
    }
    await fetchLiveSchemes();
    await fetchAdminDistrictData();
    showToast({
      type: 'success',
      title: 'Live Scheme Published',
      message: `"${schemePayload.title}" is now live in Citizen Discovery.`,
    });
    return true;
  };

  const handleSyncDocumentsFromServer = (
    docs: DigiLockerDocumentRecord[],
    credentials?: DigiLockerCredentialRecord[]
  ) => {
    const nextCreds = Array.isArray(credentials) ? credentials : digiLockerCredentials;
    if (Array.isArray(credentials)) {
      setDigiLockerCredentials(credentials);
    }
    setCitizenProfile(prev => ({
      ...prev,
      verifiedDocuments: mapDigiLockerRecordsToProfileMap(docs, nextCreds),
    }));
  };

  // Handle member selection from live Samagra Family Portal
  const handleSelectMemberForProfile = (member: FamilyMember, family: SamagraFamily) => {
    const nextProfile = buildProfileFromSamagraMember(member, family);
    setCitizenProfile(nextProfile);
    try {
      localStorage.setItem(
        ACTIVE_SAMAGRA_STORAGE_KEY,
        JSON.stringify({ familyId: family.familyId, memberId: member.memberId })
      );
    } catch {
      // ignore storage errors
    }
    syncCitizenDigiLockerWallet(member.memberId);

    if (activeCitizenFirebaseUser || (activeCitizenAccountUser && citizenAuthToken)) {
      handleUpdateCitizenProfileInCloud({
        displayName: nextProfile.fullName,
        samagraFamilyId: family.familyId,
        samagraMemberId: member.memberId,
        samagraId: member.memberId,
        areaType: nextProfile.areaType,
        wardNumber: nextProfile.wardNumber,
        blockName: nextProfile.blockName,
        age: nextProfile.age,
        gender: nextProfile.gender,
        category: nextProfile.category,
        annualIncome: nextProfile.annualIncome,
        occupation: nextProfile.occupation,
        isBPL: nextProfile.isBPL,
        maritalStatus: nextProfile.maritalStatus,
        ekycVerified: member.ekycStatus,
      }).catch(err => {
        showToast({
          type: 'warning',
          title: 'Account Link Warning',
          message:
            err instanceof Error
              ? err.message
              : 'Could not link Samagra ID to your citizen account.',
        });
      });
    }
    handleSelectCitizenTab('schemes');
  };

  const handleSamagraSessionLogin = async (member: FamilyMember, family: SamagraFamily) => {
    const nextProfile = buildProfileFromSamagraMember(member, family);
    setCitizenProfile(nextProfile);
    try {
      localStorage.setItem(
        ACTIVE_SAMAGRA_STORAGE_KEY,
        JSON.stringify({ familyId: family.familyId, memberId: member.memberId })
      );
    } catch {
      // ignore
    }
    await syncCitizenDigiLockerWallet(member.memberId);
    if (activeCitizenFirebaseUser || (activeCitizenAccountUser && citizenAuthToken)) {
      await handleUpdateCitizenProfileInCloud({
        displayName: nextProfile.fullName,
        samagraFamilyId: family.familyId,
        samagraMemberId: member.memberId,
        samagraId: member.memberId,
        areaType: nextProfile.areaType,
        wardNumber: nextProfile.wardNumber,
        blockName: nextProfile.blockName,
        age: nextProfile.age,
        gender: nextProfile.gender,
        category: nextProfile.category,
        annualIncome: nextProfile.annualIncome,
        occupation: nextProfile.occupation,
        isBPL: nextProfile.isBPL,
        maritalStatus: nextProfile.maritalStatus,
        ekycVerified: member.ekycStatus,
      });
    }
  };

  // Submit live application to PostgreSQL / SQLite + Firestore (Citizen action)
  const handleApplicationSubmit = async (appData: {
    schemeId: string;
    applicantName: string;
    samagraMemberId: string;
    samagraFamilyId: string;
    phone: string;
    wardOrBlock: string;
    areaType: 'urban' | 'rural';
  }): Promise<void> => {
    const citizenId =
      activeCitizenAccountUser?.uid || activeCitizenFirebaseUser?.uid || appData.samagraMemberId;
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...appData,
        citizenId,
      }),
    });

    const parsed = await parseApiResponse<{ record?: ApplicationRecord }>(res);
    if (!parsed.ok || !parsed.data?.record) {
      const errorInfo = parsed.errorInfo || {
        status: parsed.status,
        error: `Application intake failed with status ${parsed.status}.`,
      };
      showToast({
        type: 'error',
        title:
          parsed.status === 409 ? 'Duplicate Application Blocked' : 'Application Submission Failed',
        message: errorInfo.error,
        details: errorInfo.details,
      });
      throw new ApiRequestError(errorInfo);
    }

    const createdRecord = parsed.data.record;
    rememberMyArn(createdRecord.arn);
    setCitizenApplications(prev => [
      createdRecord,
      ...prev.filter(a => a.arn !== createdRecord.arn),
    ]);

    if (activeCitizenFirebaseUser) {
      const targetScheme = schemes.find(s => s.id === appData.schemeId);
      saveApplicationToFirestore({
        arn: createdRecord.arn,
        schemeId: appData.schemeId,
        schemeName: targetScheme ? targetScheme.title : createdRecord.schemeTitle,
        applicantName: appData.applicantName,
        applicantUid: activeCitizenFirebaseUser.uid,
        samagraId: appData.samagraMemberId,
        wardNumber: appData.areaType === 'urban' ? citizenProfile.wardNumber : undefined,
        status: 'Submitted',
        appliedAt: new Date().toISOString(),
        amountEstimated: targetScheme?.financialEntitlement?.amount || 0,
      }).catch(err => console.warn('Firestore app sync warning:', err));
    }

    showToast({
      type: 'success',
      title: 'Application Submitted',
      message: `Generated ARN ${createdRecord.arn} for ${createdRecord.schemeTitle}.`,
    });
    setIntakeScheme(null);
    handleSelectCitizenTab('tracker');
  };

  // Live Admin update application status (strictly authenticated with Admin Bearer token)
  const handleAdminUpdateApplicationStatus = async (
    arn: string,
    status: ApplicationRecord['currentStatus'],
    remarks?: string
  ) => {
    if (!isVerifiedAdmin) {
      throw new ApiRequestError({ status: 403, error: 'Administrator session is required.' });
    }
    const authHeaders = await getAuthBearerHeader(false);
    const res = await fetch(`/api/applications/${encodeURIComponent(arn)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ status, remarks }),
    });
    const parsed = await parseApiResponse<{ record?: ApplicationRecord }>(res);
    if (!parsed.ok || !parsed.data?.record) {
      const errorInfo = parsed.errorInfo || {
        status: parsed.status,
        error: 'Failed to update application status.',
      };
      showToast({
        type: 'error',
        title: 'Status Update Failed',
        message: errorInfo.error,
        details: errorInfo.details,
      });
      throw new ApiRequestError(errorInfo);
    }

    setAdminApplications(prev =>
      prev.map(a => (a.arn === parsed.data!.record!.arn ? parsed.data!.record! : a))
    );
    showToast({
      type: 'success',
      title: 'Application Status Updated',
      message: `ARN ${parsed.data.record.arn} moved to ${status.replace(/_/g, ' ').toUpperCase()}.`,
    });
    fetchAdminDistrictData();
  };

  // Broadcast notification from admin (strictly authenticated with Admin Bearer token)
  const handleBroadcastNotification = async (notifData: {
    type: LiveNotification['type'];
    message: string;
    wardOrBlock: string;
    amount?: number;
  }): Promise<void> => {
    if (!isVerifiedAdmin) {
      throw new ApiRequestError({ status: 403, error: 'Administrator session is required.' });
    }
    const authHeaders = await getAuthBearerHeader(false);
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(notifData),
    });
    const parsed = await parseApiResponse<{ notification?: LiveNotification }>(res);
    if (!parsed.ok) {
      const errorInfo = parsed.errorInfo || {
        status: parsed.status,
        error: 'Failed to broadcast administrative alert.',
      };
      showToast({
        type: 'error',
        title: 'Broadcast Failed',
        message: errorInfo.error,
        details: errorInfo.details,
      });
      throw new ApiRequestError(errorInfo);
    }

    showToast({
      type: 'success',
      title: 'Live Alert Broadcasted',
      message: `Sent administrative notice to ${notifData.wardOrBlock}.`,
    });
    fetchAdminDistrictData();
  };

  // Schemes matching the user's applied Citizen Profile criteria (all rules passed: eligible or likely)
  const criteriaMatchedSchemes = useMemo(() => {
    return schemes.filter(
      scheme => evaluateSchemeEligibility(citizenProfile, scheme).status !== 'not_eligible'
    );
  }, [citizenProfile, schemes]);

  const webpageSchemes = isProfileFilterApplied ? criteriaMatchedSchemes : schemes;

  // Filter schemes according to active search query, selected governance level & applied user criteria
  const filteredSchemes = useMemo(
    () =>
      searchSchemes(searchQuery, webpageSchemes, {
        levelFilter: selectedLevel,
      }),
    [searchQuery, webpageSchemes, selectedLevel]
  );

  // Compute eligibility results for active citizen profile
  const eligibilityResults = useMemo(
    () => rankSchemesForCitizen(citizenProfile, schemes),
    [citizenProfile, schemes]
  );

  const handleApplyProfileFilter = useCallback(
    (nextProfile: CitizenProfile) => {
      setCitizenProfile(nextProfile);
      setIsProfileFilterApplied(true);
      const matchedCount = schemes.filter(
        s => evaluateSchemeEligibility(nextProfile, s).status !== 'not_eligible'
      ).length;
      showToast({
        type: 'success',
        title: pickText(currentLanguage, {
          en: 'Criteria Filter Applied',
          hi: 'पात्रता फ़िल्टर लागू हुआ',
          malwi: 'थारो फ़िल्टर लागू हो गयो छे',
        }),
        message: pickText(currentLanguage, {
          en: `Showing ${matchedCount} scheme${matchedCount === 1 ? '' : 's'} matching your profile across the platform.`,
          hi: `पूरे पोर्टल पर आपके मापदंड से मेल खाती ${matchedCount} योजनाएं दिखाई जा रही हैं।`,
          malwi: `पूरा पेज पर थारी जानकारी मुजब ${matchedCount} पात्र योजना दिख री छे।`,
        }),
      });
    },
    [schemes, currentLanguage, showToast]
  );

  const handleClearProfileFilter = useCallback(() => {
    setIsProfileFilterApplied(false);
    showToast({
      type: 'info',
      title: pickText(currentLanguage, {
        en: 'Filter Cleared',
        hi: 'फ़िल्टर हटाया गया',
        malwi: 'फ़िल्टर हट गयो छे',
      }),
      message: pickText(currentLanguage, {
        en: `Showing all ${schemes.length} active Indore District schemes.`,
        hi: `इंदौर जिले की सभी ${schemes.length} सक्रिय योजनाएं दिखाई जा रही हैं।`,
        malwi: `इंदौर जिला री सगळी ${schemes.length} चालू योजना दिख री छे।`,
      }),
    });
  }, [schemes.length, currentLanguage, showToast]);

  const handleResetAllSearchCriteria = useCallback(() => {
    setSearchQuery('');
    setSelectedLevel('all');
    setIsProfileFilterApplied(false);
    showToast({
      type: 'info',
      title: pickText(currentLanguage, {
        en: 'Search Criteria Reset',
        hi: 'खोज मापदंड रीसेट किए गए',
        malwi: 'खोज रा नियम पाछा साफ हो गया',
      }),
      message: pickText(currentLanguage, {
        en: 'Modify your search criteria or browse all active Indore & MP schemes.',
        hi: 'आप अब नए खोज मापदंड दर्ज कर सकते हैं या सभी योजनाएं देख सकते हैं।',
        malwi: 'अब तमे नवा खोज रा नियम डाल सको या सगळी योजना देख सको।',
      }),
    });
  }, [currentLanguage, showToast]);

  // ================= DEDICATED ADMIN LOGIN ROUTE (/admin/login) =================
  if (isAdminLoginPath(pathname)) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AdminLoginPage
          onAdminAuthenticated={handleAdminAuthenticated}
          onReturnToCitizenPortal={() => {
            setAdminRedirectNotice(null);
            navigateTo(CITIZEN_DEFAULT_ROUTE);
          }}
          redirectNotice={adminRedirectNotice}
          onNotify={showToast}
        />
      </>
    );
  }

  // ================= STRICTLY GUARDED ADMIN CONSOLE ROUTE (/admin*) =================
  if (isAdminProtectedPath(pathname)) {
    if (!authInitialized || !routeGuard.allowed || !isVerifiedAdmin) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 space-y-3">
          <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Verifying Administrator Role &amp; Session...
          </p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-heading">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {/* Dedicated Isolated Admin Top Bar (No Citizen Navigation) */}
        <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-white">
                    YojanaSetu <span className="text-purple-400">Admin Console</span>
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    RBAC Verified
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  District Collectorate &amp; Indore Municipal Corporation • Isolated Administrative Session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight">
                  {adminSession?.displayName || 'District Administrator'}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {adminSession?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAdminSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-200 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Admin Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <AdminDashboard
            currentLanguage={currentLanguage}
            notifications={adminNotifications}
            applications={adminApplications}
            schemes={schemes}
            samagraFamilies={adminSamagraFamilies}
            stats={districtStats}
            schemesRealtimeReport={schemesRealtimeReport}
            isCheckingRealtime={isCheckingRealtime}
            onRunSchemesRealtimeCheck={handleRunSchemesRealtimeCheck}
            onUpdateApplicationStatus={handleAdminUpdateApplicationStatus}
            onCreateLiveScheme={handleCreateLiveScheme}
            onBroadcastNotification={handleBroadcastNotification}
          />
        </main>
      </div>
    );
  }

  // ================= PUBLIC / CITIZEN PORTAL =================
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden ${
        currentLanguage === 'en' ? 'font-heading' : 'font-devanagari'
      }`}
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Citizen-Only Header (Zero Admin Mode Switcher or Admin Links) */}
      <Header
        currentLanguage={currentLanguage}
        setLanguage={setCurrentLanguage}
        onOpenSamagraModal={() => handleSelectCitizenTab('samagra')}
        activeTab={activeTab}
        setActiveTab={handleSelectCitizenTab}
        firebaseUser={activeCitizenHeaderUser}
        onSignOut={handleCitizenSignOut}
        savedSchemesCount={savedSchemes.length}
        onOpenSavedSchemes={() => setIsSavedSchemesOpen(true)}
      />

      {/* Global Active Profile Filter Bar across the entire webpage */}
      {isProfileFilterApplied && (
        <div className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {t(
                    `Active Profile Filter (${criteriaMatchedSchemes.length} Matching Schemes):`,
                    `सक्रिय पात्रता फ़िल्टर (${criteriaMatchedSchemes.length} मेल खाती योजनाएं):`,
                    `थारो फ़िल्टर लागू छे (${criteriaMatchedSchemes.length} पात्र योजना मिल्या):`
                  )}
                </span>
              </span>
              <span className="bg-emerald-800/90 border border-emerald-700 px-2 py-0.5 rounded-md font-medium">
                {t('Age:', 'आयु:', 'उमर:')} {citizenProfile.age} {t('yrs', 'वर्ष', 'साल')}
              </span>
              <span className="bg-emerald-800/90 border border-emerald-700 px-2 py-0.5 rounded-md font-medium">
                {t('Income:', 'आय:', 'कमाई:')} ₹{citizenProfile.annualIncome.toLocaleString('en-IN')}
              </span>
              <span className="bg-emerald-800/90 border border-emerald-700 px-2 py-0.5 rounded-md font-medium">
                {getGenderLabel(citizenProfile.gender, currentLanguage)}
              </span>
              <span className="bg-emerald-800/90 border border-emerald-700 px-2 py-0.5 rounded-md font-medium">
                {getOccupationLabel(citizenProfile.occupation, currentLanguage)}
              </span>
              <span className="bg-emerald-800/90 border border-emerald-700 px-2 py-0.5 rounded-md font-medium">
                {getCategoryLabel(citizenProfile.category, currentLanguage)}
              </span>
              <span className="bg-emerald-800/90 border border-emerald-700 px-2 py-0.5 rounded-md font-medium">
                {citizenProfile.areaType === 'urban'
                  ? t(
                      `IMC Ward ${citizenProfile.wardNumber || 1}`,
                      `निगम वार्ड ${citizenProfile.wardNumber || 1}`,
                      `शहर वार्ड ${citizenProfile.wardNumber || 1}`
                    )
                  : `${citizenProfile.blockName || 'Indore'} ${t('Janpad', 'जनपद', 'जनपद')}`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearProfileFilter}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('Reset Filter', 'फ़िल्टर हटाएं', 'फ़िल्टर हटावो')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Security / RBAC Block Banner when a Citizen tries to open /admin */}
      {citizenSecurityBanner && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{citizenSecurityBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setCitizenSecurityBanner(null)}
              className="text-rose-700 hover:text-rose-950 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Citizen Content */}
      <main className="flex-1">
        {activeTab === 'schemes' && (
          <div>
            <HeroSection
              currentLanguage={currentLanguage}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedLevel={selectedLevel}
              setSelectedLevel={setSelectedLevel}
              onOpenCalculator={() => {
                const el = document.getElementById('eligibility-calculator-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenEntitlementCard={() => setIsEntitlementCardOpen(true)}
              onOpenComparison={() => {
                setComparisonInitialId(undefined);
                setIsComparisonOpen(true);
              }}
              totalSchemesCount={filteredSchemes.length}
              isProfileFilterApplied={isProfileFilterApplied}
              onClearProfileFilter={handleClearProfileFilter}
              onResetAllCriteria={handleResetAllSearchCriteria}
            />

            <div id="eligibility-calculator-section">
              <EligibilityCalculator
                schemes={filteredSchemes}
                currentLanguage={currentLanguage}
                profile={citizenProfile}
                setProfile={setCitizenProfile}
                citizenKey={activeCitizenKey}
                onApplyScheme={scheme => setIntakeScheme(scheme)}
                onNavigateToDigilocker={() => handleSelectCitizenTab('digilocker')}
                onNavigateToSamagra={() => handleSelectCitizenTab('samagra')}
                schemesRealtimeReport={schemesRealtimeReport}
                isCheckingRealtime={isCheckingRealtime}
                onRunSchemesRealtimeCheck={handleRunSchemesRealtimeCheck}
                savedSchemeIds={savedSchemes.map(s => s.schemeId)}
                onToggleSaveScheme={handleToggleSaveScheme}
                isProfileFilterApplied={isProfileFilterApplied}
                onApplyProfileFilter={handleApplyProfileFilter}
                onClearProfileFilter={handleClearProfileFilter}
                searchQuery={searchQuery}
                selectedLevel={selectedLevel}
                onResetAllCriteria={handleResetAllSearchCriteria}
              />
            </div>
          </div>
        )}

        {activeTab === 'governance' && (
          <GovernanceLevelsView
            currentLanguage={currentLanguage}
            schemes={webpageSchemes}
            isProfileFilterApplied={isProfileFilterApplied}
            onClearProfileFilter={handleClearProfileFilter}
            onSelectLevel={(lvl: GovernanceLevel) => {
              setSelectedLevel(lvl);
              handleSelectCitizenTab('schemes');
            }}
          />
        )}

        {activeTab === 'samagra' && (
          <SamagraFamilyView
            currentLanguage={currentLanguage}
            schemes={webpageSchemes}
            activeFamilyId={citizenProfile.samagraFamilyId}
            activeMemberId={citizenProfile.samagraMemberId}
            onSelectMemberForProfile={handleSelectMemberForProfile}
            onFamiliesChanged={fetchCitizenScopedApplications}
            onNotify={showToast}
          />
        )}

        {activeTab === 'digilocker' && (
          <DigiLockerTrackerView
            currentLanguage={currentLanguage}
            profile={citizenProfile}
            citizenKey={activeCitizenKey}
            credentials={digiLockerCredentials}
            oauthMeta={digiLockerOAuthMeta}
            onSyncDocumentsFromServer={handleSyncDocumentsFromServer}
            onRefreshWallet={() =>
              syncCitizenDigiLockerWallet(activeCitizenKey || 'citizen_oauth')
            }
            onNavigateToSamagra={() => handleSelectCitizenTab('samagra')}
            onNotify={showToast}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            currentLanguage={currentLanguage}
            applications={citizenApplications}
            onNavigateToSchemes={() => handleSelectCitizenTab('schemes')}
            onNotify={showToast}
          />
        )}

        {activeTab === 'auth' && (
          <AuthPage
            currentLanguage={currentLanguage}
            firebaseUser={activeCitizenFirebaseUser}
            citizenAccountUser={activeCitizenAccountUser}
            citizenAuthToken={citizenAuthToken}
            userProfileDoc={userProfileDoc}
            citizenProfile={citizenProfile}
            onAuthSuccess={handleCitizenAuthSuccess}
            onEmailAuthSuccess={handleCitizenEmailAuthSuccess}
            onSamagraSessionLogin={handleSamagraSessionLogin}
            onUpdateCitizenProfile={handleUpdateCitizenProfileInCloud}
            onSignOut={handleCitizenSignOut}
            onNavigateTab={handleSelectCitizenTab}
            onOpenSavedSchemes={() => setIsSavedSchemesOpen(true)}
            savedSchemesCount={savedSchemes.length}
            authBannerMessage={authBannerMessage}
            onNotify={showToast}
          />
        )}
      </main>

      {/* Online Application Intake Modal */}
      <ApplicationIntakeModal
        scheme={intakeScheme}
        profile={citizenProfile}
        currentLanguage={currentLanguage}
        isOpen={intakeScheme !== null}
        onClose={() => setIntakeScheme(null)}
        onSubmit={handleApplicationSubmit}
      />

      {/* Citizen Entitlement Certificate Modal */}
      <CitizenEntitlementCardModal
        isOpen={isEntitlementCardOpen}
        onClose={() => setIsEntitlementCardOpen(false)}
        profile={citizenProfile}
        eligibilityResults={eligibilityResults}
        currentLanguage={currentLanguage}
      />

      {/* Side-by-Side Scheme Comparison Modal */}
      <SchemeComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        schemes={webpageSchemes.length > 0 ? webpageSchemes : schemes}
        currentLanguage={currentLanguage}
        initialSchemeId={comparisonInitialId}
      />

      {/* Cloud Saved Schemes Modal (Firestore) */}
      <SavedSchemesModal
        isOpen={isSavedSchemesOpen}
        onClose={() => setIsSavedSchemesOpen(false)}
        savedSchemes={savedSchemes}
        allSchemes={schemes}
        currentLanguage={currentLanguage}
        onRemoveScheme={schemeId => {
          if (activeCitizenFirebaseUser) {
            removeSavedSchemeFromUserFirestore(activeCitizenFirebaseUser.uid, schemeId)
              .then(() => {
                showToast({
                  type: 'info',
                  title: t('Bookmark Removed', 'बुकमार्क हटाया गया', 'योजना सूची सूं हटाई'),
                  message: t('Removed scheme from your saved list.', 'योजना आपकी सहेजी सूची से हटाई गई।', 'योजना थारी संभाली सूची सूं हटा दी।'),
                });
              })
              .catch(err => {
                showToast({
                  type: 'error',
                  title: t('Remove Failed', 'हटाने में त्रुटि', 'हटावण मां दिक्कत आई'),
                  message:
                    err instanceof Error ? err.message : 'Failed to remove saved scheme.',
                });
              });
          } else if (activeCitizenAccountUser && citizenAuthToken) {
            fetch(`/api/citizen/saved-schemes/${encodeURIComponent(schemeId)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${citizenAuthToken}` },
            })
              .then(res =>
                parseApiResponse<{
                  items?: Array<{ schemeId: string; schemeTitle: string; savedAt: string }>;
                }>(res)
              )
              .then(parsed => {
                if (!parsed.ok) {
                  showToast({
                    type: 'error',
                    title: t('Remove Failed', 'हटाने में त्रुटि', 'हटावण मां दिक्कत आई'),
                    message: parsed.errorInfo?.error || 'Failed to remove saved scheme.',
                    details: parsed.errorInfo?.details,
                  });
                  return;
                }
                if (Array.isArray(parsed.data?.items)) {
                  setSavedSchemes(parsed.data.items);
                  showToast({
                    type: 'info',
                    title: t('Bookmark Removed', 'बुकमार्क हटाया गया', 'योजना सूची सूं हटाई'),
                    message: t('Removed scheme from your saved list.', 'योजना आपकी सहेजी सूची से हटाई गई।', 'योजना थारी संभाली सूची सूं हटा दी।'),
                  });
                }
              })
              .catch(err => {
                showToast({
                  type: 'error',
                  title: t('Remove Failed', 'हटाने में त्रुटि', 'हटावण मां दिक्कत आई'),
                  message:
                    err instanceof Error ? err.message : 'Failed to remove saved scheme.',
                });
              });
          }
        }}
        onSelectScheme={scheme => {
          setIntakeScheme(scheme);
        }}
        userEmail={activeCitizenHeaderUser?.email}
      />

      {/* Official Civic Footer (No Admin Links, safe bottom clearance for mobile tab bar) */}
      <footer className="bg-slate-900 text-slate-300 pt-10 pb-24 lg:pb-10 border-t border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-bold text-base font-heading">
              <Building2 className="w-5 h-5 text-amber-500" />
              <span>{t('YojanaSetu Indore', 'योजनासेतु इंदौर', 'योजनासेतु आपणो इंदौर')}</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              {t(
                'Real-time, centralized government scheme discovery & citizen entitlement platform for the citizens of Indore District and Madhya Pradesh.',
                'इंदौर जिले एवं मध्य प्रदेश के नागरिकों हेतु एकीकृत सरकारी योजना खोज एवं पात्रता मंच।',
                'इंदौर जिला अने मध्य प्रदेश रा सगळा भाई-बहनों खातर एक ही जगह सरकारी योजना खोजण अने हक पावण रो मंच।'
              )}
            </p>
            <div className="text-[11px] text-amber-400 font-mono">
              {t(
                'IMC Wards 1-85 • Janpads: Indore, Mhow, Sanwer, Depalpur',
                'नगर निगम वार्ड 1-85 • जनपद: इंदौर, महू, सांवेर, देपालपुर',
                'निगम वार्ड 1-85 • गाँव जनपद: इंदौर, महू, सांवेर, देपालपुर'
              )}
            </div>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
              {t('Governance Tiers', 'शासन के 6 स्तर', 'सरकार रा 6 स्तर')}
            </h5>
            <ul className="space-y-1.5 text-slate-400">
              <li>{t('Level 1: International & ADB Infra', 'स्तर 1: अंतर्राष्ट्रीय व ADB परियोजना', 'स्तर 1: अंतर्राष्ट्रीय व बड़ी मदद')}</li>
              <li>{t('Level 2: National / Central Sector', 'स्तर 2: राष्ट्रीय / केंद्र सरकार', 'स्तर 2: केंद्र सरकार री योजना')}</li>
              <li>{t('Level 3: Madhya Pradesh State', 'स्तर 3: मध्य प्रदेश राज्य शासन', 'स्तर 3: म.प्र. सरकार री योजना')}</li>
              <li>{t('Level 4: Indore Collectorate', 'स्तर 4: इंदौर कलेक्ट्रेट', 'स्तर 4: इंदौर कलेक्टर दफ्तर')}</li>
              <li>{t('Level 5: IMC Urban Wards (1-85)', 'स्तर 5: इंदौर नगर निगम वार्ड (1-85)', 'स्तर 5: इंदौर नगर निगम वार्ड (1-85)')}</li>
              <li>{t('Level 6: Rural Janpad Panchayats', 'स्तर 6: ग्रामीण जनपद पंचायतें', 'स्तर 6: गाँव री जनपद पंचायत')}</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
              {t('District Helplines', 'जिला हेल्पलाइन नंबर', 'जिला मदद नंबर')}
            </h5>
            <ul className="space-y-1.5 text-slate-400">
              <li>{t('CM Helpline MP:', 'सीएम हेल्पलाइन म.प्र.:', 'सीएम मदद नंबर:')} <strong className="text-white font-mono">181</strong></li>
              <li>{t('Indore 311 Municipal:', 'इंदौर 311 नगर निगम:', 'इंदौर नगर निगम मदद:')} <strong className="text-white font-mono">311</strong></li>
              <li>{t('Indore Collectorate:', 'इंदौर कलेक्ट्रेट:', 'इंदौर कलेक्टर दफ्तर:')} <strong className="text-white font-mono">0731-2433833</strong></li>
              <li>{t('Ayushman Bharat:', 'आयुष्मान भारत:', 'आयुष्मान इलाज मदद:')} <strong className="text-white font-mono">14555</strong></li>
              <li>{t('PM-KISAN Nodal:', 'पीएम-किसान नोडल:', 'पीएम-किसान मदद:')} <strong className="text-white font-mono">155261</strong></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">
              {t('Official Offices', 'आधिकारिक कार्यालय', 'सरकारी दफ्तर रो पतो')}
            </h5>
            <p className="text-slate-400 leading-relaxed">
              {t(
                'District Collector Office, Moti Tabela, Indore 452007',
                'जिला कलेक्टर कार्यालय, मोती तबेला, इंदौर 452007',
                'जिला कलेक्टर दफ्तर, मोती तबेला, इंदौर 452007'
              )}
              <br />
              {t(
                'Indore Municipal Corporation HQ, Narayan Singla Marg, Indore 452001',
                'इंदौर नगर निगम मुख्यालय, नारायण सिंगला मार्ग, इंदौर 452001',
                'इंदौर नगर निगम मुख्यालय, नारायण सिंगला मार्ग, इंदौर 452001'
              )}
            </p>
            <div className="mt-3 flex items-center space-x-1 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {t(
                  'Powered by NIC & MP State IT Policy',
                  'एनआईसी एवं म.प्र. राज्य आईटी नीति द्वारा संचालित',
                  'एनआईसी अने म.प्र. सरकार री डिजिटल सेवा'
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t border-slate-800 text-center text-[11px] text-slate-500">
          {t(
            '© 2026 YojanaSetu • District Administration Indore & Indore Municipal Corporation.',
            '© 2026 योजनासेतु • जिला प्रशासन इंदौर एवं इंदौर नगर निगम।',
            '© 2026 योजनासेतु • इंदौर जिला प्रशासन अने इंदौर नगर निगम।'
          )}
        </div>
      </footer>
    </div>
  );
}
