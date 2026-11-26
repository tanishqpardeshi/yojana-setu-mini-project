import React from 'react';
import {
  ShieldCheck,
  Printer,
  X,
  QrCode,
  CheckCircle,
  Building2,
  Award,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { CitizenProfile, SchemeEligibilityResult, SupportedLanguage } from '../types';
import {
  computeEntitlementDigest,
  getOfficialPortalDisplayHost,
  resolveSchemePortalUrl,
} from '../utils/liveDataEngine';
import {
  getFrequencyLabel,
  getGenderLabel,
  getGovernanceLevelLabel,
  getSchemeTitle,
  pickText,
} from '../utils/i18n';

interface CitizenEntitlementCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CitizenProfile;
  eligibilityResults: SchemeEligibilityResult[];
  currentLanguage: SupportedLanguage;
}

export const CitizenEntitlementCardModal: React.FC<CitizenEntitlementCardModalProps> = ({
  isOpen,
  onClose,
  profile,
  eligibilityResults,
  currentLanguage,
}) => {
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [showQrDeepLinkModal, setShowQrDeepLinkModal] = React.useState(false);

  if (!isOpen) return null;

  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const eligibleSchemes = eligibilityResults.filter(r => r.status === 'eligible');
  const likelySchemes = eligibilityResults.filter(r => r.status === 'likely');
  const totalQualifiedCount = eligibleSchemes.length + likelySchemes.length;

  const annualCashTotal = eligibleSchemes.reduce((sum, item) => {
    const ent = item.scheme.financialEntitlement;
    if (ent.frequency === 'Monthly') return sum + ent.amount * 12;
    if (ent.frequency === 'Annual') return sum + ent.amount;
    return sum;
  }, 0);

  const oneTimeCashTotal = eligibleSchemes.reduce((sum, item) => {
    const ent = item.scheme.financialEntitlement;
    if (ent.frequency === 'One-Time' || ent.frequency === 'Subsidized Loan') return sum + ent.amount;
    return sum;
  }, 0);

  const cardRef = 'YS-ENT-' + (profile.samagraMemberId || 'UNLINKED');
  const digest = computeEntitlementDigest(
    profile.samagraMemberId || profile.fullName || 'GUEST',
    eligibleSchemes.map(e => e.scheme.id)
  );
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const verificationUrl = `${origin}/tracker?verifyARN=${encodeURIComponent(cardRef)}`;

  const whatsappText =
    `YojanaSetu Indore - Citizen Entitlement Card\n` +
    `Citizen: ${profile.fullName || 'Unlinked Citizen'}\n` +
    `Samagra Member ID: ${profile.samagraMemberId || 'Not Linked'}\n` +
    `Qualified Schemes: ${totalQualifiedCount} (${eligibleSchemes.length} Fully Eligible)\n` +
    `Annual Cash Entitlement: ₹${annualCashTotal.toLocaleString('en-IN')}/yr\n` +
    `Certificate Ref: ${cardRef} (${digest})\n` +
    `Verify: ${verificationUrl}`;
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(verificationUrl);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard may be restricted in sandboxed contexts
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Top Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-wrap justify-between items-center gap-2 no-print border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2 text-xs font-semibold min-w-0">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              {t(
                'Official Citizen Entitlement Certificate • Indore District',
                'आधिकारिक नागरिक पात्रता प्रमाण पत्र • इंदौर जिला',
                'सरकारी नागरिक पात्रता पत्रक • इंदौर जिला'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t('Share on WhatsApp', 'व्हाट्सएप पर भेजें', 'व्हाट्सएप पर भेजो')}</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('Print / Save PDF', 'प्रिंट / पीडीएफ सहेजें', 'प्रिंट / पीडीएफ निकालो')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Close certificate', 'बंद करें', 'बंद करो')}
              className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-4 sm:p-8 space-y-6 bg-slate-50/40 overflow-y-auto flex-1">
          <div className="border-4 border-double border-amber-600/60 p-4 sm:p-6 bg-white rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
              <Building2 className="w-96 h-96 text-slate-900" />
            </div>

            <div className="text-center space-y-1 pb-4 border-b-2 border-amber-500/40">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-widest font-heading">
                {t(
                  'Government of Madhya Pradesh • District Administration Indore',
                  'मध्य प्रदेश शासन • जिला प्रशासन इंदौर',
                  'मध्य प्रदेश सरकार • जिला प्रशासन इंदौर'
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
                {t(
                  'Citizen Welfare Entitlement Card',
                  'नागरिक अधिकार व शासकीय पात्रता पत्रक',
                  'नागरिक हक व सरकारी पात्रता पत्रक'
                )}
              </h2>
              <p className="text-xs text-slate-600">
                {t(
                  'Live Citizen Welfare Entitlement Card • Indore Municipal & Janpad Jurisdiction',
                  'लाइव नागरिक कल्याण पात्रता कार्ड • इंदौर नगर निगम एवं जनपद क्षेत्र',
                  'लाइव नागरिक पात्रता कार्ड • इंदौर नगर निगम अने जनपद क्षेत्र'
                )}
              </p>
              <div className="inline-block mt-1 px-3 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full font-mono">
                {t('Certificate ID:', 'प्रमाण पत्र संख्या:', 'पत्रक नंबर:')} {cardRef} • FY 2026-27
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  {t('Citizen Name', 'नागरिक का नाम', 'नागरिक रो नाम')}
                </span>
                <div className="font-bold text-slate-900 truncate">
                  {profile.fullName || t('Not Linked Yet', 'अभी लिंक नहीं', 'अभी जुड़यो नी')}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  {t('Samagra Member ID', 'समग्र सदस्य आईडी', 'समग्र सदस्य नंबर')}
                </span>
                <div className="font-mono font-bold text-slate-900">
                  {profile.samagraMemberId || t('Not Linked', 'लिंक नहीं', 'जुड़यो नी')}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  {t('Age / Gender', 'आयु / लिंग', 'उमर / लिंग')}
                </span>
                <div className="font-semibold text-slate-900">
                  {profile.age} {t('Yrs', 'वर्ष', 'बरस')} • {getGenderLabel(profile.gender, currentLanguage)}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  {t('Jurisdiction', 'क्षेत्राधिकार', 'इलाको')}
                </span>
                <div className="font-semibold text-slate-900">
                  {profile.areaType === 'urban'
                    ? t(`Ward ${profile.wardNumber || 'IMC'}`, `वार्ड ${profile.wardNumber || 'निगम'}`, `वार्ड ${profile.wardNumber || 'निगम'}`)
                    : `${profile.blockName || t('Janpad', 'जनपद', 'जनपद')}`}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">
                  {t('Annual Direct Cash Entitlement', 'वार्षिक प्रत्यक्ष नकद लाभ', 'सालाना सीधा रुपया लाभ')}
                </span>
                <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                  ₹{annualCashTotal.toLocaleString('en-IN')}
                  <span className="text-xs font-normal">{t('/yr', '/वर्ष', '/साल')}</span>
                </div>
                <div className="text-[9px] text-emerald-700 mt-0.5">
                  {t('Via Aadhaar DBT Bank Transfer', 'आधार डीबीटी बैंक खाते में', 'सीधा बैंक खाता मां डीबीटी सूं')}
                </div>
              </div>

              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-blue-800 uppercase">
                  {t('One-Time Capital Subsidy', 'एकमुश्त पूंजीगत अनुदान', 'एक बार रो अनुदान / सब्सिडी')}
                </span>
                <div className="text-xl font-black text-blue-700 font-mono mt-0.5">
                  ₹{oneTimeCashTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[9px] text-blue-700 mt-0.5">
                  {t('Housing, Tools & Asset Grants', 'आवास, उपकरण व संपत्ति अनुदान', 'मकान, औजार अने सामान खातर मदद')}
                </div>
              </div>

              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-800 uppercase">
                  {t('Total Pre-Qualified Schemes', 'कुल पूर्व-पात्र योजनाएं', 'कुल पात्र योजना')}
                </span>
                <div className="text-xl font-black text-amber-700 font-mono mt-0.5">
                  {totalQualifiedCount}{' '}
                  <span className="text-xs font-normal">{t('Schemes', 'योजनाएं', 'योजना')}</span>
                </div>
                <div className="text-[9px] text-amber-700 mt-0.5">
                  {t(
                    `${eligibleSchemes.length} Fully Eligible • ${likelySchemes.length} Likely`,
                    `${eligibleSchemes.length} पूर्ण पात्र • ${likelySchemes.length} संभावित`,
                    `${eligibleSchemes.length} पक्की पात्र • ${likelySchemes.length} कागद बाकी`
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {t(
                    'Pre-Qualified Scheme Portfolio (Live Rules Engine)',
                    'पात्र योजनाओं की सूची (लाइव नियम इंजन)',
                    'पात्र योजना री लिस्ट (लाइव नियम जांच)'
                  )}
                </span>
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">{t('Tier', 'स्तर', 'स्तर')}</th>
                      <th className="px-3 py-2">{t('Scheme Name', 'योजना का नाम', 'योजना रो नाम')}</th>
                      <th className="px-3 py-2">{t('Entitlement Amount', 'पात्र राशि', 'मिलण वाली रकम')}</th>
                      <th className="px-3 py-2">{t('Match Status', 'पात्रता स्थिति', 'पात्रता')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {eligibleSchemes.slice(0, 6).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-[10px] font-semibold text-slate-500">
                          {getGovernanceLevelLabel(item.scheme.governanceLevel, currentLanguage)}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {getSchemeTitle(item.scheme, currentLanguage)}
                          <div className="text-[10px] font-normal text-slate-500">
                            {currentLanguage === 'en' ? item.scheme.titleHindi : item.scheme.title}
                          </div>
                          <a
                            href={resolveSchemePortalUrl(item.scheme)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                          >
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span>{getOfficialPortalDisplayHost(item.scheme)}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          ₹{item.scheme.financialEntitlement.amount.toLocaleString('en-IN')}{' '}
                          <span className="text-[9px] text-slate-500 font-normal">
                            ({getFrequencyLabel(item.scheme.financialEntitlement.frequency, currentLanguage)})
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px]">
                            {t('ELIGIBLE (100%)', 'पात्र (100%)', 'पक्का पात्र (100%)')}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {likelySchemes.slice(0, 3).map((item, idx) => (
                      <tr key={`likely-${idx}`} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-[10px] font-semibold text-slate-500">
                          {getGovernanceLevelLabel(item.scheme.governanceLevel, currentLanguage)}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-800">
                          {getSchemeTitle(item.scheme, currentLanguage)}
                          <div className="text-[10px] font-normal text-slate-500">
                            {currentLanguage === 'en' ? item.scheme.titleHindi : item.scheme.title}
                          </div>
                          <a
                            href={resolveSchemePortalUrl(item.scheme)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                          >
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span>{getOfficialPortalDisplayHost(item.scheme)}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-amber-700 whitespace-nowrap">
                          ₹{item.scheme.financialEntitlement.amount.toLocaleString('en-IN')}{' '}
                          <span className="text-[9px] text-slate-500 font-normal">
                            ({getFrequencyLabel(item.scheme.financialEntitlement.frequency, currentLanguage)})
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[9px]">
                            {t(`LIKELY (${item.matchScore}%)`, `संभावित (${item.matchScore}%)`, `मिल सके छे (${item.matchScore}%)`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowQrDeepLinkModal(true)}
                  className="w-14 h-14 bg-slate-100 hover:bg-amber-50 border border-slate-300 hover:border-amber-400 rounded-xl flex flex-col items-center justify-center p-1 cursor-pointer transition group"
                >
                  <QrCode className="w-10 h-10 text-slate-800 group-hover:text-amber-700" />
                  <span className="text-[8px] font-bold text-amber-700 group-hover:underline">
                    {t('Verify', 'सत्यापित', 'जांचो')}
                  </span>
                </button>
                <div className="text-[10px] text-slate-500">
                  <div className="font-bold text-slate-800 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('Computed Entitlement Digest', 'सत्यापित पात्रता कोड', 'पक्की पात्रता कोड')}</span>
                  </div>
                  <div className="font-mono">DIGEST: {digest}</div>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className="font-mono text-slate-700 font-semibold">{cardRef}</span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-amber-700 hover:text-amber-900 font-bold ml-1 flex items-center space-x-0.5 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>
                        {copiedLink
                          ? t('Copied!', 'कॉपी हो गया!', 'कॉपी हो गयो!')
                          : t('Copy Link', 'लिंक कॉपी करें', 'लिंक कॉपी करो')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-center sm:text-right text-[11px] text-slate-600">
                <div className="font-mono font-bold text-slate-900">
                  {t('[Official Digital Seal]', '[आधिकारिक डिजिटल मुहर]', '[सरकारी डिजिटल मुहर]')}
                </div>
                <div className="font-semibold text-slate-800">
                  {t('Nodal Verification Officer', 'नोडल सत्यापन अधिकारी', 'नोडल जांच अधिकारी')}
                </div>
                <div>
                  {t(
                    'Collectorate Campus, Moti Tabela, Indore 452007',
                    'कलेक्ट्रेट परिसर, मोती तबेला, इंदौर 452007',
                    'कलेक्ट्रेट परिसर, मोती तबेला, इंदौर 452007'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 no-print">
          <div className="flex items-center space-x-2">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t('Share on WhatsApp', 'व्हाट्सएप पर भेजें', 'व्हाट्सएप पर भेजो')}</span>
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1 border border-slate-200 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>
                {copiedLink
                  ? t('Link Copied!', 'लिंक कॉपी हो गया!', 'लिंक कॉपी हो गयो!')
                  : t('Copy Verification URL', 'सत्यापन लिंक कॉपी करें', 'जांच लिंक कॉपी करो')}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('Print', 'प्रिंट करें', 'प्रिंट करो')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              {t('Close', 'बंद करें', 'बंद करो')}
            </button>
          </div>
        </div>
      </div>

      {/* QR Verification Modal */}
      {showQrDeepLinkModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <QrCode className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {t('Digital Certificate Verification', 'डिजिटल प्रमाण पत्र सत्यापन', 'डिजिटल पत्रक जांच')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t(
                  `Share this verification link for citizen entitlement record ${cardRef}.`,
                  `नागरिक पात्रता रिकॉर्ड ${cardRef} के लिए यह सत्यापन लिंक साझा करें।`,
                  `नागरिक पात्रता रिकॉर्ड ${cardRef} खातर ई जांच लिंक ने भेजो।`
                )}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs font-mono break-all space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">
                {t('Verification URL', 'सत्यापन लिंक', 'जांच लिंक')}
              </div>
              <div className="text-slate-800 font-semibold">{verificationUrl}</div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>
                  {copiedLink
                    ? t('Copied!', 'कॉपी हो गया!', 'कॉपी हो गयो!')
                    : t('Copy Link', 'लिंक कॉपी करें', 'लिंक कॉपी करो')}
                </span>
              </button>
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowQrDeepLinkModal(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 pt-2 cursor-pointer"
            >
              {t('Close', 'बंद करें', 'बंद करो')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
