"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={72} height={72} className="mb-4" />
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">Reset Password</h1>
          <p className="font-inter text-sm text-on-surface-variant mt-1 text-center">
            {sent ? "Check your inbox" : "We'll email you a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4">
            <p className="font-inter text-sm text-on-surface-variant text-center">
              If an account exists for <span className="font-semibold text-on-background">{email}</span>, a password
              reset link is on its way. Follow the link in that email to choose a new password.
            </p>
            <Link href="/login" className="text-primary font-semibold text-sm hover:underline mt-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div>
                <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">EMAIL</label>
                <input
                  type="email"
                  className="w-full bg-surface-container-low rounded-2xl px-4 py-3.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {error && <p className="text-sm text-error font-inter text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 mt-2 transition-opacity hover:opacity-90 disabled:opacity-60">
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <p className="text-center mt-6 font-inter text-sm text-on-surface-variant">
              Remembered it?{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
