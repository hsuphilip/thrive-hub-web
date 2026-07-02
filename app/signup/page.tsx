"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Bump this whenever the Privacy Notice (app/privacy) changes materially.
// Matches the notice's "Last updated" date.
const PRIVACY_VERSION = "2026-06-11";

export default function Signup() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const name = fullName.trim();
    if (!name || !email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!consent) { setError("Please review and accept the Privacy Notice to continue."); return; }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          // Everyone signs up as a patient; PT accounts are granted
          // manually in the database (see supabase/lock-down-pt-role.sql).
          role: "client",
          privacy_consented_at: new Date().toISOString(),
          privacy_version: PRIVACY_VERSION,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // Supabase returns a user with an empty identities array when the email
    // is already registered (it avoids leaking which emails exist).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists. Try signing in instead.");
      return;
    }
    if (data.session) {
      // Email confirmation is disabled — the user is signed in already.
      router.replace("/dashboard");
    } else {
      // Email confirmation is required — tell them to check their inbox.
      setConfirmSent(true);
    }
  };

  if (confirmSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={72} height={72} className="mb-4" />
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">Check your email</h1>
          <p className="font-inter text-sm text-on-surface-variant mt-3">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-on-background">{email}</span>. Click it to activate your account,
            then sign in.
          </p>
          <Link href="/login" className="text-primary font-semibold text-sm hover:underline mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={72} height={72} className="mb-4" />
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">Create Account</h1>
          <p className="font-inter text-sm text-on-surface-variant mt-1">Join Thrive Hub</p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div>
            <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">FULL NAME</label>
            <input
              type="text"
              className="w-full bg-surface-container-low rounded-2xl px-4 py-3.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Alex Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
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
          <div>
            <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">PASSWORD</label>
            <input
              type="password"
              className="w-full bg-surface-container-low rounded-2xl px-4 py-3.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary shrink-0"
            />
            <span className="font-inter text-xs text-on-surface-variant leading-relaxed">
              I understand Thrive Hub is used for exercise tracking and prescription only, and I agree to
              the{" "}
              <Link href="/privacy" target="_blank" className="text-primary font-semibold hover:underline">
                Privacy Notice
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-error font-inter text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 mt-2 transition-opacity hover:opacity-90 disabled:opacity-60">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center mt-6 font-inter text-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
