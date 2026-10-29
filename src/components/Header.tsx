import React from 'react';
import { 
  Building2, 
  Globe2, 
  HelpCircle, 
  ShieldCheck, 
  User, 
  Laptop, 
  LayoutDashboard, 
  PhoneCall, 
  Search,
  Languages,
  Bookmark,
  LogOut
} from 'lucide-react';
import { SupportedLanguage, UserMode } from '../types';

interface HeaderProps {
  currentLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  userMode: UserMode;
  setUserMode: (mode: UserMode) => void;
  onOpenSamagraModal: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  firebaseUser?: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onGoogleSignIn?: () => void;
  onSignOut?: () => void;
  savedSchemesCount?: number;
  onOpenSavedSchemes?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLanguage,
  setLanguage,
  userMode,
  setUserMode,
  onOpenSamagraModal,
  activeTab,
  setActiveTab,
  firebaseUser,
  onGoogleSignIn,
  onSignOut,
  savedSchemesCount = 0,
  onOpenSavedSchemes,
}) => {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Logo / Branding */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('schemes')}>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-500/20 border border-amber-300/40">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-heading">
                Yojana<span className="text-amber-600">Setu</span>
              </span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-amber-300">
                Indore Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              योजना सेतु • 6-स्तरीय नागरिक अधिकार व पात्रता मंच
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden lg:flex items-center space-x-0.5 xl:space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('schemes')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'schemes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'योजनाएं व पात्रता' : currentLanguage === 'malwi' ? 'योजना व जांच' : (
              <><span>Schemes</span><span className="hidden xl:inline"> & Eligibility</span></>
            )}
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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
            onClick={() => setActiveTab('samagra')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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
            onClick={() => setActiveTab('digilocker')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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
            onClick={() => setActiveTab('tracker')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'tracker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'आवेदन स्थिति (ARN)' : currentLanguage === 'malwi' ? 'आवेदन खोज' : (
              <><span>Track ARN</span><span className="hidden xl:inline"> Status</span></>
            )}
          </button>
          <button
            onClick={() => setActiveTab('yojanamitra')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'yojanamitra' ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            AI योजना मित्र
          </button>
        </nav>

        {/* Right Mode Switcher, Samagra Shortcut & Firebase Auth */}
        <div className="flex items-center space-x-2">
          {/* Saved Schemes in Firestore shortcut */}
          {onOpenSavedSchemes && (
            <button
              onClick={onOpenSavedSchemes}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition border border-amber-200"
              title="View Bookmarked Schemes (Stored in Firebase Firestore)"
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

          {/* Quick Samagra Search button */}
          <button
            onClick={onOpenSamagraModal}
            className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-300"
            title="Search by 8-Digit Samagra Family ID or 9-Digit Member ID"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Samagra ID</span>
          </button>

          {/* Firebase Google Auth Button / Profile Menu */}
          {firebaseUser ? (
            <div className="flex items-center space-x-1.5 bg-slate-100 pl-1.5 pr-2 py-1 rounded-xl border border-slate-200">
              {firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={firebaseUser.displayName || 'User'}
                  className="w-6 h-6 rounded-full border border-emerald-500"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {(firebaseUser.displayName || firebaseUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden xl:block text-left text-[11px] leading-tight max-w-[100px] truncate">
                <p className="font-bold text-slate-800 truncate">{firebaseUser.displayName || 'Citizen'}</p>
                <p className="text-[9px] text-emerald-600 font-medium">Firebase Auth</p>
              </div>
              <button
                onClick={onSignOut}
                className="p-1 text-slate-500 hover:text-rose-600 rounded-lg transition"
                title="Sign Out from Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onGoogleSignIn}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition shadow-2xs cursor-pointer"
              title="Sign In with Google (Firebase Authentication)"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="hidden sm:inline">Google Login</span>
              <span className="sm:hidden">Login</span>
            </button>
          )}

          {/* User Mode Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setUserMode('citizen')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                userMode === 'citizen'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Citizen Mode"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Citizen</span>
            </button>
            <button
              onClick={() => {
                setUserMode('csc_operator');
                setActiveTab('csc');
              }}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                userMode === 'csc_operator'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="CSC / MPOnline Kiosk Operator Mode"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kiosk / CSC</span>
            </button>
            <button
              onClick={() => {
                setUserMode('admin');
                setActiveTab('admin');
              }}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                userMode === 'admin'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="District Collectorate & IMC Admin Control"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Scroller */}
      <div className="lg:hidden px-4 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto flex space-x-2 no-scrollbar">
        <button
          onClick={() => setActiveTab('schemes')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'schemes' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          Schemes & Eligibility
        </button>
        <button
          onClick={() => setActiveTab('governance')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'governance' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          6 Governance Levels
        </button>
        <button
          onClick={() => setActiveTab('samagra')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'samagra' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          Samagra Family
        </button>
        <button
          onClick={() => setActiveTab('digilocker')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'digilocker' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          DigiLocker Wallet
        </button>
        <button
          onClick={() => setActiveTab('tracker')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'tracker' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          Track ARN
        </button>
        <button
          onClick={() => setActiveTab('yojanamitra')}
          className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
            activeTab === 'yojanamitra' ? 'bg-amber-600 text-white font-bold' : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}
        >
          AI Mitra
        </button>
      </div>
    </header>
  );
};
