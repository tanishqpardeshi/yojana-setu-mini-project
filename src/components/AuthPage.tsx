import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  LogOut,
  Users,
  Bookmark,
  FileText,
  Sparkles,
  Loader2,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  AreaType,
  Category,
  CitizenAccountProfile,
  CitizenProfile,
  FamilyMember,
  Gender,
  JanpadBlock,
  MaritalStatus,
  OccupationType,
  SamagraFamily,
  SupportedLanguage,
} from '../types';
import {
  AuthResult,
  signInWithGoogle,
  UserProfileDoc,
} from '../firebase';
import { ToastItem } from './ToastContainer';
import { ApiRequestError, parseApiResponse } from '../utils/apiClient';
import { MobileOtpVerifier } from './MobileOtpVerifier';
import {
  SAMAGRA_PORTAL_URL,
  validateIndianMobile,
  validateSamagraFamilyId,
  validateSamagraLookupId,
  validateSamagraMemberId,
} from '../utils/samagraValidator';

interface AuthPageProps {
  currentLanguage: SupportedLanguage;
  firebaseUser: FirebaseUser | null;
  citizenAccountUser: CitizenAccountProfile | null;
  citizenAuthToken?: string | null;
  userProfileDoc: UserProfileDoc | null;
  citizenProfile: CitizenProfile;
  onAuthSuccess: (result: AuthResult) => void;
  onEmailAuthSuccess: (token: string, profile: CitizenAccountProfile) => void;
  onSamagraSessionLogin: (member: FamilyMember, family: SamagraFamily) => Promise<void>;
  onUpdateCitizenProfile: (updates: Partial<UserProfileDoc>) => Promise<void>;
  onSignOut: () => Promise<void>;
  onNavigateTab: (tab: string) => void;
  onOpenSavedSchemes: () => void;
  savedSchemesCount: number;
  initialMode?: 'login' | 'signup';
  authBannerMessage?: string | null;
  onNotify?: (toast: Omit<ToastItem, 'id'>) => void;
}

const OCCUPATIONS: OccupationType[] = [
  'Homemaker',
  'Farmer',
  'Street Vendor',
  'Student',
  'Construction Worker',
  'Artisan / Handicraft',
  'Gig Worker / Driver',
  'Small Business',
  'Unemployed',
  'Senior Citizen',
  'Other',
];

const CATEGORIES: Category[] = ['GEN', 'OBC', 'SC', 'ST', 'EWS'];
const JANPAD_BLOCKS: JanpadBlock[] = ['Indore', 'Mhow', 'Sanwer', 'Depalpur'];
const MARITAL_STATUSES: MaritalStatus[] = ['Married', 'Unmarried', 'Widow', 'Divorced'];

function formatAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const rawMsg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before completing login. Please try again.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Google Sign-In. Please check Firebase project domain settings.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many authentication attempts. Please wait a few moments before trying again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error communicating with authentication server. Check your connection and retry.';
  }
  return rawMsg || 'Authentication failed. Please try again.';
}

