import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Toast = { msg: string; key: number };

const ToastContext = createContext<(msg: string) => void>(() => {});

/** The prototype's `flash()` — a transient confirmation above the nav bar. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const flash = useCallback((msg: string) => {
    setToast({ msg, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => flash, [flash]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
