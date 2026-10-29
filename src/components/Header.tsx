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
  Languages
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
}

export const Header: React.FC<HeaderProps> = ({
  currentLanguage,
  setLanguage,
  userMode,
  setUserMode,
  onOpenSamagraModal,
  activeTab,
  setActiveTab,
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
        <nav className="hidden lg:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('schemes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'schemes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'योजनाएं व पात्रता' : currentLanguage === 'malwi' ? 'योजना व जांच' : 'Schemes & Eligibility'}
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'governance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? '6 प्रशासनिक स्तर' : currentLanguage === 'malwi' ? '6 सरकार स्तर' : '6 Governance Levels'}
          </button>
          <button
            onClick={() => setActiveTab('samagra')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'samagra' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'समग्र परिवार प्रोफाइल' : currentLanguage === 'malwi' ? 'समग्र कुटुंब खाता' : 'Samagra Family'}
          </button>
          <button
            onClick={() => setActiveTab('digilocker')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'digilocker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'दस्तावेज व डिजिलॉकर' : currentLanguage === 'malwi' ? 'कागजात लॉकर' : 'DigiLocker Wallet'}
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'tracker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {currentLanguage === 'hi' ? 'आवेदन स्थिति (ARN)' : currentLanguage === 'malwi' ? 'आवेदन खोज' : 'Application Status'}
          </button>
          <button
            onClick={() => setActiveTab('yojanamitra')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'yojanamitra' ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            AI योजना मित्र
          </button>
        </nav>

        {/* Right Mode Switcher & Samagra Shortcut */}
        <div className="flex items-center space-x-2">
          {/* Quick Samagra Search button */}
          <button
            onClick={onOpenSamagraModal}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-300"
            title="Search by 8-Digit Samagra Family ID or 9-Digit Member ID"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Samagra ID</span>
          </button>

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
