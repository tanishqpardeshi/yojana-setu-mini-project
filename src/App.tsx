import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight, 
  MapPin, 
  PhoneCall,
  User,
  HeartHandshake
} from 'lucide-react';
import { 
  SupportedLanguage, 
  UserMode, 
  CitizenProfile, 
  Scheme, 
  ApplicationRecord, 
  LiveNotification, 
  FamilyMember, 
  SamagraFamily,
  GovernanceLevel 
} from './types';
import { SCHEMES_DATABASE } from './data/schemesData';
import { INITIAL_APPLICATION_RECORDS, INITIAL_NOTIFICATIONS, MOCK_SAMAGRA_FAMILIES } from './data/samagraMockProfiles';
import { searchSchemes } from './utils/searchEngine';
import { rankSchemesForCitizen } from './utils/rulesEngine';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { EligibilityCalculator } from './components/EligibilityCalculator';
import { GovernanceLevelsView } from './components/GovernanceLevelsView';
import { SamagraFamilyView } from './components/SamagraFamilyView';
import { DigiLockerTrackerView } from './components/DigiLockerTrackerView';
import { ApplicationTrackerView } from './components/ApplicationTrackerView';
import { YojanaMitraChatbot } from './components/YojanaMitraChatbot';
import { CscOperatorMode } from './components/CscOperatorMode';
import { AdminDashboard } from './components/AdminDashboard';
import { ApplicationIntakeModal } from './components/ApplicationIntakeModal';
import { CitizenEntitlementCardModal } from './components/CitizenEntitlementCardModal';
import { SchemeComparisonModal } from './components/SchemeComparisonModal';