export const AuthPage: React.FC<AuthPageProps> = ({
  currentLanguage,
  firebaseUser,
  citizenAccountUser,
  citizenAuthToken,
  userProfileDoc,
  citizenProfile,
  onAuthSuccess,
  onEmailAuthSuccess,
  onSamagraSessionLogin,
  onUpdateCitizenProfile,
  onSignOut,
  onNavigateTab,
  onOpenSavedSchemes,
  savedSchemesCount,
  initialMode = 'login',
  authBannerMessage,
  onNotify,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(initialMode);
  const [authMethod, setAuthMethod] = useState<'google' | 'samagra' | 'email'>('google');

  // Form states for Email Login / Citizen Registration
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Citizen demographic registration fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [mobileVerificationToken, setMobileVerificationToken] = useState<string | null>(null);
  const [samagraFamilyId, setSamagraFamilyId] = useState('');
  const [samagraMemberId, setSamagraMemberId] = useState('');
  const [areaType, setAreaType] = useState<AreaType>('urban');
  const [wardNumber, setWardNumber] = useState<number>(72);
  const [blockName, setBlockName] = useState<JanpadBlock>('Indore');
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState<Gender>('female');
  const [category, setCategory] = useState<Category>('GEN');
  const [occupation, setOccupation] = useState<OccupationType>('Homemaker');
  const [annualIncome, setAnnualIncome] = useState<number>(150000);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>('Married');
  const [isBPL, setIsBPL] = useState(false);
  const [hasDisability, setHasDisability] = useState(false);
  const [isMpDomicile, setIsMpDomicile] = useState(true);
  const [isIndoreResident, setIsIndoreResident] = useState(true);

  // Samagra lookup state (live API only)
  const [samagraQuery, setSamagraQuery] = useState('');
  const [samagraFamilyResult, setSamagraFamilyResult] = useState<SamagraFamily | null>(null);
  const [liveSamagraList, setLiveSamagraList] = useState<SamagraFamily[]>([]);
  const [samagraLoading, setSamagraLoading] = useState(false);
  const [samagraError, setSamagraError] = useState<string | null>(null);
  const [samagraNotice, setSamagraNotice] = useState<string | null>(null);
  const [samagraPortalFallback, setSamagraPortalFallback] = useState<{
    error: string;
    details?: string;
    portalUrl?: string;
    allowManualEntry?: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('yojanasetu_my_samagra_ids');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const candidateIds = Array.from(
        new Set(
          [citizenProfile.samagraFamilyId, ...(Array.isArray(ids) ? ids : [])].filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        )
      ).slice(0, 5);

      if (candidateIds.length === 0) return;

      Promise.all(
        candidateIds.map(id =>
          fetch(`/api/samagra/${encodeURIComponent(id)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => (d?.family as SamagraFamily) || null)
            .catch(() => null)
        )
      ).then(results => {
        setLiveSamagraList(results.filter((f): f is SamagraFamily => f !== null));
      });
    } catch {
      // ignore storage errors
    }
  }, [citizenProfile.samagraFamilyId]);

  // Operational state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeCitizenUser = firebaseUser || citizenAccountUser;
  const activeAccountProfile = citizenAccountUser || userProfileDoc;

  // Sync profile completion editor when signed in
  useEffect(() => {
    if (activeCitizenUser) {
      const acctMobile = activeAccountProfile?.mobileNumber || activeAccountProfile?.phone || '';
      setFullName(activeAccountProfile?.displayName || activeCitizenUser.displayName || citizenProfile.fullName);
      setPhone(acctMobile);
      setMobileVerified(Boolean(activeAccountProfile?.mobileVerified));
      setMobileVerificationToken(null);
      setSamagraFamilyId(activeAccountProfile?.samagraFamilyId || citizenProfile.samagraFamilyId || '');
      setSamagraMemberId(activeAccountProfile?.samagraMemberId || citizenProfile.samagraMemberId || '');
      setAreaType(activeAccountProfile?.areaType || citizenProfile.areaType);
      setWardNumber(activeAccountProfile?.wardNumber ?? citizenProfile.wardNumber ?? 72);
      setBlockName(activeAccountProfile?.blockName || citizenProfile.blockName || 'Indore');
      setAge(activeAccountProfile?.age ?? citizenProfile.age);
      setGender(activeAccountProfile?.gender || citizenProfile.gender);
      setCategory(activeAccountProfile?.category || citizenProfile.category);
      setOccupation(activeAccountProfile?.occupation || citizenProfile.occupation);
      setAnnualIncome(activeAccountProfile?.annualIncome ?? citizenProfile.annualIncome);
      setMaritalStatus(activeAccountProfile?.maritalStatus || citizenProfile.maritalStatus);
      setIsBPL(activeAccountProfile?.isBPL ?? citizenProfile.isBPL);
      setHasDisability(activeAccountProfile?.hasDisability ?? citizenProfile.hasDisability);
      setIsMpDomicile(activeAccountProfile?.isMpDomicile ?? citizenProfile.isMpDomicile);
      setIsIndoreResident(activeAccountProfile?.isIndoreResident ?? citizenProfile.isIndoreResident);
    }
  }, [activeCitizenUser, activeAccountProfile, citizenProfile]);

  const handlePhoneInputChange = (nextVal: string) => {
    setPhone(nextVal);
    setMobileVerificationToken(null);
    const savedMobile = activeAccountProfile?.mobileNumber || activeAccountProfile?.phone || '';
    const savedCheck = validateIndianMobile(savedMobile);
    const nextCheck = validateIndianMobile(nextVal);
    if (
      activeCitizenUser &&
      activeAccountProfile?.mobileVerified &&
      savedCheck.valid &&
      nextCheck.valid &&
      savedCheck.e164 === nextCheck.e164
    ) {
      setMobileVerified(true);
    } else {
      setMobileVerified(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setErrorMsg(null);
    setErrorDetails(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithGoogle();
      onAuthSuccess(result);
    } catch (err) {
      const msg = formatAuthErrorMessage(err);
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setErrorDetails(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    if (authMode === 'signup') {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name as per Aadhaar / Samagra.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      if (phone.trim()) {
        const phoneCheck = validateIndianMobile(phone);
        if (!phoneCheck.valid) {
          setErrorMsg(
            phoneCheck.error ||
              'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).'
          );
          return;
        }
      }
      if (samagraFamilyId.trim()) {
        const famCheck = validateSamagraFamilyId(samagraFamilyId);
        if (!famCheck.valid) {
          setErrorMsg(famCheck.error || 'Samagra Family ID must be exactly 8 numeric digits.');
          return;
        }
      }
      if (samagraMemberId.trim()) {
        const memCheck = validateSamagraMemberId(samagraMemberId);
        if (!memCheck.valid) {
          setErrorMsg(memCheck.error || 'Samagra Member ID must be exactly 9 numeric digits.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        const res = await fetch('/api/citizen/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });
        const parsed = await parseApiResponse<{ token?: string; profile?: CitizenAccountProfile }>(res);
        if (!parsed.ok || !parsed.data?.token || !parsed.data?.profile) {
          const errInfo = parsed.errorInfo || {
            status: parsed.status,
            error: 'Invalid email or password. Please verify your credentials.',
          };
          onNotify?.({
            type: 'error',
            title: 'Citizen Sign-In Failed',
            message: errInfo.error,
            details: errInfo.details,
          });
          throw new ApiRequestError(errInfo);
        }
        onEmailAuthSuccess(parsed.data.token, parsed.data.profile);
      } else {
        const safeWard = Math.min(85, Math.max(1, Number.isFinite(wardNumber) ? Math.round(wardNumber) : 72));
        const safeAge = Math.min(120, Math.max(0, Number.isFinite(age) ? Math.round(age) : 30));
        const safeIncome = Math.max(0, Number.isFinite(annualIncome) ? Math.round(annualIncome) : 0);
        const mobileCheck = phone.trim() ? validateIndianMobile(phone) : null;

        const res = await fetch('/api/citizen/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
            displayName: fullName.trim(),
            mobileNumber: mobileCheck?.valid ? mobileCheck.e164 : undefined,
            phone: mobileCheck?.valid ? mobileCheck.e164 : undefined,
            mobileVerificationToken: mobileVerificationToken || undefined,
            samagraFamilyId: samagraFamilyId.trim() || undefined,
            samagraMemberId: samagraMemberId.trim() || undefined,
            areaType,
            wardNumber: areaType === 'urban' ? safeWard : undefined,
            blockName: areaType === 'rural' ? blockName : undefined,
            category,
            age: safeAge,
            gender,
            annualIncome: safeIncome,
            occupation,
            isBPL,
            hasDisability,
            maritalStatus,
            isMpDomicile,
            isIndoreResident,
          }),
        });

        const parsed = await parseApiResponse<{ token?: string; profile?: CitizenAccountProfile }>(res);
        if (!parsed.ok || !parsed.data?.token || !parsed.data?.profile) {
          const errInfo = parsed.errorInfo || {
            status: parsed.status,
            error: 'Failed to create citizen account. Please try again.',
          };
          onNotify?.({
            type: 'error',
            title: 'Registration Failed',
            message: errInfo.error,
            details: errInfo.details,
          });
          throw new ApiRequestError(errInfo);
        }

        const createdProfile = parsed.data.profile;
        if (createdProfile.samagraFamilyId) {
          try {
            const prevRaw = localStorage.getItem('yojanasetu_my_samagra_ids');
            const prevIds = prevRaw ? JSON.parse(prevRaw) : [];
            const nextIds = Array.from(
              new Set([createdProfile.samagraFamilyId, ...(Array.isArray(prevIds) ? prevIds : [])])
            ).slice(0, 12);
            localStorage.setItem('yojanasetu_my_samagra_ids', JSON.stringify(nextIds));
          } catch {
            // ignore storage errors
          }
        }

        onEmailAuthSuccess(parsed.data.token, createdProfile);
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setErrorDetails(err.details || null);
      } else {
        setErrorMsg(formatAuthErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSamagraSearch = async (queryId?: string) => {
    if (samagraLoading) return;
    const idToSearch = (queryId ?? samagraQuery).trim();
    const validation = validateSamagraLookupId(idToSearch);
    if (!validation.valid) {
      setSamagraFamilyResult(null);
      setSamagraPortalFallback(null);
      setSamagraNotice(null);
      setSamagraError(validation.error || 'Enter a valid 8-digit Family ID or 9-digit Member ID.');
      return;
    }

    setSamagraLoading(true);
    setSamagraError(null);
    setSamagraNotice(null);
    setSamagraPortalFallback(null);
    try {
      const res = await fetch(`/api/samagra/${encodeURIComponent(validation.cleaned)}`);
      const parsed = await parseApiResponse<{
        family?: SamagraFamily;
        source?: string;
        liveConfigured?: boolean;
        notice?: string;
      }>(res);
      if (parsed.ok && parsed.data?.family) {
        setSamagraFamilyResult(parsed.data.family);
        setSamagraNotice(parsed.data.notice || null);
        setSamagraPortalFallback(null);
        return;
      }

      const errInfo = parsed.errorInfo || {
        status: parsed.status,
        error: `No verified Samagra record found for "${validation.cleaned}".`,
        portalUrl: SAMAGRA_PORTAL_URL,
        allowManualEntry: true,
      };
      setSamagraFamilyResult(null);
      setSamagraError(errInfo.error);
      setSamagraPortalFallback({
        error: errInfo.error,
        details: errInfo.details,
        portalUrl: errInfo.portalUrl || SAMAGRA_PORTAL_URL,
        allowManualEntry: errInfo.allowManualEntry ?? true,
      });
      onNotify?.({
        type: 'warning',
        title: 'Samagra Lookup Notice',
        message: errInfo.error,
        details: errInfo.details,
        actionUrl: errInfo.portalUrl || SAMAGRA_PORTAL_URL,
        actionLabel: 'Verify on samagra.gov.in',
      });
    } catch {
      const msg = 'Unable to reach live Samagra directory API. Please try again.';
      setSamagraFamilyResult(null);
      setSamagraError(msg);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    } finally {
      setSamagraLoading(false);
    }
  };

  const handleSaveProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setErrorDetails(null);
    setSuccessMsg(null);

    if (phone.trim()) {
      const mobileCheck = validateIndianMobile(phone);
      if (!mobileCheck.valid) {
        setErrorMsg(
          mobileCheck.error ||
            'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).'
        );
        return;
      }
    }
    if (samagraFamilyId.trim()) {
      const famCheck = validateSamagraFamilyId(samagraFamilyId);
      if (!famCheck.valid) {
        setErrorMsg(famCheck.error || 'Samagra Family ID must be exactly 8 numeric digits.');
        return;
      }
    }
    if (samagraMemberId.trim()) {
      const memCheck = validateSamagraMemberId(samagraMemberId);
      if (!memCheck.valid) {
        setErrorMsg(memCheck.error || 'Samagra Member ID must be exactly 9 numeric digits.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const safeWard = Math.min(85, Math.max(1, Number.isFinite(wardNumber) ? Math.round(wardNumber) : 72));
      const safeAge = Math.min(120, Math.max(0, Number.isFinite(age) ? Math.round(age) : 30));
      const safeIncome = Math.max(0, Number.isFinite(annualIncome) ? Math.round(annualIncome) : 0);
      const mobileCheck = phone.trim() ? validateIndianMobile(phone) : null;

      await onUpdateCitizenProfile({
        displayName: fullName.trim() || activeCitizenUser?.displayName || 'Citizen of Indore',
        phone: mobileCheck?.valid ? mobileCheck.e164 : '',
        mobileNumber: mobileCheck?.valid ? mobileCheck.e164 : '',
        mobileVerified,
        mobileVerificationToken: mobileVerificationToken || undefined,
        samagraFamilyId: samagraFamilyId.trim() || undefined,
        samagraMemberId: samagraMemberId.trim() || undefined,
        samagraId: samagraMemberId.trim() || samagraFamilyId.trim() || undefined,
        areaType,
        wardNumber: areaType === 'urban' ? safeWard : undefined,
        blockName: areaType === 'rural' ? blockName : undefined,
        age: safeAge,
        gender,
        category,
        occupation,
        annualIncome: safeIncome,
        maritalStatus,
        isBPL,
        hasDisability,
        isMpDomicile,
        isIndoreResident,
        ekycVerified: Boolean(samagraMemberId.trim()),
      });
      setWardNumber(safeWard);
      setAge(safeAge);
      setAnnualIncome(safeIncome);
      setSuccessMsg(
        citizenAccountUser
          ? 'Citizen profile & Samagra details saved to your account.'
          : 'Citizen profile & Samagra details synced to Firebase Firestore.'
      );
      onNotify?.({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your Citizen profile & Samagra details have been saved.',
      });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setErrorDetails(err.details || null);
        onNotify?.({
          type: 'error',
          title: 'Profile Save Failed',
          message: err.message,
          details: err.details,
        });
      } else {
        const msg = formatAuthErrorMessage(err);
        setErrorMsg(msg);
        onNotify?.({
          type: 'error',
          title: 'Profile Save Failed',
          message: msg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSamagraMemberLogin = async (member: FamilyMember, family: SamagraFamily) => {
    if (isSubmitting) return;
    setErrorMsg(null);
    setErrorDetails(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await onSamagraSessionLogin(member, family);
      setSuccessMsg(
        `Logged in as ${member.name} (Samagra ${member.memberId}). Schemes updated for your profile.`
      );
    } catch (err) {
      const msg = formatAuthErrorMessage(err);
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Samagra Login Failed',
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const headingTitle =
    currentLanguage === 'hi'
      ? 'नागरिक लॉगिन एवं पंजीकरण पोर्टल'
      : currentLanguage === 'malwi'
      ? 'नागरिक खाता लॉगिन व पंजीयन'
      : 'Citizen Login & Registration';

  const headingSub =
    currentLanguage === 'hi'
      ? 'Google, समग्र आईडी (8/9 अंक) या ईमेल द्वारा सुरक्षित प्रवेश करें और अपनी पात्रता व आवेदन क्लाउड में सहेजें।'
      : 'Access personalized Indore District schemes, Samagra household verification, saved bookmarks, and ARN status tracking.';

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {authBannerMessage && (
        <div className="mb-6 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{authBannerMessage}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Civic Identity / Active Session Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Indore District Unified Citizen Access
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-heading text-balance">
              {headingTitle}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">{headingSub}</p>
          </div>

          {activeCitizenUser ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {firebaseUser?.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={firebaseUser.displayName || 'Citizen'}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full border border-emerald-500 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold shrink-0">
                      {(activeAccountProfile?.displayName || activeCitizenUser.displayName || activeCitizenUser.email || 'C')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 truncate">
                      {activeAccountProfile?.displayName || activeCitizenUser.displayName || citizenProfile.fullName}
                    </h2>
                    <p className="text-xs text-slate-500 truncate">{activeCitizenUser.email}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {citizenAccountUser
                          ? 'Database Synced · Citizen Email Auth'
                          : 'Firestore Synced · Google Auth'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Samagra Family ID</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {activeAccountProfile?.samagraFamilyId || citizenProfile.samagraFamilyId || 'Not linked'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Samagra Member ID</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {activeAccountProfile?.samagraMemberId || citizenProfile.samagraMemberId || 'Not linked'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Jurisdiction</span>
                  <span className="font-semibold text-slate-900">
                    {(activeAccountProfile?.areaType || citizenProfile.areaType) === 'urban'
                      ? `IMC Ward ${activeAccountProfile?.wardNumber ?? citizenProfile.wardNumber ?? 72}`
                      : `${activeAccountProfile?.blockName || citizenProfile.blockName || 'Indore'} Janpad`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Account Role</span>
                  <span className="font-semibold text-emerald-700">Citizen</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onNavigateTab('schemes')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Check Eligibility</span>
                </button>
                <button
                  onClick={onOpenSavedSchemes}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                  <span>Saved ({savedSchemesCount})</span>
                </button>
                <button
                  onClick={() => onNavigateTab('tracker')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>Track ARN</span>
                </button>
                <button
                  onClick={async () => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    await onSignOut();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold transition whitespace-nowrap cursor-pointer ml-auto"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                Why Register on YojanaSetu Indore?
              </h2>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Cloud Profile Persistence:</strong> Save your age, income, ward/block, and category securely in Firebase Firestore across sessions.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Samagra 8 & 9-Digit Linking:</strong> Connect your Madhya Pradesh Samagra Family & Member ID for instant household scheme discovery.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Bookmark className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Bookmark & Apply Faster:</strong> Save shortlisted schemes, auto-fill online applications, and track 15-digit ARN status.
                  </span>
                </li>
              </ul>

              <div className="border-t border-slate-100 pt-4 flex items-center gap-3 text-xs text-slate-500 font-medium tabular-nums">
                <span>51 Verified Schemes</span>
                <span aria-hidden="true">·</span>
                <span>85 IMC Wards</span>
                <span aria-hidden="true">·</span>
                <span>4 Rural Janpads</span>
              </div>
            </div>
          )}

          {/* Active local Samagra Session status when not signed in */}
          {!activeCitizenUser && (
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Local Citizen Session</span>
                <span className="font-mono tabular-nums text-amber-400">
                  Samagra {citizenProfile.samagraFamilyId || '—'}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{citizenProfile.fullName}</div>
              <div className="text-xs text-slate-300">
                {citizenProfile.areaType === 'urban'
                  ? `IMC Ward ${citizenProfile.wardNumber ?? 72}`
                  : `${citizenProfile.blockName || 'Indore'} Janpad`}{' '}
                · {citizenProfile.occupation} · ₹{citizenProfile.annualIncome.toLocaleString('en-IN')}/yr
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Login / Registration / Profile Sync Card */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-4 text-xs" role="alert">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="leading-relaxed font-semibold">{errorMsg}</p>
                    {errorDetails && (
                      <p className="leading-relaxed text-rose-700">{errorDetails}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{successMsg}</p>
              </div>
            )}

            {activeCitizenUser ? (
              /* Signed-In Citizen Profile & Samagra Linking Form */
              <form onSubmit={handleSaveProfileUpdate} className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-heading">
                      Complete & Sync Citizen Profile
                    </h2>
                    <p className="text-xs text-slate-500">
                      {citizenAccountUser
                        ? 'Update your Samagra ID and Indore ward/block details directly in your YojanaSetu account.'
                        : 'Link your Samagra ID and Indore ward/block details directly to your Firestore account.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name (as per Aadhaar)
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      maxLength={120}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <MobileOtpVerifier
                      value={phone}
                      onChange={handlePhoneInputChange}
                      isVerified={mobileVerified}
                      verificationToken={mobileVerificationToken}
                      onVerified={({ mobileNumber, verificationToken }) => {
                        setPhone(mobileNumber);
                        setMobileVerified(true);
                        setMobileVerificationToken(verificationToken);
                      }}
                      authToken={citizenAuthToken}
                      disabled={isSubmitting}
                      onNotify={onNotify}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Samagra Family ID (8-Digit)
                    </label>
                    <input
                      type="text"
                      value={samagraFamilyId}
                      onChange={e => setSamagraFamilyId(e.target.value)}
                      placeholder="8-digit Samagra Family ID"
                      maxLength={16}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Samagra Member ID (9-Digit)
                    </label>
                    <input
                      type="text"
                      value={samagraMemberId}
                      onChange={e => setSamagraMemberId(e.target.value)}
                      placeholder="9-digit Samagra Member ID"
                      maxLength={16}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Indore Area Type
                    </label>
                    <select
                      value={areaType}
                      onChange={e => setAreaType(e.target.value as AreaType)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="urban">Urban (Indore Municipal Corp)</option>
                      <option value="rural">Rural (Janpad Panchayat)</option>
                    </select>
                  </div>

                  {areaType === 'urban' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        IMC Ward Number (1–85)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={85}
                        value={wardNumber}
                        onChange={e => setWardNumber(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Rural Janpad Block
                      </label>
                      <select
                        value={blockName}
                        onChange={e => setBlockName(e.target.value as JanpadBlock)}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {JANPAD_BLOCKS.map(b => (
                          <option key={b} value={b}>
                            {b} Janpad
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Occupation
                    </label>
                    <select
                      value={occupation}
                      onChange={e => setOccupation(e.target.value as OccupationType)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {OCCUPATIONS.map(o => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Annual Family Income (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={annualIncome}
                      onChange={e => setAnnualIncome(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Age (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={age}
                      onChange={e => setAge(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Social Category
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value as Category)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-5 pt-1 text-xs text-slate-700">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBPL}
                      onChange={e => setIsBPL(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>BPL Ration Cardholder</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDisability}
                      onChange={e => setHasDisability(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Divyang (40%+ Disability)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMpDomicile}
                      onChange={e => setIsMpDomicile(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>MP Domicile</span>
                  </label>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold transition cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span>
                      {citizenAccountUser
                        ? 'Save Citizen Profile Changes'
                        : 'Save & Sync Profile to Firestore'}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              /* Signed-Out: Login & Sign-Up Portal */
              <div className="space-y-6">
                {/* Primary Mode Segmented Control */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setErrorMsg(null);
                        setErrorDetails(null);
                        setSuccessMsg(null);
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
                        authMode === 'login'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthMethod('email');
                        setErrorMsg(null);
                        setErrorDetails(null);
                        setSuccessMsg(null);
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
                        authMode === 'signup'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Citizen Registration
                    </button>
                  </div>

                  {/* Method Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('google');
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                        authMethod === 'google'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('samagra');
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                        authMethod === 'samagra'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Samagra ID
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('email');
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                        authMethod === 'email'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Email Form
                    </button>
                  </div>
                </div>

                {/* Method 1: Google Auth */}
                {authMethod === 'google' && (
                  <div className="space-y-5 py-2">
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-bold text-slate-900 font-heading">
                        {authMode === 'signup' ? 'Register Instantly with Google' : 'Sign In with Google'}
                      </h2>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Recommended for citizens of Indore. Automatically creates or restores your verified Firestore profile, bookmarked schemes, and submitted applications.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-sm font-bold transition shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                      ) : (
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                      <span>Continue with Google Account</span>
                    </button>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="shrink mx-3 text-xs text-slate-400">or use Citizen options</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('samagra')}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold transition cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-amber-700" />
                        <span>Login with Samagra ID</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signup');
                          setAuthMethod('email');
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-slate-700" />
                        <span>New Citizen Registration</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Method 2: Samagra ID Login */}
                {authMethod === 'samagra' && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-900 font-heading">
                        Samagra Family / Member ID Login
                      </h2>
                      <p className="text-xs text-slate-500">
                        Enter your 8-digit Samagra Family ID or 9-digit Member ID to load your verified household profile & Aadhaar eKYC status.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={samagraQuery}
                        onChange={e => setSamagraQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSamagraSearch();
                          }
                        }}
                        placeholder="Enter 8-digit Family or 9-digit Member ID"
                        className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => handleSamagraSearch()}
                        disabled={samagraLoading}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        {samagraLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span>Verify ID</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {liveSamagraList.length > 0 ? (
                        <>
                          <span className="text-slate-500">Your Linked Households:</span>
                          {liveSamagraList.slice(0, 5).map(fam => (
                            <button
                              key={fam.familyId}
                              type="button"
                              onClick={() => {
                                setSamagraQuery(fam.familyId);
                                handleSamagraSearch(fam.familyId);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-950 font-medium transition cursor-pointer"
                            >
                              {fam.headName} · <span className="font-mono tabular-nums">{fam.familyId}</span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="w-full flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                          <span className="text-slate-600">Enter your 8-digit Samagra Family ID or register a new household.</span>
                          <button
                            type="button"
                            onClick={() => onNavigateTab('samagra')}
                            className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer whitespace-nowrap"
                          >
                            Register Samagra ID →
                          </button>
                        </div>
                      )}
                    </div>

                    {samagraError && (
                      <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-4 text-xs space-y-2.5" role="alert">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold">{samagraError}</p>
                            {samagraPortalFallback?.details && (
                              <p className="text-amber-900 leading-relaxed">{samagraPortalFallback.details}</p>
                            )}
                          </div>
                        </div>
                        {samagraPortalFallback && (
                          <div className="flex flex-wrap items-center gap-3 pt-1 pl-6">
                            <a
                              href={samagraPortalFallback.portalUrl || SAMAGRA_PORTAL_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 transition"
                            >
                              <span>Verify directly at samagra.gov.in</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => onNavigateTab('samagra')}
                              className="inline-flex items-center gap-1 text-amber-900 font-bold underline hover:text-amber-700 cursor-pointer"
                            >
                              <span>Register / Enter Details Manually →</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {samagraNotice && !samagraError && (
                      <div className="bg-sky-50 border border-sky-200 text-sky-900 rounded-xl px-3.5 py-2.5 text-xs">
                        {samagraNotice}
                      </div>
                    )}

                    {samagraFamilyResult && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-bold text-slate-900">
                              Family Head: {samagraFamilyResult.headName}
                            </span>
                            <span className="text-slate-500 ml-2">
                              ({samagraFamilyResult.wardOrBlock} · {samagraFamilyResult.rationCardType})
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-bold text-amber-700">
                            ID: {samagraFamilyResult.familyId}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {samagraFamilyResult.members.map(member => (
                            <div
                              key={member.memberId}
                              className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">
                                  {member.name}{' '}
                                  <span className="text-xs font-normal text-slate-500">
                                    ({member.relation}, {member.age} yrs)
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 font-mono tabular-nums">
                                  <span>Member: {member.memberId}</span>
                                  <span>·</span>
                                  <span>{member.occupation}</span>
                                  <span>·</span>
                                  <span className={member.ekycStatus ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                                    {member.ekycStatus ? 'eKYC Verified' : 'eKYC Pending'}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleSamagraMemberLogin(member, samagraFamilyResult)}
                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 text-xs font-bold inline-flex items-center gap-1 transition whitespace-nowrap cursor-pointer shrink-0"
                              >
                                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Login</span>}
                                {!isSubmitting && <ArrowRight className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Method 3: Citizen Email Login / Registration */}
                {authMethod === 'email' && (
                  <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-900 font-heading">
                        {authMode === 'login' ? 'Citizen Portal Sign In' : 'New Citizen Registration'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {authMode === 'login'
                          ? 'Sign in with your registered email and password to load your Citizen Dashboard profile.'
                          : 'Create your YojanaSetu citizen account with your Samagra ID and Indore ward/block details.'}
                      </p>
                    </div>

                    {authMode === 'signup' && (
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            required
                            placeholder="Enter full name as per Samagra"
                            maxLength={120}
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <MobileOtpVerifier
                          value={phone}
                          onChange={handlePhoneInputChange}
                          isVerified={mobileVerified}
                          verificationToken={mobileVerificationToken}
                          onVerified={({ mobileNumber, verificationToken }) => {
                            setPhone(mobileNumber);
                            setMobileVerified(true);
                            setMobileVerificationToken(verificationToken);
                          }}
                          disabled={isSubmitting}
                          onNotify={onNotify}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className={authMode === 'login' ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Email Address *
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="citizen@example.com"
                            maxLength={160}
                            className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {authMode === 'signup' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Samagra Family ID (Optional)
                          </label>
                          <input
                            type="text"
                            value={samagraFamilyId}
                            onChange={e => setSamagraFamilyId(e.target.value)}
                            placeholder="8-digit Family ID (optional)"
                            maxLength={16}
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className={authMode === 'login' ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Password *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            placeholder={authMode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                            className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {authMode === 'signup' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Confirm Password *
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Re-enter password"
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {authMode === 'signup' && (
                      <div className="border-t border-slate-100 pt-4 space-y-3.5">
                        <p className="text-xs font-bold text-slate-700">
                          Indore Jurisdiction & Eligibility Profile
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Area Type</label>
                            <select
                              value={areaType}
                              onChange={e => setAreaType(e.target.value as AreaType)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                            >
                              <option value="urban">Urban (IMC)</option>
                              <option value="rural">Rural (Janpad)</option>
                            </select>
                          </div>

                          {areaType === 'urban' ? (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">IMC Ward (1–85)</label>
                              <input
                                type="number"
                                min={1}
                                max={85}
                                value={wardNumber}
                                onChange={e => setWardNumber(Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono tabular-nums"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Janpad Block</label>
                              <select
                                value={blockName}
                                onChange={e => setBlockName(e.target.value as JanpadBlock)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                              >
                                {JANPAD_BLOCKS.map(b => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Member ID (9-Digit)
                            </label>
                            <input
                              type="text"
                              value={samagraMemberId}
                              onChange={e => setSamagraMemberId(e.target.value)}
                              placeholder="Optional"
                              maxLength={16}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={age}
                              onChange={e => setAge(Number(e.target.value))}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                            <select
                              value={gender}
                              onChange={e => setGender(e.target.value as Gender)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                            >
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                              <option value="transgender">Transgender</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                            <select
                              value={category}
                              onChange={e => setCategory(e.target.value as Category)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                            >
                              {CATEGORIES.map(c => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Occupation</label>
                            <select
                              value={occupation}
                              onChange={e => setOccupation(e.target.value as OccupationType)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                            >
                              {OCCUPATIONS.map(o => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Annual Income (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              value={annualIncome}
                              onChange={e => setAnnualIncome(Number(e.target.value))}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Marital Status</label>
                            <select
                              value={maritalStatus}
                              onChange={e => setMaritalStatus(e.target.value as MaritalStatus)}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                            >
                              {MARITAL_STATUSES.map(m => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-slate-700 pt-1">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isBPL}
                              onChange={e => setIsBPL(e.target.checked)}
                              className="rounded border-slate-300 text-amber-600"
                            />
                            <span>BPL Card</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasDisability}
                              onChange={e => setHasDisability(e.target.checked)}
                              className="rounded border-slate-300 text-amber-600"
                            />
                            <span>Divyang (40%+)</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isMpDomicile}
                              onChange={e => setIsMpDomicile(e.target.checked)}
                              className="rounded border-slate-300 text-amber-600"
                            />
                            <span>MP Domicile</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isIndoreResident}
                              onChange={e => setIsIndoreResident(e.target.checked)}
                              className="rounded border-slate-300 text-amber-600"
                            />
                            <span>Indore Resident</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      {authMode === 'login' ? (
                        <span className="text-xs text-slate-500">
                          Authenticated Citizen Portal Session
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Saved securely in YojanaSetu Citizen Database
                        </span>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold transition disabled:opacity-60 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        <span>
                          {authMode === 'login' ? 'Sign In to Citizen Account' : 'Create Citizen Account'}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
