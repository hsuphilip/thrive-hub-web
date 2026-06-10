"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Signup() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client" | "pt">("client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName || !email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
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

        {/* Role selector */}
        <div className="mb-5">
          <p className="font-inter font-medium text-xs text-on-surface-variant mb-2 ml-1 tracking-wider">I AM A</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRole("client")}
              className={`flex-1 py-3 rounded-full font-inter font-semibold text-sm transition-colors ${role === "client" ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}>
              Patient
            </button>
            <button
              type="button"
              onClick={() => setRole("pt")}
              className={`flex-1 py-3 rounded-full font-inter font-semibold text-sm transition-colors ${role === "pt" ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}>
              Physical Therapist
            </button>
          </div>
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
