import React from 'react';
import { Bookmark, X, ArrowRight, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import { Scheme, SupportedLanguage } from '../types';
import { getGovernanceLevelLabel, getSchemeTitle, pickText } from '../utils/i18n';
import { getOfficialPortalDisplayHost, resolveSchemePortalUrl } from '../utils/liveDataEngine';

interface SavedSchemesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSchemes: Array<{ schemeId: string; schemeTitle: string; savedAt: string }>;
  allSchemes: Scheme[];
  onRemoveScheme: (schemeId: string) => void;
  onSelectScheme: (scheme: Scheme) => void;
  userEmail?: string | null;
  currentLanguage?: SupportedLanguage;
}

export const SavedSchemesModal: React.FC<SavedSchemesModalProps> = ({
  isOpen,
  onClose,
  savedSchemes,
  allSchemes,
  onRemoveScheme,
  onSelectScheme,
  userEmail,
  currentLanguage = 'en',
}) => {
  if (!isOpen) return null;

  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const matchedSchemes = savedSchemes
    .map(saved => {
      const scheme = allSchemes.find(s => s.id === saved.schemeId);
      return {
        ...saved,
        fullScheme: scheme,
      };
    })
    .filter(item => item.fullScheme !== undefined);

  const totalFinancialBenefit = matchedSchemes.reduce((acc, curr) => {
    return acc + (curr.fullScheme?.financialEntitlement?.amount || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white border border-white/20">
              <Bookmark className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-lg font-heading">
                  {t('My Saved Schemes', 'मेरी सहेजी गई योजनाएं', 'म्हारी सहेज्योड़ी योजना')}
                </h3>
                <span className="bg-emerald-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  {t('Cloud Synced', 'क्लाउड सिंक', 'क्लाउड मां सुरक्षित')}
                </span>
              </div>
              <p className="text-xs text-amber-100">
                {userEmail
                  ? t(
                      `Synced to ${userEmail} • ${matchedSchemes.length} schemes bookmarked`,
                      `${userEmail} से सिंक • ${matchedSchemes.length} योजनाएं सहेजी गईं`,
                      `${userEmail} सूं जुड़यो • ${matchedSchemes.length} योजना सहेजी गई`
                    )
                  : t(
                      `Stored in cloud profile • ${matchedSchemes.length} schemes bookmarked`,
                      `क्लाउड प्रोफाइल में सुरक्षित • ${matchedSchemes.length} योजनाएं सहेजी गईं`,
                      `खाता मां सुरक्षित • ${matchedSchemes.length} योजना सहेजी गई`
                    )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Entitlement Banner */}
        {matchedSchemes.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200/70 p-4 px-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-900">
                {t('Total Estimated Financial Value', 'कुल अनुमानित वित्तीय लाभ', 'कुल अंदाजी फायदो')}
              </p>
              <p className="text-xs text-amber-700">
                {t(
                  'Calculated across your saved bookmarks',
                  'आपकी सहेजी गई योजनाओं के आधार पर',
                  'तमारी सहेज्योड़ी सगळी योजना रो जोड़'
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-amber-900">
                ₹{totalFinancialBenefit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {matchedSchemes.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Bookmark className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-700">
                {t('No saved schemes yet', 'अभी कोई योजना सहेजी नहीं गई है', 'अभी कोई योजना सहेजी नी गई छे')}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t(
                  'Click the "Save" button on any scheme in the Discovery tab to save it to your cloud profile.',
                  'किसी भी योजना को अपने खाते में सहेजने के लिए खोज टैब में "सहेजें" बटन पर क्लिक करें।',
                  'कोई भी योजना ने अपना खाता मां सहेजण खातर "सहेजो" बटन दबावो।'
                )}
              </p>
            </div>
          ) : (
            matchedSchemes.map(item => {
              const scheme = item.fullScheme!;
              return (
                <div
                  key={item.schemeId}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-400 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                        {getGovernanceLevelLabel(scheme.governanceLevel, currentLanguage)}
                      </span>
                      <span className="text-xs font-black text-emerald-700 tabular-nums">
                        {scheme.financialEntitlement
                          ? `₹${scheme.financialEntitlement.amount.toLocaleString('en-IN')}`
                          : t('Non-financial', 'सेवा लाभ', 'सुविधा लाभ')}
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-sm mt-1 truncate">
                      {getSchemeTitle(scheme, currentLanguage)}
                    </h5>
                    <p className="text-xs text-slate-500 truncate">
                      {currentLanguage === 'en' ? scheme.titleHindi : scheme.title}
                    </p>
                    <a
                      href={resolveSchemePortalUrl(scheme)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 hover:underline"
                    >
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span>{getOfficialPortalDisplayHost(scheme)}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center justify-end space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectScheme(scheme);
                        onClose();
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>{t('Apply', 'आवेदन करें', 'अर्जी लगावो')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveScheme(item.schemeId)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title={t('Remove from saved schemes', 'सहेजी योजनाओं से हटाएं', 'सहेज्योड़ी लिस्ट सूं हटावो')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            {t('Close', 'बंद करें', 'बंद करो')}
          </button>
        </div>
      </div>
    </div>
  );
};
