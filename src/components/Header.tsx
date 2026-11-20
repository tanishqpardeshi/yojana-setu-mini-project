import React from 'react';
import {
  Building2,
  User,
  PhoneCall,
  Languages,
  Bookmark,
  LogOut,
} from 'lucide-react';
import { SupportedLanguage } from '../types';

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
  };
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Governmental Bar */}
      <div className="bg-slate-900 text-slate-200 text-xs px-4 py-1.5 flex flex-wrap justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center text-amber-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
            Govt. of Madhya Pradesh
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="hidden sm:inline text-slate-300">
            District Administration Indore & Indore Municipal Corporation (IMC)
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-slate-300">
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline font-medium">Helplines:</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-300">CM Helpline: 181</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-cyan-300">IMC: 311</span>
          </div>

          {/* Language Selector */}
          <div className="flex items-center space-x-1 bg-slate-800 rounded p-0.5 border border-slate-700">
            <Languages className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                currentLanguage === 'en' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                currentLanguage === 'hi' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              हिन्दी
            </button>
            <button
              onClick={() => setLanguage('malwi')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                currentLanguage === 'malwi' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
              title="Malwi Dialect / माळवी बोली"
            >
              माळवी
            </button>
          </div>
        </div>
      </div>

      {/* Main Brand & Nav Bar */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5">
        {/* Logo / Branding */}
        <div className="flex items-center space-x-2.5 cursor-pointer shrink-0" onClick={() => selectCitizenTab('schemes')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-500/20 border border-amber-300/40 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 font-heading">
                Yojana<span className="text-amber-600">Setu</span>
              </span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-amber-300 whitespace-nowrap">
                Indore Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
              योजना सेतु • 6-स्तरीय नागरिक अधिकार व पात्रता मंच
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden lg:flex items-center space-x-0.5 xl:space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => selectCitizenTab('schemes')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'schemes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'योजनाएं व पात्रता' : currentLanguage === 'malwi' ? 'योजना व जांच' : (
              <><span>Schemes</span><span className="hidden xl:inline"> & Eligibility</span></>
            )}
          </button>
          <button
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
            onClick={() => selectCitizenTab('tracker')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'tracker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'आवेदन स्थिति (ARN)' : currentLanguage === 'malwi' ? 'आवेदन खोज' : (
              <><span>Track ARN</span><span className="hidden xl:inline"> Status</span></>
            )}
          </button>
        </nav>

        {/* Right Mode Switcher, Saved Shortcut & Firebase Auth */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Saved Schemes in Firestore shortcut */}
          {onOpenSavedSchemes && (
            <button
              onClick={onOpenSavedSchemes}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition border border-amber-200 cursor-pointer whitespace-nowrap"
              title="View Bookmarked Schemes"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span className="hidden sm:inline">Saved</span>
              {savedSchemesCount > 0 && (
                <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {savedSchemesCount}
                </span>
              )}
            </button>
          )}

          {/* Firebase Auth / Citizen Login & Profile Menu */}
          {firebaseUser ? (
            <div className="flex items-center space-x-1.5 bg-slate-100 pl-1.5 pr-2 py-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => selectCitizenTab('auth')}
                className="flex items-center space-x-1.5 text-left cursor-pointer hover:opacity-85 transition"
                title="Manage Citizen Account & Samagra Profile"
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
                  <p className="font-bold text-slate-800 truncate">{firebaseUser.displayName || 'Citizen'}</p>
                  <p className="text-[9px] text-emerald-700 font-medium">Citizen Profile</p>
                </div>
              </button>
              <button
                onClick={onSignOut}
                className="p-1 text-slate-500 hover:text-rose-600 rounded-lg transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => selectCitizenTab('auth')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'auth'
                  ? 'bg-slate-900 text-white border border-slate-900'
                  : 'text-slate-800 bg-white hover:bg-slate-50 border border-slate-300'
              }`}
              title="Citizen Login & Registration (Google / Samagra ID / Email)"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {currentLanguage === 'hi' ? 'लॉगिन / पंजीकरण' : 'Login / Sign Up'}
              </span>
              <span className="sm:hidden">Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Scroller */}
      <div className="lg:hidden px-4 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto flex space-x-2 no-scrollbar">
        <button
          onClick={() => selectCitizenTab('schemes')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'schemes' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          Schemes & Eligibility
        </button>
        <button
          onClick={() => selectCitizenTab('governance')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'governance' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          6 Governance Levels
        </button>
        <button
          onClick={() => selectCitizenTab('samagra')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'samagra' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          Samagra Family
        </button>
        <button
          onClick={() => selectCitizenTab('digilocker')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'digilocker' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          DigiLocker Wallet
        </button>
        <button
          onClick={() => selectCitizenTab('tracker')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'tracker' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          Track ARN
        </button>
        <button
          onClick={() => selectCitizenTab('auth')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'auth' ? 'bg-slate-900 text-white font-bold' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          {firebaseUser ? 'My Account' : 'Login / Sign Up'}
        </button>
      </div>
    </header>
  );
};
