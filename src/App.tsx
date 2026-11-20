import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, ShieldCheck, ShieldAlert, LogOut, Loader2, Lock } from 'lucide-react';
import {
  SupportedLanguage,
  CitizenProfile,
  Scheme,
  ApplicationRecord,
  LiveNotification,
  FamilyMember,
  SamagraFamily,
  GovernanceLevel,
  JanpadBlock,
  DistrictStats,
  DigiLockerDocumentRecord,
  SchemesRealtimeReport,
  VerifiedDocumentMeta,
} from './types';
import { searchSchemes } from './utils/searchEngine';
import { rankSchemesForCitizen } from './utils/rulesEngine';
import { createEmptyCitizenProfile, evaluateSchemesRealtimeStatus } from './utils/liveDataEngine';
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
const PORTAL_SCOPE_STORAGE_KEY = 'yojanasetu_portal_scope';
const MY_ARNS_STORAGE_KEY = 'yojanasetu_my_arns';

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
  docs: DigiLockerDocumentRecord[]
): Record<string, VerifiedDocumentMeta> {
  const map: Record<string, VerifiedDocumentMeta> = {};
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

  // Active Citizen Firebase session is strictly isolated from Admin sessions
  const activeCitizenFirebaseUser = portalScope === 'admin' ? null : firebaseUser;
  const activeCitizenKey =
    citizenProfile.samagraMemberId || activeCitizenFirebaseUser?.uid || null;

  const isVerifiedAdmin = Boolean(
    firebaseUser && portalScope === 'admin' && adminSession?.authenticated && adminSession.role === 'admin'
  );

  // Evaluate pure RBAC route guard decision
  const routeGuard = useMemo(
    () =>
      evaluateRouteAccess(pathname, {
        authInitialized,
        isAuthenticated: Boolean(firebaseUser),
        portalScope,
        verifiedAdminRole: Boolean(adminSession?.authenticated && adminSession.role === 'admin'),
      }),
    [pathname, authInitialized, firebaseUser, portalScope, adminSession]
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
      if (schemesRes.ok) {
        const data = await schemesRes.json();
        if (Array.isArray(data?.schemes)) {
          setSchemes(data.schemes);
          if (!statusRes.ok) {
            setSchemesRealtimeReport(evaluateSchemesRealtimeStatus(data.schemes));
          }
        }
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData?.report) {
          setSchemesRealtimeReport(statusData.report);
        }
      }
    } catch (err) {
      console.warn('Could not load live schemes:', err);
    }
  }, []);

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
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.records)) {
            for (const rec of data.records as ApplicationRecord[]) {
              collected.set(rec.arn, rec);
            }
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

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        if (Array.isArray(appsData?.records)) {
          setAdminApplications(appsData.records);
        }
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData?.stats) {
          setDistrictStats(statsData.stats);
        }
      }
      if (famRes.ok) {
        const famData = await famRes.json();
        if (Array.isArray(famData?.families)) {
          setAdminSamagraFamilies(famData.families);
        }
      }
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        if (Array.isArray(notifData?.notifications)) {
          setAdminNotifications(notifData.notifications);
        }
      }
    } catch (err) {
      console.warn('Could not load protected admin datasets:', err);
    }
  }, [isVerifiedAdmin, navigateTo]);

  const syncCitizenDigiLockerWallet = useCallback(async (citizenKey: string) => {
    try {
      const res = await fetch(`/api/digilocker/${encodeURIComponent(citizenKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.documents)) {
          const verifiedMap = mapDigiLockerRecordsToProfileMap(data.documents);
          setCitizenProfile(prev => ({
            ...prev,
            verifiedDocuments: verifiedMap,
          }));
        }
      }
    } catch (err) {
      console.warn('Could not sync DigiLocker wallet:', err);
    }
  }, []);

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

  // Initial public schemes load & Citizen Samagra session restore
  useEffect(() => {
    fetchLiveSchemes();

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

  // Sync DigiLocker whenever activeCitizenKey changes
  useEffect(() => {
    if (activeCitizenKey) {
      syncCitizenDigiLockerWallet(activeCitizenKey);
    }
  }, [activeCitizenKey, syncCitizenDigiLockerWallet]);

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
        setSavedSchemes([]);
        setAdminApplications([]);
        setAdminNotifications([]);
        setAdminSamagraFamilies([]);
        setDistrictStats(null);
        writePortalScope(null);
        setPortalScope(null);
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

  // Firestore Real-Time Saved Schemes Listener (Citizen scope only)
  useEffect(() => {
    if (!activeCitizenFirebaseUser) {
      setSavedSchemes([]);
      return;
    }

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
  }, [activeCitizenFirebaseUser]);

  // Citizen Auth Success Handler (strictly Citizen role & Citizen Dashboard)
  const handleCitizenAuthSuccess = (result: AuthResult) => {
    writePortalScope('citizen');
    setPortalScope('citizen');
    setAdminSession(null);
    setFirebaseUser(result.user);
    const citizenDoc: UserProfileDoc = { ...result.profile, role: 'citizen' };
    setUserProfileDoc(citizenDoc);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(citizenDoc, prev));
    setAuthBannerMessage(null);
    setCitizenSecurityBanner(null);
  };

  // Dedicated Admin Auth Success Handler (strictly verified Admin session -> /admin)
  const handleAdminAuthenticated = (result: AdminAuthResult) => {
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
    if (!activeCitizenFirebaseUser) return;
    const updatedDoc = await updateCitizenProfileInFirestore(activeCitizenFirebaseUser.uid, updates);
    const citizenDoc: UserProfileDoc = { ...updatedDoc, role: 'citizen' };
    setUserProfileDoc(citizenDoc);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(citizenDoc, prev));
  };

  const handleCitizenSignOut = async () => {
    try {
      await logOutUser();
      writePortalScope(null);
      setPortalScope(null);
      setUserProfileDoc(null);
      setAdminSession(null);
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
    if (!activeCitizenFirebaseUser) {
      setAuthBannerMessage(
        `Sign in or register as a citizen to bookmark "${scheme.title}" to your cloud profile.`
      );
      handleSelectCitizenTab('auth');
      return;
    }

    try {
      const isAlreadySaved = savedSchemes.some(s => s.schemeId === scheme.id);
      if (isAlreadySaved) {
        await removeSavedSchemeFromUserFirestore(activeCitizenFirebaseUser.uid, scheme.id);
      } else {
        await saveSchemeToUserFirestore(activeCitizenFirebaseUser.uid, scheme.id, scheme.title);
      }
    } catch (err) {
      console.error('Failed to update saved scheme in Firestore:', err);
      setAuthBannerMessage('Could not update saved scheme in cloud storage. Please try again.');
    }
  };

  // Run live server-side verification against official scheme portals
  const handleRunSchemesRealtimeCheck = async () => {
    setIsCheckingRealtime(true);
    try {
      const res = await fetch('/api/schemes/verify-realtime', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.schemes)) {
          setSchemes(data.schemes);
        }
        if (data?.report) {
          setSchemesRealtimeReport(data.report);
        }
      }
    } catch (err) {
      console.warn('Live schemes portal check failed:', err);
    } finally {
      setIsCheckingRealtime(false);
    }
  };

  // Live Admin Create Scheme (strictly authenticated with Admin Bearer token)
  const handleCreateLiveScheme = async (
    schemePayload: Partial<Scheme> & { id: string; title: string }
  ): Promise<boolean> => {
    if (!isVerifiedAdmin) return false;
    try {
      const authHeaders = await getAuthBearerHeader(false);
      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(schemePayload),
      });
      if (!res.ok) return false;
      await fetchLiveSchemes();
      await fetchAdminDistrictData();
      return true;
    } catch {
      return false;
    }
  };

  // Live DigiLocker Quick Verify (from Citizen Eligibility Calculator)
  const handleQuickVerifyDocument = async (docId: string, issuer: string): Promise<boolean> => {
    if (!activeCitizenKey) return false;
    try {
      const res = await fetch('/api/digilocker/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenKey: activeCitizenKey,
          docId,
          issuer,
          source: docId.startsWith('samagra') || docId === 'khasra_b1' ? 'mp_edistrict' : 'digilocker',
          wardOrBlock:
            citizenProfile.areaType === 'urban'
              ? `Ward ${citizenProfile.wardNumber || 1} (Indore IMC)`
              : `${citizenProfile.blockName || 'Indore'} Janpad`,
        }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (Array.isArray(data?.documents)) {
        setCitizenProfile(prev => ({
          ...prev,
          verifiedDocuments: mapDigiLockerRecordsToProfileMap(data.documents),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSyncDocumentsFromServer = (docs: DigiLockerDocumentRecord[]) => {
    setCitizenProfile(prev => ({
      ...prev,
      verifiedDocuments: mapDigiLockerRecordsToProfileMap(docs),
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

    if (activeCitizenFirebaseUser) {
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
      }).catch(err => console.warn('Firestore Samagra link sync warning:', err));
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
    if (activeCitizenFirebaseUser) {
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

  // Submit live application to SQLite + Firestore (Citizen action)
  const handleApplicationSubmit = async (appData: {
    schemeId: string;
    applicantName: string;
    samagraMemberId: string;
    samagraFamilyId: string;
    phone: string;
    wardOrBlock: string;
    areaType: 'urban' | 'rural';
  }) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData),
      });

      if (!res.ok) {
        throw new Error(`Application intake failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.record) {
        rememberMyArn(data.record.arn);
        setCitizenApplications(prev => [
          data.record,
          ...prev.filter(a => a.arn !== data.record.arn),
        ]);

        if (activeCitizenFirebaseUser) {
          const targetScheme = schemes.find(s => s.id === appData.schemeId);
          saveApplicationToFirestore({
            arn: data.record.arn,
            schemeId: appData.schemeId,
            schemeName: targetScheme ? targetScheme.title : data.record.schemeTitle,
            applicantName: appData.applicantName,
            applicantUid: activeCitizenFirebaseUser.uid,
            samagraId: appData.samagraMemberId,
            wardNumber: appData.areaType === 'urban' ? citizenProfile.wardNumber : undefined,
            status: 'Submitted',
            appliedAt: new Date().toISOString(),
            amountEstimated: targetScheme?.financialEntitlement?.amount || 0,
          }).catch(err => console.warn('Firestore app sync warning:', err));
        }
      }
    } catch (e) {
      console.error('Live application submission failed:', e);
    }

    setIntakeScheme(null);
    handleSelectCitizenTab('tracker');
  };

  // Live Admin update application status (strictly authenticated with Admin Bearer token)
  const handleAdminUpdateApplicationStatus = async (
    arn: string,
    status: ApplicationRecord['currentStatus'],
    remarks?: string
  ) => {
    if (!isVerifiedAdmin) return;
    try {
      const authHeaders = await getAuthBearerHeader(false);
      const res = await fetch(`/api/applications/${encodeURIComponent(arn)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ status, remarks }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.record) {
          setAdminApplications(prev =>
            prev.map(a => (a.arn === data.record.arn ? data.record : a))
          );
          fetchAdminDistrictData();
        }
      }
    } catch (err) {
      console.error('Admin application status update failed:', err);
    }
  };

  // Broadcast notification from admin (strictly authenticated with Admin Bearer token)
  const handleBroadcastNotification = async (notifData: {
    type: LiveNotification['type'];
    message: string;
    wardOrBlock: string;
    amount?: number;
  }) => {
    if (!isVerifiedAdmin) return;
    try {
      const authHeaders = await getAuthBearerHeader(false);
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(notifData),
      });
      if (res.ok) {
        fetchAdminDistrictData();
      }
    } catch (e) {
      console.warn('Broadcast API call failed:', e);
    }
  };

  // Filter schemes according to active search query & selected governance level
  const filteredSchemes = searchSchemes(searchQuery, schemes, {
    levelFilter: selectedLevel,
  });

  // Compute eligibility results for active citizen profile
  const eligibilityResults = rankSchemesForCitizen(citizenProfile, schemes);

  // ================= DEDICATED ADMIN LOGIN ROUTE (/admin/login) =================
  if (isAdminLoginPath(pathname)) {
    return (
      <AdminLoginPage
        onAdminAuthenticated={handleAdminAuthenticated}
        onReturnToCitizenPortal={() => {
          setAdminRedirectNotice(null);
          navigateTo(CITIZEN_DEFAULT_ROUTE);
        }}
        redirectNotice={adminRedirectNotice}
      />
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
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-heading">
      {/* Citizen-Only Header (Zero Admin Mode Switcher or Admin Links) */}
      <Header
        currentLanguage={currentLanguage}
        setLanguage={setCurrentLanguage}
        onOpenSamagraModal={() => handleSelectCitizenTab('samagra')}
        activeTab={activeTab}
        setActiveTab={handleSelectCitizenTab}
        firebaseUser={activeCitizenFirebaseUser}
        onSignOut={handleCitizenSignOut}
        savedSchemesCount={savedSchemes.length}
        onOpenSavedSchemes={() => setIsSavedSchemesOpen(true)}
      />

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
            />

            <div id="eligibility-calculator-section">
              <EligibilityCalculator
                schemes={filteredSchemes}
                currentLanguage={currentLanguage}
                profile={citizenProfile}
                setProfile={setCitizenProfile}
                citizenKey={activeCitizenKey}
                onQuickVerifyDocument={handleQuickVerifyDocument}
                onApplyScheme={scheme => setIntakeScheme(scheme)}
                onNavigateToDigilocker={() => handleSelectCitizenTab('digilocker')}
                onNavigateToSamagra={() => handleSelectCitizenTab('samagra')}
                schemesRealtimeReport={schemesRealtimeReport}
                isCheckingRealtime={isCheckingRealtime}
                onRunSchemesRealtimeCheck={handleRunSchemesRealtimeCheck}
                savedSchemeIds={savedSchemes.map(s => s.schemeId)}
                onToggleSaveScheme={handleToggleSaveScheme}
              />
            </div>
          </div>
        )}

        {activeTab === 'governance' && (
          <GovernanceLevelsView
            currentLanguage={currentLanguage}
            schemes={schemes}
            onSelectLevel={(lvl: GovernanceLevel) => {
              setSelectedLevel(lvl);
              handleSelectCitizenTab('schemes');
            }}
          />
        )}

        {activeTab === 'samagra' && (
          <SamagraFamilyView
            currentLanguage={currentLanguage}
            schemes={schemes}
            activeFamilyId={citizenProfile.samagraFamilyId}
            activeMemberId={citizenProfile.samagraMemberId}
            onSelectMemberForProfile={handleSelectMemberForProfile}
            onFamiliesChanged={fetchCitizenScopedApplications}
          />
        )}

        {activeTab === 'digilocker' && (
          <DigiLockerTrackerView
            currentLanguage={currentLanguage}
            profile={citizenProfile}
            citizenKey={activeCitizenKey}
            onSyncDocumentsFromServer={handleSyncDocumentsFromServer}
            onNavigateToSamagra={() => handleSelectCitizenTab('samagra')}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            currentLanguage={currentLanguage}
            applications={citizenApplications}
            onNavigateToSchemes={() => handleSelectCitizenTab('schemes')}
          />
        )}

        {activeTab === 'auth' && (
          <AuthPage
            currentLanguage={currentLanguage}
            firebaseUser={activeCitizenFirebaseUser}
            userProfileDoc={userProfileDoc}
            citizenProfile={citizenProfile}
            onAuthSuccess={handleCitizenAuthSuccess}
            onSamagraSessionLogin={handleSamagraSessionLogin}
            onUpdateCitizenProfile={handleUpdateCitizenProfileInCloud}
            onSignOut={handleCitizenSignOut}
            onNavigateTab={handleSelectCitizenTab}
            onOpenSavedSchemes={() => setIsSavedSchemesOpen(true)}
            savedSchemesCount={savedSchemes.length}
            authBannerMessage={authBannerMessage}
          />
        )}
      </main>

      {/* Online Application Intake Modal */}
      <ApplicationIntakeModal
        scheme={intakeScheme}
        profile={citizenProfile}
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
        schemes={schemes}
        currentLanguage={currentLanguage}
        initialSchemeId={comparisonInitialId}
      />

      {/* Cloud Saved Schemes Modal (Firestore) */}
      <SavedSchemesModal
        isOpen={isSavedSchemesOpen}
        onClose={() => setIsSavedSchemesOpen(false)}
        savedSchemes={savedSchemes}
        allSchemes={schemes}
        onRemoveScheme={schemeId => {
          if (activeCitizenFirebaseUser) {
            removeSavedSchemeFromUserFirestore(activeCitizenFirebaseUser.uid, schemeId).catch(
              err => console.error('Failed to remove saved scheme:', err)
            );
          }
        }}
        onSelectScheme={scheme => {
          setIntakeScheme(scheme);
        }}
        userEmail={activeCitizenFirebaseUser?.email}
      />

      {/* Official Civic Footer (No Admin Links) */}
      <footer className="bg-slate-900 text-slate-300 py-10 border-t border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-bold text-base font-heading">
              <Building2 className="w-5 h-5 text-amber-500" />
              <span>YojanaSetu Indore</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Real-time, centralized government scheme discovery &amp; citizen entitlement platform for the citizens of Indore District and Madhya Pradesh.
            </p>
            <div className="text-[11px] text-amber-400 font-mono">
              IMC Wards 1-85 • Janpads: Indore, Mhow, Sanwer, Depalpur
            </div>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Governance Tiers</h5>
            <ul className="space-y-1.5 text-slate-400">
              <li>Level 1: International &amp; ADB Infra</li>
              <li>Level 2: National / Central Sector</li>
              <li>Level 3: Madhya Pradesh State</li>
              <li>Level 4: Indore Collectorate</li>
              <li>Level 5: IMC Urban Wards (1-85)</li>
              <li>Level 6: Rural Janpad Panchayats</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">District Helplines</h5>
            <ul className="space-y-1.5 text-slate-400">
              <li>CM Helpline MP: <strong className="text-white font-mono">181</strong></li>
              <li>Indore 311 Municipal: <strong className="text-white font-mono">311</strong></li>
              <li>Indore Collectorate: <strong className="text-white font-mono">0731-2433833</strong></li>
              <li>Ayushman Bharat: <strong className="text-white font-mono">14555</strong></li>
              <li>PM-KISAN Nodal: <strong className="text-white font-mono">155261</strong></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Official Offices</h5>
            <p className="text-slate-400 leading-relaxed">
              District Collector Office, Moti Tabela, Indore 452007<br />
              Indore Municipal Corporation HQ, Narayan Singla Marg, Indore 452001
            </p>
            <div className="mt-3 flex items-center space-x-1 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Powered by NIC &amp; MP State IT Policy</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t border-slate-800 text-center text-[11px] text-slate-500">
          © 2026 YojanaSetu • District Administration Indore &amp; Indore Municipal Corporation.
        </div>
      </footer>
    </div>
  );
}
