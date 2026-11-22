import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import {
  AdminAuthResult,
  signInAdminWithEmail,
  signInAdminWithGoogle,
} from '../firebase';
import { ToastItem } from './ToastContainer';

interface AdminLoginPageProps {
  onAdminAuthenticated: (result: AdminAuthResult) => void;
  onReturnToCitizenPortal: () => void;
  redirectNotice?: string | null;
  onNotify?: (toast: Omit<ToastItem, 'id'>) => void;
}

function formatAdminLoginError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const raw = err instanceof Error ? err.message : String(err);

  if (code === 'ADMIN_ACCESS_DENIED' || raw.toLowerCase().includes('administrator privileges')) {
    return raw;
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is disabled in Firebase Auth. Use Official Google Sign-In below or enable Email/Password in Firebase Console.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid officer credentials. Verify your authorized email and password.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before completing officer authentication.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Allow popups for this site and retry.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Wait a moment before retrying.';
  }
  return raw || 'Administrator authentication failed.';
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onAdminAuthenticated,
  onReturnToCitizenPortal,
  redirectNotice,
  onNotify,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleAdminSignIn = async () => {
    if (isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const result = await signInAdminWithGoogle();
      onAdminAuthenticated(result);
    } catch (err) {
      const msg = formatAdminLoginError(err);
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Officer Authentication Failed',
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Enter both your authorized officer email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signInAdminWithEmail(email, password);
      onAdminAuthenticated(result);
    } catch (err) {
      const msg = formatAdminLoginError(err);
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Admin Sign-In Failed',
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Restricted Access Bar */}
      <div className="border-b border-slate-800 bg-slate-900/90 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
              District Administration Indore &amp; IMC
            </p>
            <p className="text-[11px] text-slate-400">
              Restricted Administrative Gateway • Role-Based Access Control (RBAC)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReturnToCitizenPortal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Citizen Portal</span>
        </button>
      </div>

      {/* Main Centered Admin Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-7 pt-7 pb-5 border-b border-slate-800 bg-slate-900/60">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 text-[11px] font-bold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authorized Officer Sign-In Only</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight font-heading">
              YojanaSetu Admin Console
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Sign in with a provisioned District Collectorate or IMC Administrator account. Public registration is disabled on this route.
            </p>
          </div>

          <div className="p-7 space-y-5">
            {redirectNotice && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-medium flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{redirectNotice}</span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Official Google Admin Sign-In */}
            <button
              type="button"
              onClick={handleGoogleAdminSignIn}
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-purple-700" />
              )}
              <span>Sign In with Authorized Google Account</span>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Or Officer Credentials
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Officer Email & Password Sign-In (Strictly No Sign-Up) */}
            <form onSubmit={handleEmailAdminSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email-input"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Official Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-email-input"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="officer@indore.gov.in"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-password-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter officer password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>Verify Admin Role &amp; Sign In</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              All admin API requests require a cryptographically verified Firebase ID token with a confirmed <code className="text-purple-300 font-mono">admin</code> role claim. Citizen accounts cannot access this console.
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-900">
        © 2026 YojanaSetu Indore • District Collectorate Security Perimeter
      </footer>
    </div>
  );
};
