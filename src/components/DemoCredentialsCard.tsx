import React from 'react';
import { ArrowRight, CheckCircle2, Loader2, Sparkles, UserCheck } from 'lucide-react';
import {
  DEMO_CITIZEN_CREDENTIALS,
  DemoCitizenCredential,
  USE_MOCK_API,
} from '../services/govApiService';
import { SupportedLanguage } from '../types';
import { pickText } from '../utils/i18n';

interface DemoCredentialsCardProps {
  currentLanguage: SupportedLanguage;
  activeMemberId?: string;
  loadingMemberId?: string | null;
  onSelectDemoCredential: (credential: DemoCitizenCredential) => void;
  compact?: boolean;
}

export const DemoCredentialsCard: React.FC<DemoCredentialsCardProps> = ({
  currentLanguage,
  activeMemberId,
  loadingMemberId,
  onSelectDemoCredential,
  compact = false,
}) => {
  if (!USE_MOCK_API) return null;

  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  return (
    <div
      data-testid="demo-credentials-card"
      className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700/80 p-4 sm:p-5 space-y-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded">
              <Sparkles className="w-3 h-3" />
              <span>Mock e-Gov Sandbox</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-300">USE_MOCK_API = true</span>
          </div>
          <h3 className="text-sm font-bold text-white mt-1.5">
            {t(
              'Demo Test Credentials (Indore 6-Tier Profiles)',
              'डेमो परीक्षण क्रेडेंशियल (इंदौर 6-स्तरीय प्रोफ़ाइल)',
              'डेमो टेस्ट आईडी (इंदौर 6-स्तर प्रोफ़ाइल)'
            )}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            {t(
              'One-click verify via /api/gov/samagra/verify to auto-populate Citizen Profile Parameters and test rules + DigiLocker upgrades.',
              '/api/gov/samagra/verify के माध्यम से एक क्लिक में सत्यापन करें और प्रोफ़ाइल व डिजिलॉकर पात्रता परीक्षण करें।',
              'एक क्लिक मां समग्र जांच करो अने योजना पात्रता व डिजिलॉकर जांच तुरंत देखो।'
            )}
          </p>
        </div>
      </div>

      <div className={compact ? 'grid grid-cols-1 md:grid-cols-3 gap-2.5' : 'space-y-2.5'}>
        {DEMO_CITIZEN_CREDENTIALS.map(cred => {
          const isLoading = loadingMemberId === cred.memberId;
          const isActive = activeMemberId === cred.memberId;
          const accentBorder =
            cred.accent === 'amber'
              ? 'border-amber-500/30 hover:border-amber-400/70'
              : cred.accent === 'emerald'
              ? 'border-emerald-500/30 hover:border-emerald-400/70'
              : 'border-blue-500/30 hover:border-blue-400/70';
          const accentBadge =
            cred.accent === 'amber'
              ? 'bg-amber-500/15 text-amber-300'
              : cred.accent === 'emerald'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-blue-500/15 text-blue-300';

          return (
            <button
              key={cred.memberId}
              type="button"
              disabled={Boolean(loadingMemberId)}
              onClick={() => onSelectDemoCredential(cred)}
              data-testid={`demo-cred-btn-${cred.memberId}`}
              className={`w-full text-left rounded-xl bg-slate-800/80 hover:bg-slate-800 border p-3 transition cursor-pointer disabled:opacity-60 flex flex-col justify-between gap-2 ${
                isActive ? 'ring-2 ring-amber-400 border-amber-400' : accentBorder
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-black text-white tracking-wide">
                    ID: {cred.memberId}
                  </span>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${accentBadge}`}>
                      {cred.incomeLabel}
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-100">
                  {cred.name}{' '}
                  <span className="text-[11px] font-normal text-slate-400">({cred.roleLabel})</span>
                </div>
                <div className="text-[11px] text-slate-400">{cred.locationLabel}</div>
                <div className="text-[11px] text-amber-300/90 font-medium">{cred.highlights}</div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-700/70 text-[11px]">
                <span className="font-mono text-slate-400">{cred.mobileNumber}</span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Verify &amp; Load</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
