"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={72} height={72} className="mb-4" />
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">Thrive Hub</h1>
          <p className="font-inter text-sm text-on-surface-variant mt-1">Sign in to continue your recovery</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-error font-inter text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 mt-2 transition-opacity hover:opacity-90 disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-6 font-inter text-sm text-on-surface-variant">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
