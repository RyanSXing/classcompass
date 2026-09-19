"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AppState } from "@/lib/contracts";
import type { curriculum } from "@/lib/curriculum";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { CheckCircle2, X, AlertCircle } from "lucide-react";

export type WorkspaceData = {
  state: AppState;
  config: {
    aiMode: "fixture" | "live";
    dataBackend: "local" | "supabase";
    teacher: string;
  };
  curriculum: typeof curriculum;
};
type WorkspaceContextValue = {
  data: WorkspaceData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  mutate: <T>(path: string, body: unknown, method?: string) => Promise<T>;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const result = await api<WorkspaceData>("/api/classroom");
      setData(result);
      setError(null);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        !location.pathname.startsWith("/login")
      )
        router.replace("/login");
      setError(
        e instanceof Error ? e.message : "Unable to load your classroom.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);
  // Initial external-store fetch; state updates happen only after the request resolves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);
  const mutate = useCallback(
    async <T,>(path: string, body: unknown, method?: string) => {
      try {
        const result = await api<T>(path, body, method);
        await refresh();
        return result;
      } catch (e) {
        notify(
          e instanceof Error ? e.message : "Couldn't save this change.",
          true,
        );
        throw e;
      }
    },
    [refresh, notify],
  );
  return (
    <WorkspaceContext.Provider
      value={{ data, loading, error, refresh, notify, mutate }}
    >
      {children}
      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`} role="status">
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Missing workspace provider");
  return context;
}
