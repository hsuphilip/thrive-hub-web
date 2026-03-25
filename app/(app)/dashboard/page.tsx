"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Users, Dumbbell, MessageCircle, ChevronRight, BarChart2,
  CheckCircle2, Play, Stethoscope, ClipboardList, UserPlus, TriangleAlert
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = { full_name: string; role: string };
type Exercise = { id: string; name: string; sets: number; detail: string; done: boolean; program_id: string };
type Program = { id: string; title: string; estimated_minutes: number; sessions_per_week: number | null };
type Message = { sender: { full_name: string }; content: string } | null;
type PtClientStat = { id: string; full_name: string; sessions_this_week: number; last_active: string | null };

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [latestMessage, setLatestMessage] = useState<Message>(null);
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5);
  const [loading, setLoading] = useState(true);
  const [ptClients, setPtClients] = useState<PtClientStat[]>([]);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
    setProfile(prof);

    if (prof?.role === "pt") {
      const { data: clientLinks } = await supabase
        .from("pt_clients")
        .select("client_id, profiles!pt_clients_client_id_fkey(id, full_name)")
        .eq("pt_id", user.id);

      const clients = (clientLinks ?? []).map((c: any) => ({
        id: c.profiles?.id ?? c.client_id,
        full_name: c.profiles?.full_name ?? "Unknown",
      }));

      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

      const clientIds = clients.map((c) => c.id);
      const { data: weekFeedback } = clientIds.length > 0
        ? await supabase.from("exercise_feedback").select("client_id, created_at").in("client_id", clientIds).gte("created_at", weekStart.toISOString())
        : { data: [] };

      const daySetMap: Record<string, Set<string>> = {};
      const lastActiveMap: Record<string, string | null> = {};
      clients.forEach((c) => { daySetMap[c.id] = new Set(); lastActiveMap[c.id] = null; });
      (weekFeedback ?? []).forEach((f: any) => {
        daySetMap[f.client_id]?.add(new Date(f.created_at).toDateString());
        if (!lastActiveMap[f.client_id] || f.created_at > lastActiveMap[f.client_id]) lastActiveMap[f.client_id] = f.created_at;
      });

      setPtClients(clients.map((c) => ({
        id: c.id, full_name: c.full_name,
        sessions_this_week: daySetMap[c.id]?.size ?? 0,
        last_active: lastActiveMap[c.id],
      })));
    }

    if (prof?.role === "client") {
      const { data: progs } = await supabase
        .from("programs").select("id, title, estimated_minutes, sessions_per_week")
        .eq("client_id", user.id).order("created_at", { ascending: false });

      const programList = progs ?? [];
      setAllPrograms(programList);
      if (programList.length > 0) {
        setProgram(programList[0]);
        setSessionsPerWeek(programList[0].sessions_per_week ?? 3);

        const { data: exList } = await supabase.from("exercises")
          .select("id, name, sets, detail, program_id")
          .in("program_id", programList.map((p) => p.id)).order("sort_order");

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: todayFeedback } = await supabase.from("exercise_feedback")
          .select("exercise_id").eq("client_id", user.id).gte("created_at", today.toISOString());

        const doneIds = new Set((todayFeedback ?? []).map((f: any) => f.exercise_id));
        setExercises((exList ?? []).map((e) => ({ ...e, done: doneIds.has(e.id) })));

        const weekData = [];
        for (let i = 6; i >= 0; i--) {
          const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - i);
          const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
          const { data: dayFeedback } = await supabase.from("exercise_feedback")
            .select("id").eq("client_id", user.id).gte("created_at", day.toISOString()).lt("created_at", nextDay.toISOString());
          weekData.push((dayFeedback?.length ?? 0) > 0 ? 1 : 0);
        }
        setWeeklyData(weekData);
      }

      const { data: msg } = await supabase.from("messages")
        .select("content, sender_id").or(`receiver_id.eq.${user.id},sender_id.eq.${user.id}`)
        .order("created_at", { ascending: false }).limit(1).single();

      if (msg && msg.sender_id !== user.id) {
        const { data: sender } = await supabase.from("profiles").select("full_name").eq("id", msg.sender_id).single();
        setLatestMessage({ sender: { full_name: sender?.full_name ?? "Your PT" }, content: msg.content });
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatLastActive = (ts: string | null) => {
    if (!ts) return "never active";
    const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
    if (days === 0) return "active today";
    if (days === 1) return "active yesterday";
    return `active ${days}d ago`;
  };

  const isInactive = (ts: string | null) => !ts || (Date.now() - new Date(ts).getTime()) > 3 * 86400000;

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const completedCount = exercises.filter((e) => e.done).length;
  const totalCount = exercises.length;
  const activeDaysThisWeek = weeklyData.filter(Boolean).length;
  const weeklyPct = Math.min(100, Math.round((activeDaysThisWeek / sessionsPerWeek) * 100));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── PT Dashboard ──────────────────────────────────────────────
  if (profile?.role === "pt") {
    const activeCount = ptClients.filter((c) => !isInactive(c.last_active)).length;
    const inactiveClients = ptClients.filter((c) => isInactive(c.last_active));
    const sortedClients = [...ptClients].sort((a, b) => b.sessions_this_week - a.sessions_this_week);

    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={32} height={32} />
          <span className="font-manrope font-bold text-base text-primary">Thrive Hub</span>
          <div className="w-8" />
        </div>

        {/* Greeting */}
        <div className="mb-6">
          <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-1">PT Dashboard</p>
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">
            {greeting},<br />{firstName}.
          </h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-primary rounded-2xl p-4 flex flex-col items-center">
            <span className="font-manrope font-extrabold text-4xl text-on-primary">{ptClients.length}</span>
            <span className="font-inter text-xs text-primary-container mt-1">{ptClients.length === 1 ? "client" : "clients"}</span>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center shadow-sm">
            <span className="font-manrope font-extrabold text-4xl text-primary">{activeCount}</span>
            <span className="font-inter text-xs text-on-surface-variant mt-1">active this week</span>
          </div>
        </div>

        {/* Needs attention */}
        {inactiveClients.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TriangleAlert size={15} className="text-error" />
              <span className="font-inter font-semibold text-sm text-error">Needs attention</span>
            </div>
            <div className="flex flex-col gap-2">
              {inactiveClients.map((c) => (
                <button key={c.id} onClick={() => router.push(`/clients`)}
                  className="bg-error-container rounded-2xl px-4 py-3 flex items-center justify-between w-full text-left">
                  <div>
                    <p className="font-inter font-semibold text-sm text-on-background">{c.full_name}</p>
                    <p className="font-inter text-xs text-on-surface-variant">{formatLastActive(c.last_active)}</p>
                  </div>
                  <ChevronRight size={18} className="text-outline" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* This week */}
        {sortedClients.length > 0 && (
          <div className="mb-6">
            <p className="font-inter font-semibold text-xs text-on-surface-variant tracking-widest mb-3">THIS WEEK</p>
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm divide-y divide-surface-container">
              {sortedClients.map((c) => (
                <button key={c.id} onClick={() => router.push("/clients")}
                  className="flex items-center px-4 py-3 w-full text-left hover:bg-surface-container-low transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center mr-3 shrink-0">
                    <span className="font-inter font-semibold text-sm text-primary">{c.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="font-inter font-medium text-sm text-on-background flex-1">{c.full_name}</span>
                  <span className="font-manrope font-bold text-sm text-primary mr-1">{c.sessions_this_week}</span>
                  <span className="font-inter text-xs text-on-surface-variant mr-2">{c.sessions_this_week === 1 ? "session" : "sessions"}</span>
                  <ChevronRight size={16} className="text-outline" />
                </button>
              ))}
            </div>
          </div>
        )}

        {ptClients.length === 0 && (
          <div className="flex flex-col items-center py-10 mb-6">
            <UserPlus size={36} className="text-outline-variant" />
            <p className="font-inter text-sm text-on-surface-variant mt-2">No clients yet. Add one in the Clients tab.</p>
          </div>
        )}

        {/* Quick links */}
        <button onClick={() => router.push("/clients")}
          className="bg-primary rounded-2xl p-5 flex items-center gap-4 w-full text-left mb-4 hover:opacity-95 transition-opacity">
          <Users size={28} className="text-primary-container shrink-0" />
          <div className="flex-1">
            <p className="font-manrope font-bold text-lg text-on-primary">My Clients</p>
            <p className="font-inter text-sm text-primary-container">Manage programs & messages</p>
          </div>
          <ChevronRight size={20} className="text-primary-container" />
        </button>

        <button onClick={() => router.push("/messages")}
          className="bg-surface-container-lowest rounded-2xl p-5 flex items-center gap-4 w-full text-left shadow-sm hover:bg-surface-container-low transition-colors">
          <MessageCircle size={24} className="text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-inter font-semibold text-sm text-on-background">Messages</p>
            <p className="font-inter text-sm text-on-surface-variant">Chat with your clients</p>
          </div>
          <ChevronRight size={18} className="text-outline" />
        </button>
      </div>
    );
  }

  // ── Client Dashboard ──────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      {/* Header mobile */}
      <div className="flex items-center justify-between mb-6 md:hidden">
        <Image src="/logo-icon.png" alt="Thrive Hub" width={32} height={32} />
        <span className="font-manrope font-bold text-base text-primary">Thrive Hub</span>
        <div className="w-8" />
      </div>

      {/* Greeting */}
      <div className="mb-5">
        <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-1">Current Recovery Plan</p>
        <h1 className="font-manrope font-extrabold text-3xl text-on-background">{greeting}, {firstName}.</h1>
        {allPrograms.length > 0 && (
          <p className="font-inter text-sm text-on-surface-variant mt-1">
            {totalCount === 0 ? "Your program has no exercises yet."
              : completedCount === totalCount ? "All exercises done today. Great work!"
              : `${totalCount - completedCount} exercises remaining today.`}
          </p>
        )}
      </div>

      {/* PT Message */}
      {latestMessage && (
        <button onClick={() => router.push("/messages")}
          className="bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-3 mb-6 w-full text-left shadow-sm hover:bg-surface-container-low transition-colors">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0">
            <Stethoscope size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-inter font-semibold text-sm text-primary mb-0.5">Message from {latestMessage.sender.full_name}</p>
            <p className="font-inter text-sm text-on-surface-variant truncate">"{latestMessage.content}"</p>
          </div>
        </button>
      )}

      {/* Weekly Activity */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-manrope font-bold text-lg text-on-background">Weekly Activity</h2>
          <BarChart2 size={20} className="text-outline" />
        </div>

        <div className="flex items-end justify-center gap-1 mb-1">
          <span className="font-manrope font-extrabold text-5xl text-primary leading-none">{activeDaysThisWeek}</span>
          <span className="font-manrope font-bold text-2xl text-on-surface-variant leading-none mb-1">/{sessionsPerWeek}</span>
        </div>
        <p className="font-inter text-sm text-on-surface-variant text-center mb-5">days active this week</p>

        <div className="flex justify-between px-2 mb-4">
          {DAY_LABELS.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-3 rounded-full transition-all ${weeklyData[i] ? "bg-primary h-8" : "bg-surface-container h-4"}`} />
              <span className="font-inter text-[11px] text-on-surface-variant">{day}</span>
            </div>
          ))}
        </div>

        <p className="font-inter font-medium text-sm text-on-surface-variant text-center">
          {activeDaysThisWeek === 0 ? "Start today — your PT is counting on you!"
            : activeDaysThisWeek >= sessionsPerWeek ? "You hit your goal this week!"
            : weeklyPct >= 50 ? "Halfway there! Keep going."
            : "Good start! Keep building the habit."}
        </p>
      </div>

      {/* Today's Protocol */}
      {allPrograms.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-8 flex flex-col items-center mb-8 shadow-sm">
          <ClipboardList size={40} className="text-outline-variant" />
          <h2 className="font-manrope font-bold text-lg text-on-background mt-4 mb-2">No program yet</h2>
          <p className="font-inter text-sm text-on-surface-variant text-center">
            Your PT will assign your recovery program soon. Check back here once it's ready.
          </p>
        </div>
      ) : (
        <>
          <h2 className="font-manrope font-bold text-lg text-on-background mb-3">Today's Protocol</h2>

          {allPrograms.map((prog) => {
            const progExercises = exercises.filter((e) => e.program_id === prog.id);
            if (progExercises.length === 0) return null;
            return (
              <div key={prog.id} className="mb-4">
                {allPrograms.length > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-inter font-medium text-xs text-primary uppercase tracking-wider">{prog.title}</span>
                    <span className="font-inter text-xs text-on-surface-variant">{prog.estimated_minutes} mins</span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {progExercises.map((ex) => (
                    <div key={ex.id}
                      className={`bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-3 shadow-sm ${ex.done ? "opacity-50" : ""}`}>
                      <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                        <Dumbbell size={22} className="text-outline" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-semibold text-sm text-on-background mb-1">{ex.name}</p>
                        <div className="flex gap-3">
                          <span className="font-inter text-xs text-on-surface-variant">↺ {ex.sets} Sets</span>
                          <span className="font-inter text-xs text-on-surface-variant">⏱ {ex.detail}</span>
                        </div>
                      </div>
                      {ex.done ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={18} className="text-primary" />
                          <span className="font-inter font-semibold text-xs text-primary">DONE</span>
                        </div>
                      ) : (
                        <button onClick={() => router.push("/workouts")}
                          className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center shrink-0 hover:bg-surface-container transition-colors">
                          <Play size={14} className="text-outline" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <button onClick={() => router.push("/workouts")}
            className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 w-full mt-2 mb-8 hover:opacity-95 transition-opacity">
            Start Today's Session
          </button>
        </>
      )}
    </div>
  );
}