export default function App() {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const [userMode, setUserMode] = useState<UserMode>('citizen');
  const [activeTab, setActiveTab] = useState<string>('schemes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [isEntitlementCardOpen, setIsEntitlementCardOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonInitialId, setComparisonInitialId] = useState<string | undefined>(undefined);

  // Default active profile (Sunita Sharma, Vijay Nagar Ward 72, Urban IMC)
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfile>({
    fullName: 'Sunita Sharma',
    age: 43,
    gender: 'female',
    category: 'GEN',
    areaType: 'urban',
    wardNumber: 72,
    annualIncome: 120000,
    occupation: 'Homemaker',
    landHoldingHectares: 0,
    isBPL: false,
    hasDisability: false,
    maritalStatus: 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    samagraFamilyId: '48921840',
    samagraMemberId: '109283742',
    verifiedDocuments: {
      samagra_family: { verified: true, source: 'mp_edistrict', docNumber: 'SPR-48921840' },
      samagra_member: { verified: true, source: 'mp_edistrict', docNumber: 'SPR-109283742' },
      aadhaar: { verified: true, source: 'digilocker', docNumber: 'DL-UID-881923' },
      bank_dbt: { verified: true, source: 'digilocker', docNumber: 'NPCI-BOI-8192' },
      mp_domicile: { verified: true, source: 'digilocker', docNumber: 'MP-DOM-2024-912' },
    },
  });

  const [schemes, setSchemes] = useState<Scheme[]>(SCHEMES_DATABASE);
  const [applications, setApplications] = useState<ApplicationRecord[]>(INITIAL_APPLICATION_RECORDS);
  const [notifications, setNotifications] = useState<LiveNotification[]>(INITIAL_NOTIFICATIONS);
  const [intakeScheme, setIntakeScheme] = useState<Scheme | null>(null);
  const [isSamagraModalOpen, setIsSamagraModalOpen] = useState(false);

  // Load initial data from backend SQLite APIs
  useEffect(() => {
    fetch('/api/schemes')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.schemes && Array.isArray(data.schemes) && data.schemes.length > 0) {
          setSchemes(data.schemes);
        }
      })
      .catch(err => console.warn('Schemes fetch fallback to local data:', err));

    fetch('/api/applications')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.records && Array.isArray(data.records) && data.records.length > 0) {
          setApplications(data.records);
        }
      })
      .catch(err => console.warn('Applications fetch fallback to local data:', err));
  }, []);

  // Subscribe to live SSE events from server
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/stream/events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type !== 'connected' && data.id) {
            setNotifications(prev => [data, ...prev.slice(0, 49)]);
          }
        } catch (e) {
          // parse error
        }
      };
    } catch (err) {
      console.warn('SSE connection error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Filter schemes according to active search query & selected governance level
  const filteredSchemes = searchSchemes(searchQuery, schemes, {
    levelFilter: selectedLevel,
  });

  // Handle member selection from Samagra Family tree
  const handleSelectMemberForProfile = (member: FamilyMember, family: SamagraFamily) => {
    setCitizenProfile({
      fullName: member.name,
      age: member.age,
      gender: member.gender,
      category: family.familyId === '84019283' ? 'ST' : family.familyId === '71203945' ? 'OBC' : 'GEN',
      areaType: family.areaType,
      wardNumber: family.areaType === 'urban' ? 72 : undefined,
      blockName: family.areaType === 'rural' ? (family.wardOrBlock.includes('Depalpur') ? 'Depalpur' : 'Mhow') : undefined,
      annualIncome: member.annualIncome || (family.rationCardType === 'BPL' ? 120000 : 250000),
      occupation: member.occupation,
      landHoldingHectares: member.occupation === 'Farmer' ? 1.8 : 0,
      isBPL: family.rationCardType === 'BPL' || family.rationCardType === 'Antyodaya',
      hasDisability: false,
      maritalStatus: member.maritalStatus || 'Married',
      isMpDomicile: true,
      isIndoreResident: true,
      samagraFamilyId: family.familyId,
      samagraMemberId: member.memberId,
      verifiedDocuments: {
        samagra_family: { verified: true, source: 'mp_edistrict', docNumber: `SPR-${family.familyId}` },
        samagra_member: { verified: member.ekycStatus, source: 'mp_edistrict', docNumber: `SPR-${member.memberId}` },
        aadhaar: { verified: member.ekycStatus, source: 'digilocker', docNumber: 'DL-UIDAI-MP' },
        bank_dbt: { verified: member.dbtActive, source: 'digilocker', docNumber: 'NPCI-DBT-ACT' },
        mp_domicile: { verified: true, source: 'digilocker', docNumber: 'MP-DOM-RSK' },
        khasra_b1: { verified: member.occupation === 'Farmer', source: 'mp_edistrict', docNumber: 'B1-142/1' },
      },
    });
    setActiveTab('schemes');
  };

  // Submit online application
  const handleApplicationSubmit = async (appData: {
    schemeId: string;
    applicantName: string;
    samagraMemberId: string;
    samagraFamilyId: string;
    phone: string;
    wardOrBlock: string;
    areaType: 'urban' | 'rural';
    kioskOperatorCode?: string;
  }) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.record) {
          setApplications(prev => [data.record, ...prev]);
        }
      }
    } catch (e) {
      console.warn('Backend intake failed, creating local record:', e);
      // Fallback local record
      const randomArn = `YS-IND-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      const targetScheme = SCHEMES_DATABASE.find(s => s.id === appData.schemeId);
      const newRec: ApplicationRecord = {
        arn: randomArn,
        schemeId: appData.schemeId,
        schemeTitle: targetScheme ? targetScheme.title : 'Government Scheme',
        schemeTitleHindi: targetScheme ? targetScheme.titleHindi : 'शासकीय योजना',
        applicantName: appData.applicantName,
        samagraMemberId: appData.samagraMemberId,
        samagraFamilyId: appData.samagraFamilyId,
        phone: appData.phone,
        wardOrBlock: appData.wardOrBlock,
        areaType: appData.areaType,
        appliedDate: new Date().toISOString().split('T')[0],
        currentStatus: 'submitted',
        officerInCharge: 'Nodal Verification Officer, Indore Collectorate',
        sanctionAmount: targetScheme?.financialEntitlement?.amount || 0,
        remarks: 'Digital intake logged successfully.',
        timeline: [
          {
            title: 'Application Intake Submitted',
            titleHindi: 'आवेदन दर्ज हुआ',
            date: 'Today 11:30 AM',
            location: 'YojanaSetu Direct Portal',
            status: 'completed',
          },
          {
            title: 'Ward Field Verification',
            titleHindi: 'वार्ड भौतिक सत्यापन',
            date: 'In Progress',
            location: appData.wardOrBlock,
            status: 'in_progress',
          },
        ],
      };
      setApplications(prev => [newRec, ...prev]);
    }

    setIntakeScheme(null);
    setActiveTab('tracker');
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
                onApplyScheme={(scheme, prof) => setIntakeScheme(scheme)}
                onNavigateToDigilocker={() => setActiveTab('digilocker')}
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
            onSelectMemberForProfile={handleSelectMemberForProfile}
          />
        )}

        {activeTab === 'digilocker' && (
          <DigiLockerTrackerView
            currentLanguage={currentLanguage}
            profile={citizenProfile}
            setProfile={setCitizenProfile}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            currentLanguage={currentLanguage}
            applications={applications}
          />
        )}

        {activeTab === 'yojanamitra' && (
          <YojanaMitraChatbot
            currentLanguage={currentLanguage}
          />
        )}

        {activeTab === 'csc' && (
          <CscOperatorMode
            currentLanguage={currentLanguage}
            schemes={schemes}
            onSubmitApplication={handleApplicationSubmit}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            currentLanguage={currentLanguage}
            notifications={notifications}
            onBroadcastNotification={handleBroadcastNotification}
            onFilterWardSchemes={(wardNum: number) => {
              setSearchQuery(`Ward ${wardNum}`);
              setActiveTab('schemes');
            }}
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
          © 2026 YojanaSetu • District Administration Indore & Indore Municipal Corporation. Designed with accessible civic tech principles.
        </div>
      </footer>
    </div>
  );
}
