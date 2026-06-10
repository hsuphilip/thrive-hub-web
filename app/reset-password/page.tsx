"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // The reset link from the email establishes a temporary recovery session.
  // Confirm it exists before letting the user set a new password.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={72} height={72} className="mb-4" />
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">New Password</h1>
          <p className="font-inter text-sm text-on-surface-variant mt-1 text-center">Choose a new password</p>
        </div>

        {done ? (
          <p className="font-inter text-sm text-on-surface-variant text-center">
            Password updated. Taking you to your dashboard…
          </p>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-4">
            <p className="font-inter text-sm text-on-surface-variant text-center">
              This page only works when opened from the password-reset link in your email. If you got here another way,
              request a new link.
            </p>
            <Link href="/forgot-password" className="text-primary font-semibold text-sm hover:underline mt-2">
              Request a reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="flex flex-col gap-4">
            <div>
              <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">NEW PASSWORD</label>
              <input
                type="password"
                className="w-full bg-surface-container-low rounded-2xl px-4 py-3.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">CONFIRM PASSWORD</label>
              <input
                type="password"
                className="w-full bg-surface-container-low rounded-2xl px-4 py-3.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-sm text-error font-inter text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 mt-2 transition-opacity hover:opacity-90 disabled:opacity-60">
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
