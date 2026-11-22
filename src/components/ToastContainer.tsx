import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  details?: string;
  actionLabel?: string;
  actionUrl?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] pointer-events-none no-print"
    >
      {toasts.map(toast => {
        const styles =
          toast.type === 'error'
            ? {
                container: 'bg-rose-50 border-rose-300 text-rose-950',
                icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />,
                titleColor: 'text-rose-950',
                detailColor: 'text-rose-800',
              }
            : toast.type === 'warning'
            ? {
                container: 'bg-amber-50 border-amber-300 text-amber-950',
                icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
                titleColor: 'text-amber-950',
                detailColor: 'text-amber-800',
              }
            : toast.type === 'success'
            ? {
                container: 'bg-emerald-50 border-emerald-300 text-emerald-950',
                icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />,
                titleColor: 'text-emerald-950',
                detailColor: 'text-emerald-800',
              }
            : {
                container: 'bg-slate-900 border-slate-700 text-white',
                icon: <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
                titleColor: 'text-white',
                detailColor: 'text-slate-300',
              };

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-2xl border shadow-lg p-3.5 flex items-start gap-3 transition-all ${styles.container}`}
          >
            {styles.icon}
            <div className="flex-1 min-w-0 text-xs space-y-1">
              {toast.title && (
                <div className={`font-black leading-snug ${styles.titleColor}`}>{toast.title}</div>
              )}
              <p className="font-semibold leading-relaxed">{toast.message}</p>
              {toast.details && (
                <p className={`text-[11px] leading-relaxed ${styles.detailColor}`}>
                  {toast.details}
                </p>
              )}
              {toast.actionUrl && (
                <a
                  href={toast.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold underline mt-1 text-amber-800 hover:text-amber-950"
                >
                  <span>{toast.actionLabel || 'Open Official Portal'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="p-1 rounded-lg hover:bg-black/5 opacity-70 hover:opacity-100 transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
