import React, { useState, useEffect, useCallback } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import {
  SupportedLanguage,
  UserMode,
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
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { EligibilityCalculator } from './components/EligibilityCalculator';
import { GovernanceLevelsView } from './components/GovernanceLevelsView';
import { SamagraFamilyView } from './components/SamagraFamilyView';
import { DigiLockerTrackerView } from './components/DigiLockerTrackerView';
import { ApplicationTrackerView } from './components/ApplicationTrackerView';
import { AdminDashboard } from './components/AdminDashboard';
import { ApplicationIntakeModal } from './components/ApplicationIntakeModal';
import { CitizenEntitlementCardModal } from './components/CitizenEntitlementCardModal';
import { SchemeComparisonModal } from './components/SchemeComparisonModal';
import { SavedSchemesModal } from './components/SavedSchemesModal';
import { AuthPage } from './components/AuthPage';
import {
  auth,
  AuthResult,
  fetchUserProfileFromFirestore,
  handleFirestoreError,
  logOutUser,
  mapUserProfileToCitizenProfile,
  OperationType,
  removeSavedSchemeFromUserFirestore,
  saveApplicationToFirestore,
  saveSchemeToUserFirestore,
  updateCitizenProfileInFirestore,
  UserProfileDoc,
  db,
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

const ACTIVE_SAMAGRA_STORAGE_KEY = 'yojanasetu_live_samagra_session';

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
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const [userMode, setUserMode] = useState<UserMode>('citizen');
  const [activeTab, setActiveTab] = useState<string>('schemes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [isEntitlementCardOpen, setIsEntitlementCardOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonInitialId, setComparisonInitialId] = useState<string | undefined>(undefined);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfileDoc, setUserProfileDoc] = useState<UserProfileDoc | null>(null);
  const [authBannerMessage, setAuthBannerMessage] = useState<string | null>(null);
  const [savedSchemes, setSavedSchemes] = useState<Array<{ schemeId: string; schemeTitle: string; savedAt: string }>>([]);
  const [isSavedSchemesOpen, setIsSavedSchemesOpen] = useState(false);

  // Clean unlinked initial citizen profile (zero demo defaults)
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfile>(() => createEmptyCitizenProfile());

  // 100% live backend-driven state
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [schemesRealtimeReport, setSchemesRealtimeReport] = useState<SchemesRealtimeReport | null>(null);
  const [isCheckingRealtime, setIsCheckingRealtime] = useState(false);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [samagraFamilies, setSamagraFamilies] = useState<SamagraFamily[]>([]);
  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
  const [intakeScheme, setIntakeScheme] = useState<Scheme | null>(null);

  const activeCitizenKey = citizenProfile.samagraMemberId || firebaseUser?.uid || null;

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

  const fetchLiveApplicationsAndStats = useCallback(async () => {
    try {
      const [appsRes, statsRes, famRes] = await Promise.all([
        fetch('/api/applications'),
        fetch('/api/stats'),
        fetch('/api/samagra'),
      ]);
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        if (Array.isArray(appsData?.records)) {
          setApplications(appsData.records);
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
          setSamagraFamilies(famData.families);
        }
      }
    } catch (err) {
      console.warn('Could not load live district data:', err);
    }
  }, []);

  const fetchLiveNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.notifications)) {
          setNotifications(data.notifications);
        }
      }
    } catch (err) {
      console.warn('Could not load live notifications:', err);
    }
  }, []);

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

  // Build CitizenProfile from a live Samagra Family member selection
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

  // Initial live hydration from SQLite APIs + restore active Samagra session if present
  useEffect(() => {
    fetchLiveSchemes();
    fetchLiveApplicationsAndStats();
    fetchLiveNotifications();

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
  }, [
    fetchLiveSchemes,
    fetchLiveApplicationsAndStats,
    fetchLiveNotifications,
    buildProfileFromSamagraMember,
    syncCitizenDigiLockerWallet,
  ]);

  // Sync DigiLocker whenever activeCitizenKey changes
  useEffect(() => {
    if (activeCitizenKey) {
      syncCitizenDigiLockerWallet(activeCitizenKey);
    }
  }, [activeCitizenKey, syncCitizenDigiLockerWallet]);

  // Subscribe to genuine live SSE events from server
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/stream/events');
      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (!data || data.type === 'connected') return;

          if (data.id && data.message) {
            setNotifications(prev => {
              if (prev.some(n => n.id === data.id)) return prev;
              return [data, ...prev.slice(0, 49)];
            });
          }

          if (data.eventType === 'application_updated' || data.eventType === 'samagra_updated') {
            fetchLiveApplicationsAndStats();
          } else if (data.eventType === 'digilocker_updated') {
            fetchLiveApplicationsAndStats();
          } else if (data.eventType === 'schemes_updated') {
            fetchLiveSchemes();
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
  }, [fetchLiveApplicationsAndStats, fetchLiveSchemes]);

  // Firebase Auth State Listener & Firestore UserProfile Hydration
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async user => {
      setFirebaseUser(user);
      if (user) {
        setAuthBannerMessage(null);
        try {
          const docData = await fetchUserProfileFromFirestore(user.uid);
          if (docData) {
            setUserProfileDoc(docData);
            setCitizenProfile(prev => mapUserProfileToCitizenProfile(docData, prev));
          } else {
            setCitizenProfile(prev => ({
              ...prev,
              fullName: user.displayName || prev.fullName,
            }));
          }
        } catch (err) {
          console.warn('Could not load Firestore user profile:', err);
          setCitizenProfile(prev => ({
            ...prev,
            fullName: user.displayName || prev.fullName,
          }));
        }
      } else {
        setUserProfileDoc(null);
        setSavedSchemes([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Firestore Real-Time Saved Schemes Listener
  useEffect(() => {
    if (!firebaseUser) return;

    const savedPath = `users/${firebaseUser.uid}/savedSchemes`;
    const savedSchemesCol = collection(db, 'users', firebaseUser.uid, 'savedSchemes');
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
  }, [firebaseUser]);

  const handleAuthSuccess = (result: AuthResult) => {
    setFirebaseUser(result.user);
    setUserProfileDoc(result.profile);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(result.profile, prev));
    setAuthBannerMessage(null);
  };

  const handleUpdateCitizenProfileInCloud = async (updates: Partial<UserProfileDoc>) => {
    if (!firebaseUser) return;
    const updatedDoc = await updateCitizenProfileInFirestore(firebaseUser.uid, updates);
    setUserProfileDoc(updatedDoc);
    setCitizenProfile(prev => mapUserProfileToCitizenProfile(updatedDoc, prev));
  };

  const handleSignOut = async () => {
    try {
      await logOutUser();
      setUserProfileDoc(null);
      setAuthBannerMessage(null);
    } catch (err) {
      console.error('Sign-Out failed:', err);
    }
  };

  const handleToggleSaveScheme = async (scheme: Scheme) => {
    if (!firebaseUser) {
      setAuthBannerMessage(`Sign in or register as a citizen to bookmark "${scheme.title}" to your cloud profile.`);
      setActiveTab('auth');
      return;
    }

    try {
      const isAlreadySaved = savedSchemes.some(s => s.schemeId === scheme.id);
      if (isAlreadySaved) {
        await removeSavedSchemeFromUserFirestore(firebaseUser.uid, scheme.id);
      } else {
        await saveSchemeToUserFirestore(firebaseUser.uid, scheme.id, scheme.title);
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

  // Live Admin Create Scheme
  const handleCreateLiveScheme = async (
    schemePayload: Partial<Scheme> & { id: string; title: string }
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemePayload),
      });
      if (!res.ok) return false;
      await fetchLiveSchemes();
      return true;
    } catch {
      return false;
    }
  };

  // Live DigiLocker Quick Verify (from Eligibility Calculator)
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
        fetchLiveApplicationsAndStats();
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
    fetchLiveApplicationsAndStats();
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

    if (firebaseUser) {
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
    setActiveTab('schemes');
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
    if (firebaseUser) {
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

  // Submit live application to SQLite + Firestore
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
        setApplications(prev => [data.record, ...prev.filter(a => a.arn !== data.record.arn)]);
        fetchLiveApplicationsAndStats();

        if (firebaseUser) {
          const targetScheme = schemes.find(s => s.id === appData.schemeId);
          saveApplicationToFirestore({
            arn: data.record.arn,
            schemeId: appData.schemeId,
            schemeName: targetScheme ? targetScheme.title : data.record.schemeTitle,
            applicantName: appData.applicantName,
            applicantUid: firebaseUser.uid,
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
    setActiveTab('tracker');
  };

  // Live Admin update application status
  const handleAdminUpdateApplicationStatus = async (
    arn: string,
    status: ApplicationRecord['currentStatus'],
    remarks?: string
  ) => {
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(arn)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.record) {
          setApplications(prev => prev.map(a => (a.arn === data.record.arn ? data.record : a)));
          fetchLiveApplicationsAndStats();
        }
      }
    } catch (err) {
      console.error('Admin application status update failed:', err);
    }
  };

  // Broadcast notification from admin
  const handleBroadcastNotification = async (notifData: {
    type: LiveNotification['type'];
    message: string;
    wardOrBlock: string;
    amount?: number;
  }) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifData),
      });
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-heading">
      {/* Global Header */}
      <Header
        currentLanguage={currentLanguage}
        setLanguage={setCurrentLanguage}
        userMode={userMode}
        setUserMode={setUserMode}
        onOpenSamagraModal={() => setActiveTab('samagra')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        firebaseUser={firebaseUser}
        onSignOut={handleSignOut}
        savedSchemesCount={savedSchemes.length}
        onOpenSavedSchemes={() => setIsSavedSchemesOpen(true)}
      />

      {/* Main Tab Content */}
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
                onNavigateToDigilocker={() => setActiveTab('digilocker')}
                onNavigateToSamagra={() => setActiveTab('samagra')}
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
              setActiveTab('schemes');
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
            onFamiliesChanged={fetchLiveApplicationsAndStats}
          />
        )}

        {activeTab === 'digilocker' && (
          <DigiLockerTrackerView
            currentLanguage={currentLanguage}
            profile={citizenProfile}
            citizenKey={activeCitizenKey}
            onSyncDocumentsFromServer={handleSyncDocumentsFromServer}
            onNavigateToSamagra={() => setActiveTab('samagra')}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            currentLanguage={currentLanguage}
            applications={applications}
            onNavigateToSchemes={() => setActiveTab('schemes')}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            currentLanguage={currentLanguage}
            notifications={notifications}
            applications={applications}
            schemes={schemes}
            samagraFamilies={samagraFamilies}
            stats={districtStats}
            schemesRealtimeReport={schemesRealtimeReport}
            isCheckingRealtime={isCheckingRealtime}
            onRunSchemesRealtimeCheck={handleRunSchemesRealtimeCheck}
            onUpdateApplicationStatus={handleAdminUpdateApplicationStatus}
            onCreateLiveScheme={handleCreateLiveScheme}
            onBroadcastNotification={handleBroadcastNotification}
            onFilterWardSchemes={(wardNum: number) => {
              setSearchQuery(`Ward ${wardNum}`);
              setUserMode('citizen');
              setActiveTab('schemes');
            }}
          />
        )}

        {activeTab === 'auth' && (
          <AuthPage
            currentLanguage={currentLanguage}
            firebaseUser={firebaseUser}
            userProfileDoc={userProfileDoc}
            citizenProfile={citizenProfile}
            onAuthSuccess={handleAuthSuccess}
            onSamagraSessionLogin={handleSamagraSessionLogin}
            onUpdateCitizenProfile={handleUpdateCitizenProfileInCloud}
            onSignOut={handleSignOut}
            onNavigateTab={setActiveTab}
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
          if (firebaseUser) {
            removeSavedSchemeFromUserFirestore(firebaseUser.uid, schemeId).catch(err =>
              console.error('Failed to remove saved scheme:', err)
            );
          }
        }}
        onSelectScheme={scheme => {
          setIntakeScheme(scheme);
        }}
        userEmail={firebaseUser?.email}
      />

      {/* Official Civic Footer */}
      <footer className="bg-slate-900 text-slate-300 py-10 border-t border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-bold text-base font-heading">
              <Building2 className="w-5 h-5 text-amber-500" />
              <span>YojanaSetu Indore</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Real-time, centralized government scheme discovery & citizen entitlement platform for the citizens of Indore District and Madhya Pradesh.
            </p>
            <div className="text-[11px] text-amber-400 font-mono">
              IMC Wards 1-85 • Janpads: Indore, Mhow, Sanwer, Depalpur
            </div>
          </div>

          <div>
            <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Governance Tiers</h5>
            <ul className="space-y-1.5 text-slate-400">
              <li>Level 1: International & ADB Infra</li>
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
              <span>Powered by NIC & MP State IT Policy</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t border-slate-800 text-center text-[11px] text-slate-500">
          © 2026 YojanaSetu • District Administration Indore & Indore Municipal Corporation.
        </div>
      </footer>
    </div>
  );
}
