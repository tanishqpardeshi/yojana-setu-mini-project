import React from 'react';
import {
  Building2,
  User,
  PhoneCall,
  Languages,
  Bookmark,
  LogOut,
  Search,
  Layers,
  Users,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import { SupportedLanguage } from '../types';
import { pickText } from '../utils/i18n';

interface HeaderProps {
  currentLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  onOpenSamagraModal: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  firebaseUser?: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onSignOut?: () => void;
  savedSchemesCount?: number;
  onOpenSavedSchemes?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLanguage,
  setLanguage,
  activeTab,
  setActiveTab,
  firebaseUser,
  onSignOut,
  savedSchemesCount = 0,
  onOpenSavedSchemes,
}) => {
  const selectCitizenTab = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const mobileNavItems = [
    {
      id: 'schemes',
      icon: Search,
      label: t('Schemes', 'योजनाएं', 'योजना'),
    },
    {
      id: 'governance',
      icon: Layers,
      label: t('6 Levels', '6 स्तर', '6 स्तर'),
    },
    {
      id: 'samagra',
      icon: Users,
      label: t('Samagra', 'समग्र', 'समग्र'),
    },
    {
      id: 'digilocker',
      icon: ShieldCheck,
      label: t('Locker', 'लॉकर', 'लॉकर'),
    },
    {
      id: 'tracker',
      icon: ClipboardCheck,
      label: t('Track', 'स्थिति', 'अर्जी'),
    },
  ];

  return (
    <>
      {/* Non-sticky Top Governmental Info & Language Bar (scrolls away on mobile so sticky top bar stays lean) */}
      <div className="bg-slate-900 text-slate-200 text-xs px-3 sm:px-4 py-1.5 flex flex-wrap justify-between items-center gap-2 no-print">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <span className="inline-flex items-center text-amber-400 font-semibold whitespace-nowrap">
            {t('Govt. of Madhya Pradesh', 'मध्य प्रदेश शासन', 'मध्य प्रदेश सरकार')}
          </span>
          <span className="hidden md:inline text-slate-500">/</span>
          <span className="hidden md:inline text-slate-300 truncate">
            {t(
              'District Administration Indore & Indore Municipal Corporation (IMC)',
              'जिला प्रशासन इंदौर एवं इंदौर नगर निगम (IMC)',
              'इंदौर जिला प्रशासन अने इंदौर नगर निगम (IMC)'
            )}
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
          <div className="hidden sm:flex items-center space-x-2 text-slate-300">
            <PhoneCall className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden lg:inline font-medium">
              {t('Helplines:', 'हेल्पलाइन:', 'मदद नंबर:')}
            </span>
            <span className="font-mono text-[11px] text-amber-300 tabular-nums">
              {t('CM: 181', 'सीएम: 181', 'सीएम: 181')}
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
              {t('IMC: 311', 'निगम: 311', 'निगम: 311')}
            </span>
          </div>

          {/* Language Selector */}
          <div
            className="flex items-center space-x-0.5 bg-slate-800 rounded-lg p-0.5 border border-slate-700"
            role="group"
            aria-label={t('Language selector', 'भाषा चुनें', 'भाषा चुनो')}
          >
            <Languages className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5 shrink-0" />
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                currentLanguage === 'en' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                currentLanguage === 'hi' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setLanguage('malwi')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                currentLanguage === 'malwi' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
              title="Malwi Dialect / माळवी बोली"
            >
              माळवी
            </button>
          </div>
        </div>
      </div>

      {/* Main Sticky Brand & Nav Bar (Compact single row on both mobile and desktop) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs no-print">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo / Branding */}
          <button
            type="button"
            className="flex items-center space-x-2.5 cursor-pointer shrink-0 min-w-0 text-left"
            onClick={() => selectCitizenTab('schemes')}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 flex items-center justify-center text-white shadow-sm border border-amber-300/40 shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 font-heading whitespace-nowrap">
                  {currentLanguage === 'en' ? (
                    <>
                      Yojana<span className="text-amber-600">Setu</span>
                    </>
                  ) : (
                    <>
                      योजना<span className="text-amber-600">सेतु</span>
                    </>
                  )}
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 font-medium truncate max-w-[260px] xl:max-w-none">
                {t(
                  'Indore 6-Tier Citizen Rights & Entitlement Platform',
                  'इंदौर 6-स्तरीय नागरिक अधिकार व पात्रता मंच',
                  'इंदौर 6 स्तर री सरकारी योजना व हक रो मंच'
                )}
              </p>
            </div>
          </button>

          {/* Desktop Center Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center space-x-0.5 xl:space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0"
          >
            <button
              type="button"
              onClick={() => selectCitizenTab('schemes')}
              className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'schemes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {currentLanguage === 'hi' ? 'योजनाएं व पात्रता' : currentLanguage === 'malwi' ? 'योजना व पात्रता जांच' : (
                <><span>Schemes</span><span className="hidden xl:inline"> & Eligibility</span></>
              )}
            </button>
            <button
              type="button"
              onClick={() => selectCitizenTab('governance')}
              className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'governance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {currentLanguage === 'hi' ? (
                <><span>6 प्रशासनिक</span><span className="hidden xl:inline"> स्तर</span></>
              ) : currentLanguage === 'malwi' ? '6 सरकार स्तर' : (
                <><span>6 Governance</span><span className="hidden xl:inline"> Levels</span></>
              )}
            </button>
            <button
              type="button"
              onClick={() => selectCitizenTab('samagra')}
              className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'samagra' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {currentLanguage === 'hi' ? (
                <><span>समग्र परिवार</span><span className="hidden xl:inline"> प्रोफाइल</span></>
              ) : currentLanguage === 'malwi' ? 'समग्र कुटुंब खाता' : (
                <><span>Samagra</span><span className="hidden xl:inline"> Family</span></>
              )}
            </button>
            <button
              type="button"
              onClick={() => selectCitizenTab('digilocker')}
              className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'digilocker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {currentLanguage === 'hi' ? (
                <><span>डिजिलॉकर</span><span className="hidden xl:inline"> वॉलेट</span></>
              ) : currentLanguage === 'malwi' ? 'कागजात लॉकर' : (
                <><span>DigiLocker</span><span className="hidden xl:inline"> Wallet</span></>
              )}
            </button>
            <button
              type="button"
              onClick={() => selectCitizenTab('tracker')}
              className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'tracker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {currentLanguage === 'hi' ? 'आवेदन स्थिति (ARN)' : currentLanguage === 'malwi' ? 'अर्जी स्थिति (ARN)' : (
                <><span>Track ARN</span><span className="hidden xl:inline"> Status</span></>
              )}
            </button>
          </nav>

          {/* Right Saved Shortcut & Auth */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {onOpenSavedSchemes && (
              <button
                type="button"
                onClick={onOpenSavedSchemes}
                className="min-h-[38px] inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition border border-amber-200 cursor-pointer whitespace-nowrap"
                title={t('View Bookmarked Schemes', 'सहेजी गई योजनाएं देखें', 'संभाली हुई योजना देखो')}
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span className="hidden sm:inline">{t('Saved', 'सहेजी गईं', 'संभाली हुई')}</span>
                {savedSchemesCount > 0 && (
                  <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                    {savedSchemesCount}
                  </span>
                )}
              </button>
            )}

            {firebaseUser ? (
              <div className="flex items-center space-x-1.5 bg-slate-100 pl-1.5 pr-2 py-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => selectCitizenTab('auth')}
                  className="flex items-center space-x-1.5 text-left cursor-pointer hover:opacity-85 transition"
                  title={t('Manage Citizen Account & Samagra Profile', 'नागरिक खाता और समग्र प्रोफ़ाइल प्रबंधित करें', 'आपणो खाता अने समग्र जानकारी संभालो')}
                >
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={firebaseUser.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full border border-emerald-500"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {(firebaseUser.displayName || firebaseUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden xl:block text-left text-[11px] leading-tight max-w-[110px] truncate">
                    <p className="font-bold text-slate-800 truncate">{firebaseUser.displayName || t('Citizen', 'नागरिक', 'नागरिक')}</p>
                    <p className="text-[9px] text-emerald-700 font-medium">{t('Citizen Profile', 'नागरिक प्रोफ़ाइल', 'म्हारो खातो')}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg transition cursor-pointer"
                  title={t('Sign Out', 'लॉग आउट', 'बाहर निकलो')}
                  aria-label={t('Sign Out', 'लॉग आउट', 'बाहर निकलो')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => selectCitizenTab('auth')}
                className={`min-h-[38px] inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'auth'
                    ? 'bg-slate-900 text-white border border-slate-900'
                    : 'text-slate-800 bg-white hover:bg-slate-50 border border-slate-300'
                }`}
                title={t('Citizen Login & Registration', 'नागरिक लॉगिन व पंजीकरण', 'नागरिक लॉगिन अने पंजीयन')}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {t('Login / Sign Up', 'लॉगिन / पंजीकरण', 'लॉगिन / नयो खातो')}
                </span>
                <span className="sm:hidden">{t('Login', 'लॉगिन', 'लॉगिन')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar (5 primary citizen destinations, >=44px targets) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg no-print"
      >
        <div className="grid grid-cols-5 items-center h-15">
          {mobileNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCitizenTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 transition cursor-pointer ${
                  isActive ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
                <span className="text-[10px] leading-tight mt-0.5 truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
