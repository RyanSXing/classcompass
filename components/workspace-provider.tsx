"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
    aiProvider?: "openrouter" | "deepseek";
    assistantLiveAvailable?: boolean;
    sampleToolsEnabled?: boolean;
  };
  curriculum: typeof curriculum;
};
type MutationOptions = { suppressErrorNotification?: boolean };
type WorkspaceContextValue = {
  data: WorkspaceData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearWorkspace: () => void;
  /** Returns true only after this browser session has ended. */
  signOut: () => Promise<boolean>;
  notify: (message: string, error?: boolean) => void;
  mutate: <T>(
    path: string,
    body: unknown,
    method?: string,
    options?: MutationOptions,
  ) => Promise<T>;
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
  const workspaceEpoch = useRef(0);
  const refreshSequence = useRef(0);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const clearWorkspace = useCallback(() => {
    workspaceEpoch.current += 1;
    setData(null);
    setError(null);
    setToast(null);
  }, []);
  const handleUnauthenticated = useCallback(() => {
    clearWorkspace();
    if (typeof window === "undefined" || window.location.pathname.startsWith("/login")) return;
    const next = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [clearWorkspace, router]);
  const refresh = useCallback(async () => {
    const requestedEpoch = workspaceEpoch.current;
    const requestedSequence = ++refreshSequence.current;
    try {
      const result = await api<WorkspaceData>("/api/classroom");
      if (
        requestedEpoch !== workspaceEpoch.current ||
        requestedSequence !== refreshSequence.current
      )
        return;
      setData(result);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthenticated();
        return;
      }
      if (
        requestedEpoch !== workspaceEpoch.current ||
        requestedSequence !== refreshSequence.current
      )
        return;
      setError(
        e instanceof Error ? e.message : "Unable to load your classroom.",
      );
    } finally {
      if (
        requestedEpoch === workspaceEpoch.current &&
        requestedSequence === refreshSequence.current
      )
        setLoading(false);
    }
  }, [handleUnauthenticated]);
  // Initial external-store fetch; state updates happen only after the request resolves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useEffect(() => {
    window.addEventListener("classcompass:unauthenticated", handleUnauthenticated);
    return () =>
      window.removeEventListener(
        "classcompass:unauthenticated",
        handleUnauthenticated,
      );
  }, [handleUnauthenticated]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);
  const mutate = useCallback(
    async <T,>(
      path: string,
      body: unknown,
      method?: string,
      options?: MutationOptions,
    ) => {
      try {
        const result = await api<T>(path, body, method);
        await refresh();
        return result;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          handleUnauthenticated();
          throw e;
        }
        if (!options?.suppressErrorNotification)
          notify(
            e instanceof Error ? e.message : "Couldn't save this change.",
            true,
          );
        throw e;
      }
    },
    [refresh, notify, handleUnauthenticated],
  );
  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", {});
    } catch {
      notify("Couldn't sign out. Try again.", true);
      return false;
    }
    clearWorkspace();
    router.replace("/login");
    router.refresh();
    return true;
  }, [clearWorkspace, notify, router]);
  return (
    <WorkspaceContext.Provider
      value={{ data, loading, error, refresh, clearWorkspace, signOut, notify, mutate }}
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
