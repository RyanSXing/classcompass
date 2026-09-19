"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Banner } from "@/components/shared";
import { useWorkspace } from "@/components/workspace-provider";
import { api } from "@/lib/client/api";
export default function Login() {
  const { data, refresh } = useWorkspace();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="login-page">
      <Card className="login-card">
        <Brand />
        <h1>Teacher sign in</h1>
        <p>Sign in to your private teacher workspace.</p>
        {error && (
          <div className="mb-16">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
        {data?.config.dataBackend === "local" ? (
          <Button onClick={() => router.push("/classroom")}>
            Open fictional classroom
            <ArrowRight />
          </Button>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/api/auth/login", { email, password });
                await refresh();
                router.push("/classroom");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to sign in.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Email address</span>
              <Input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <Input
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : null}Sign in
              <ArrowRight />
            </Button>
          </form>
        )}
        <p className="login-foot">
          <LockKeyhole
            size={12}
            style={{ display: "inline", marginRight: 4 }}
          />
          Use your teacher account.
        </p>
      </Card>
    </div>
  );
}
