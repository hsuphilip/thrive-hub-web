"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Users, Dumbbell, CalendarDays, MessageCircle, LogOut, BookOpen
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setRole(data?.role ?? null));
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const ptLinks = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/library", label: "Library", icon: BookOpen },
    { href: "/messages", label: "Messages", icon: MessageCircle },
  ];

  const clientLinks = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/workouts", label: "Workouts", icon: Dumbbell },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/messages", label: "Messages", icon: MessageCircle },
  ];

  const links = role === "pt" ? ptLinks : clientLinks;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-surface-container-lowest border-r border-outline-variant/50 shrink-0">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5 border-b border-outline-variant/50 hover:opacity-80 transition-opacity">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={28} height={28} style={{ width: 28, height: "auto" }} />
          <span className="font-manrope font-bold text-base text-primary">Thrive Hub</span>
        </Link>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-inter font-medium transition-colors
                  ${active ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container"}`}>
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-6 py-4 text-sm font-inter text-on-surface-variant hover:text-on-background border-t border-outline-variant/50 transition-colors">
          <LogOut size={16} />
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* Bottom nav — mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/50 flex">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-inter font-medium transition-colors
                  ${active ? "text-primary" : "text-outline"}`}>
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-inter font-medium text-outline transition-colors">
            <LogOut size={20} />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
