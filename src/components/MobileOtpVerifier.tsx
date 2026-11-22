import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { parseApiResponse } from '../utils/apiClient';
import { validateIndianMobile } from '../utils/samagraValidator';
import { ToastItem } from './ToastContainer';
import { SupportedLanguage } from '../types';
import { pickText } from '../utils/i18n';

interface MobileOtpVerifierProps {
  value: string;
  onChange: (value: string) => void;
  isVerified: boolean;
  verificationToken: string | null;
  onVerified: (result: { mobileNumber: string; verificationToken: string }) => void;
  authToken?: string | null;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  currentLanguage?: SupportedLanguage;
  onNotify?: (toast: Omit<ToastItem, 'id'>) => void;
}

export const MobileOtpVerifier: React.FC<MobileOtpVerifierProps> = ({
  value,
  onChange,
  isVerified,
  onVerified,
  authToken,
  required = false,
  disabled = false,
  label,
  currentLanguage = 'en',
  onNotify,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });
  const resolvedLabel =
    label ||
    t('Mobile Number (+91 India)', 'मोबाइल नंबर (+91 भारत)', 'मोबाइल नंबर (+91 भारत)');

  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sentMobileE164, setSentMobileE164] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineErrorDetails, setInlineErrorDetails] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSec(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSec]);

  // Reset OTP challenge if user edits phone number away from the challenged one
  useEffect(() => {
    const check = validateIndianMobile(value);
    if (sentMobileE164 && (!check.valid || check.e164 !== sentMobileE164)) {
      setOtpSent(false);
      setOtpCode('');
      setSentMobileE164(null);
      setInlineSuccess(null);
    }
  }, [value, sentMobileE164]);

  const handleSendOtp = async () => {
    if (sendingOtp || verifyingOtp || cooldownSec > 0 || disabled) return;
    setInlineError(null);
    setInlineErrorDetails(null);
    setInlineSuccess(null);

    const check = validateIndianMobile(value);
    if (!check.valid) {
      const msg =
        check.error ||
        'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).';
      setInlineError(msg);
      onNotify?.({
        type: 'warning',
        title: t('Invalid Mobile Number', 'अमान्य मोबाइल नंबर', 'गलत मोबाइल नंबर'),
        message: msg,
      });
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch('/api/auth/mobile/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: check.e164 }),
      });
      const parsed = await parseApiResponse<{
        mobileNumber?: string;
        cooldownSeconds?: number;
        message?: string;
        retryAfterSeconds?: number;
      }>(res);

      if (!parsed.ok) {
        const errInfo = parsed.errorInfo || {
          status: parsed.status,
          error: 'Could not send mobile verification OTP.',
        };
        if (parsed.status === 429 && typeof parsed.data?.retryAfterSeconds === 'number') {
          setCooldownSec(Math.max(1, parsed.data.retryAfterSeconds));
        }
        setInlineError(errInfo.error);
        setInlineErrorDetails(errInfo.details || null);
        onNotify?.({
          type: 'error',
          title: parsed.status === 503 ? 'SMS Gateway Not Configured' : 'OTP Send Failed',
          message: errInfo.error,
          details: errInfo.details,
        });
        return;
      }

      const cooldown = parsed.data?.cooldownSeconds ?? 60;
      setSentMobileE164(parsed.data?.mobileNumber || check.e164);
      setOtpSent(true);
      setOtpCode('');
      setCooldownSec(cooldown);
      const okMsg =
        parsed.data?.message ||
        `A 6-digit OTP has been sent to ${check.e164}. Valid for 5 minutes.`;
      setInlineSuccess(okMsg);
      onNotify?.({
        type: 'success',
        title: t('OTP Dispatched', 'OTP भेजा गया', 'OTP भेज दियो गयो'),
        message: okMsg,
      });
    } catch (err) {
      const msg = 'Network error while requesting SMS OTP. Please verify server connectivity.';
      setInlineError(msg);
      setInlineErrorDetails(err instanceof Error ? err.message : null);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (verifyingOtp || sendingOtp || disabled) return;
    setInlineError(null);
    setInlineErrorDetails(null);
    setInlineSuccess(null);

    const check = validateIndianMobile(value);
    if (!check.valid) {
      setInlineError(
        check.error ||
          'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).'
      );
      return;
    }

    const cleanOtp = otpCode.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(cleanOtp)) {
      setInlineError(
        t(
          'Please enter the 6-digit numeric OTP.',
          'कृपया 6-अंकीय OTP दर्ज करें।',
          'कृपया 6 अंक रो OTP लिखो।'
        )
      );
      return;
    }

    setVerifyingOtp(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/auth/mobile/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mobileNumber: check.e164,
          otp: cleanOtp,
        }),
      });

      const parsed = await parseApiResponse<{
        mobileNumber?: string;
        mobileVerified?: boolean;
        verificationToken?: string;
        message?: string;
      }>(res);

      if (!parsed.ok || !parsed.data?.mobileVerified || !parsed.data?.verificationToken) {
        const errInfo = parsed.errorInfo || {
          status: parsed.status,
          error: 'Could not verify OTP. Please try again.',
        };
        setInlineError(errInfo.error);
        setInlineErrorDetails(errInfo.details || null);
        onNotify?.({
          type: 'error',
          title: 'OTP Verification Failed',
          message: errInfo.error,
          details: errInfo.details,
        });
        return;
      }

      const verifiedMobile = parsed.data.mobileNumber || check.e164;
      setOtpSent(false);
      setOtpCode('');
      setCooldownSec(0);
      setInlineSuccess(parsed.data.message || `Mobile number ${verifiedMobile} verified.`);
      onVerified({
        mobileNumber: verifiedMobile,
        verificationToken: parsed.data.verificationToken,
      });
      onNotify?.({
        type: 'success',
        title: t('Mobile Number Verified', 'मोबाइल नंबर सत्यापित', 'मोबाइल नंबर पक्को हो गयो'),
        message: `${verifiedMobile} verified via live SMS OTP.`,
      });
    } catch (err) {
      const msg = 'Network error while verifying OTP.';
      setInlineError(msg);
      setInlineErrorDetails(err instanceof Error ? err.message : null);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-700">
          {resolvedLabel} {required && '*'}
        </label>
        {isVerified ? (
          <span
            data-testid="mobile-verified-badge"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{t('Mobile Verified', 'मोबाइल सत्यापित', 'मोबाइल पक्को')}</span>
          </span>
        ) : value.trim().length > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <span>
              {required
                ? t('OTP Verification Pending', 'OTP सत्यापन शेष', 'OTP जांच बाकी')
                : t('OTP Optional', 'OTP वैकल्पिक', 'OTP चाहो तो')}
            </span>
          </span>
        ) : null}
      </div>
      {!required && !isVerified && (
        <p className="text-[11px] text-slate-500">
          {t(
            'Optional: You can create your account or save changes right away and verify SMS OTP anytime.',
            'वैकल्पिक: आप बिना OTP के भी तुरंत खाता बना सकते हैं और बाद में मोबाइल सत्यापित कर सकते हैं।',
            'चाहो तो: बिना OTP भी तुरंत नयो खातो बण सके छे, मोबाइल जांच बाद मां भी कर सको छो।'
          )}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="tel"
            value={value}
            onChange={e => {
              setInlineError(null);
              setInlineErrorDetails(null);
              onChange(e.target.value);
            }}
            required={required}
            disabled={disabled}
            placeholder="+91 9826012345"
            maxLength={16}
            data-testid="mobile-number-input"
            className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tabular-nums disabled:bg-slate-50"
          />
        </div>

        <button
          type="button"
          onClick={handleSendOtp}
          disabled={sendingOtp || verifyingOtp || cooldownSec > 0 || disabled || !value.trim()}
          data-testid="send-otp-btn"
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-55 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer shrink-0"
        >
          {sendingOtp ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t('Sending...', 'भेज रहे हैं...', 'भेज रिया...')}</span>
            </>
          ) : cooldownSec > 0 ? (
            <span>
              {t(`Resend OTP (${cooldownSec}s)`, `पुनः भेजें (${cooldownSec}s)`, `फेर भेजो (${cooldownSec}s)`)}
            </span>
          ) : (
            <>
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {otpSent
                  ? t('Resend OTP', 'OTP पुनः भेजें', 'OTP फेर भेजो')
                  : isVerified
                  ? t('Re-verify Mobile', 'पुनः सत्यापित करें', 'फेर जांचो')
                  : t('Send OTP', 'OTP भेजें', 'OTP भेजो')}
              </span>
            </>
          )}
        </button>
      </div>

      {otpSent && !isVerified && (
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
          <p className="text-[11px] font-semibold text-amber-950">
            {t(
              'Enter the 6-digit SMS OTP sent to',
              'भेजा गया 6-अंकीय SMS OTP दर्ज करें:',
              'मोबाइल पर आयो 6 अंक रो OTP लिखो:'
            )}{' '}
            <span className="font-mono">{sentMobileE164}</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('Enter 6-digit OTP', '6-अंकीय OTP दर्ज करें', '6 अंक रो OTP लिखो')}
              maxLength={6}
              disabled={verifyingOtp || disabled}
              data-testid="otp-code-input"
              className="flex-1 px-3 py-1.5 text-sm font-mono tracking-widest border border-amber-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={handleConfirmOtp}
              disabled={verifyingOtp || otpCode.length !== 6 || disabled}
              data-testid="confirm-otp-btn"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-55 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer"
            >
              {verifyingOtp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>{t('Confirm OTP', 'OTP सत्यापित करें', 'OTP पक्को करो')}</span>
            </button>
          </div>
        </div>
      )}

      {inlineError && (
        <div
          role="alert"
          data-testid="mobile-otp-error"
          className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-[11px] flex items-start gap-2"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">{inlineError}</p>
            {inlineErrorDetails && <p className="text-rose-700">{inlineErrorDetails}</p>}
          </div>
        </div>
      )}

      {inlineSuccess && !inlineError && (
        <div
          role="status"
          data-testid="mobile-otp-success"
          className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="font-medium">{inlineSuccess}</p>
        </div>
      )}
    </div>
  );
};
