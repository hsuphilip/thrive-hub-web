"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, ChevronLeft, Plus, Minus, MessageCircle,
  ClipboardList, Clock, CalendarCheck, X, Trash2, Copy, LayoutTemplate
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast, ToastContainer } from "@/components/toast";

type Program = { id: string; title: string; estimated_minutes: number; created_at: string; exercises?: { id: string }[] };
type DayStatus = "done" | "partial" | "none" | "future" | "today";
type CalendarDay = { day: number | null; status: DayStatus };
type FeedbackRow = {
  exercise_id: string;
  pain_level: number;
  notes: string | null;
  created_at: string;
  exercises: { name: string; sets: number; detail: string } | null;
};

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getMondayOffset(date: Date) { return (date.getDay() + 6) % 7; }

function formatDayTitle(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function painLabel(level: number) {
  if (level === 0) return { text: "No pain", color: "#00687b" };
  if (level <= 3) return { text: `${level}/10`, color: "#00687b" };
  if (level <= 6) return { text: `${level}/10`, color: "#d97706" };
  return { text: `${level}/10`, color: "#ba1a1a" };
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ptId, setPtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"programs" | "calendar">("programs");

  // Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [doneDays, setDoneDays] = useState<Set<string>>(new Set());
  const [partialDays, setPartialDays] = useState<Set<string>>(new Set());
  const [calLoading, setCalLoading] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [consistency, setConsistency] = useState(0);
  const [allFeedback, setAllFeedback] = useState<FeedbackRow[]>([]);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [estMin, setEstMin] = useState(30);
  const [savingSpw, setSavingSpw] = useState(false);
  const { toasts, showToast } = useToast();

  // Duplicate state
  const [ptClients, setPtClients] = useState<{ id: string; full_name: string }[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatingProgram, setDuplicatingProgram] = useState<Program | null>(null);
  const [duplicateTargetId, setDuplicateTargetId] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  // Day detail modal
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Workout history — all feedback grouped by date, most recent first
  const workoutHistory = useMemo(() => {
    const byDate: Record<string, FeedbackRow[]> = {};
    allFeedback.forEach((f) => {
      const d = new Date(f.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push(f);
    });
    return Object.entries(byDate)
      .map(([key, entries]) => {
        const [y, mo, da] = key.split("-").map(Number);
        return {
          dateKey: key,
          displayDate: new Date(y, mo, da).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
          entries,
          isComplete: doneDays.has(key),
        };
      })
      .sort((a, b) => {
        const [ay, am, ad] = a.dateKey.split("-").map(Number);
        const [by2, bm, bd] = b.dateKey.split("-").map(Number);
        return new Date(by2, bm, bd).getTime() - new Date(ay, am, ad).getTime();
      });
  }, [allFeedback, doneDays]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setPtId(user.id);

      const [{ data: profile }, { data: progs }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", id).single(),
        supabase.from("programs").select("id, title, estimated_minutes, created_at, exercises(id)")
          .eq("client_id", id).order("created_at", { ascending: false }),
      ]);

      setClientName(profile?.full_name ?? "Client");
      setPrograms(progs ?? []);

      // Load PT's clients for duplicate modal
      const { data: clientData } = await supabase.from("pt_clients")
        .select("client_id, profiles!pt_clients_client_id_fkey(id, full_name)")
        .eq("pt_id", user.id);
      const clients = (clientData ?? []).map((r: any) => r.profiles).filter(Boolean);
      setPtClients(clients);
      setDuplicateTargetId(clients[0]?.id ?? "");

      setLoading(false);
    };
    load();
  }, [id]);

  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prog }, { data: ptClient }] = await Promise.all([
      supabase.from("programs").select("id, estimated_minutes, exercises(id)")
        .eq("client_id", id).order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("pt_clients").select("sessions_per_week")
        .eq("pt_id", user.id).eq("client_id", id).single(),
    ]);

    const totalEx = prog?.exercises?.length ?? 0;
    setEstMin(prog?.estimated_minutes ?? 30);
    setSessionsPerWeek(ptClient?.sessions_per_week ?? 3);

    const { data: fb } = await supabase
      .from("exercise_feedback")
      .select("exercise_id, pain_level, notes, created_at, exercises(name, sets, detail)")
      .eq("client_id", id)
      .order("created_at", { ascending: true });

    setAllFeedback((fb ?? []) as unknown as FeedbackRow[]);

    const byDate: Record<string, Set<string>> = {};
    (fb ?? []).forEach((f: any) => {
      const d = new Date(f.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDate[k]) byDate[k] = new Set();
      byDate[k].add(f.exercise_id);
    });

    const done = new Set<string>(), partial = new Set<string>();
    Object.entries(byDate).forEach(([k, ids]) => {
      if (totalEx > 0 && ids.size >= totalEx) done.add(k);
      else if (ids.size > 0) partial.add(k);
    });

    setDoneDays(done);
    setPartialDays(partial);
    setCalLoading(false);
  }, [id]);

  // Recalculate stats whenever data or sessionsPerWeek changes
  useEffect(() => {
    const today = new Date();
    const monthDone = Array.from(doneDays).filter((k) => {
      const [y, m] = k.split("-").map(Number);
      return y === calYear && m === calMonth;
    }).length;
    setTotalSessions(monthDone);
    setTotalMinutes(monthDone * estMin);

    const daysIntoMonth = today.getMonth() === calMonth && today.getFullYear() === calYear
      ? today.getDate()
      : new Date(calYear, calMonth + 1, 0).getDate();
    const target = Math.max(1, (daysIntoMonth / 7) * sessionsPerWeek);
    const active = Array.from(doneDays).concat(Array.from(partialDays)).filter((k) => {
      const [y, m] = k.split("-").map(Number);
      return y === calYear && m === calMonth;
    }).length;
    setConsistency(Math.min(100, Math.round((active / target) * 100)));
  }, [doneDays, partialDays, sessionsPerWeek, calYear, calMonth, estMin]);

  useEffect(() => {
    if (activeTab === "calendar") loadCalendar();
  }, [activeTab, loadCalendar]);

  useEffect(() => {
    const first = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const offset = getMondayOffset(first);
    const today = new Date();
    const days: CalendarDay[] = [];
    for (let i = 0; i < offset; i++) days.push({ day: null, status: "none" });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth, d);
      const k = `${calYear}-${calMonth}-${d}`;
      let status: DayStatus = "none";
      if (date.toDateString() === today.toDateString()) status = "today";
      else if (date > today) status = "future";
      else if (doneDays.has(k)) status = "done";
      else if (partialDays.has(k)) status = "partial";
      days.push({ day: d, status });
    }
    setCalDays(days);
  }, [calYear, calMonth, doneDays, partialDays]);

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };
  const rows = Math.ceil(calDays.length / 7);

  const updateSessionsPerWeek = async (value: number) => {
    if (!ptId) return;
    setSavingSpw(true);
    setSessionsPerWeek(value);
    await supabase.from("pt_clients")
      .update({ sessions_per_week: value })
      .eq("pt_id", ptId).eq("client_id", id);
    setSavingSpw(false);
  };

  const openDuplicate = (program: Program) => {
    setDuplicatingProgram(program);
    setShowDuplicateModal(true);
  };

  const confirmDuplicate = async () => {
    if (!duplicatingProgram || !duplicateTargetId || !ptId) return;
    setDuplicating(true);
    const { data: exList } = await supabase.from("exercises")
      .select("name, sets, detail, sort_order, video_url")
      .eq("program_id", duplicatingProgram.id)
      .order("sort_order");
    const { data: newProg } = await supabase.from("programs").insert({
      pt_id: ptId, client_id: duplicateTargetId,
      title: duplicatingProgram.title,
      estimated_minutes: duplicatingProgram.estimated_minutes,
      is_template: false,
    }).select("id").single();
    if (newProg && exList?.length) {
      await supabase.from("exercises").insert(exList.map((e) => ({ ...e, program_id: newProg.id })));
    }
    setDuplicating(false);
    setShowDuplicateModal(false);
    setDuplicatingProgram(null);
    const targetName = ptClients.find((c) => c.id === duplicateTargetId)?.full_name ?? "client";
    showToast(`Program copied to ${targetName}`);
  };

  const saveAsTemplate = async (program: Program) => {
    if (!ptId) return;
    const { data: exList } = await supabase.from("exercises")
      .select("name, sets, detail, sort_order, video_url")
      .eq("program_id", program.id)
      .order("sort_order");
    const { data: newProg } = await supabase.from("programs").insert({
      pt_id: ptId, client_id: null,
      title: program.title,
      estimated_minutes: program.estimated_minutes,
      is_template: true,
    }).select("id").single();
    if (newProg && exList?.length) {
      await supabase.from("exercises").insert(exList.map((e) => ({ ...e, program_id: newProg.id })));
    }
    showToast("Saved as template");
  };

  const deleteProgram = async (program: Program) => {
    if (!confirm(`Delete "${program.title}"? This cannot be undone.`)) return;
    await supabase.from("programs").delete().eq("id", program.id);
    setPrograms(prev => prev.filter(p => p.id !== program.id));
    showToast("Program deleted");
  };

  const selectedDayFeedback = selectedDay
    ? allFeedback.filter((f) => {
        const d = new Date(f.created_at);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === selectedDay;
      })
    : [];

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <ToastContainer toasts={toasts} />
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-surface-container transition-colors">
          <ArrowLeft size={22} className="text-on-surface-variant" />
        </button>
        <div>
          <p className="font-inter text-xs text-on-surface-variant">Patient</p>
          <h1 className="font-manrope font-bold text-xl text-on-background">{clientName}</h1>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => router.push(`/program/new?clientId=${id}&clientName=${encodeURIComponent(clientName)}&ptId=${ptId}`)}
          className="bg-primary rounded-2xl p-4 flex items-center gap-3 hover:opacity-95 transition-opacity">
          <Plus size={20} className="text-primary-container shrink-0" />
          <span className="font-inter font-semibold text-sm text-on-primary">New Program</span>
        </button>
        <button onClick={() => router.push("/messages")}
          className="bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:bg-surface-container-low transition-colors">
          <MessageCircle size={20} className="text-primary shrink-0" />
          <span className="font-inter font-semibold text-sm text-on-background">Message</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container rounded-2xl p-1 mb-6">
        {(["programs", "calendar"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-inter font-semibold transition-colors
              ${activeTab === tab ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-background"}`}>
            {tab === "programs" ? "Programs" : "Calendar"}
          </button>
        ))}
      </div>

      {activeTab === "programs" ? (
        programs.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <ClipboardList size={40} className="text-outline-variant" />
            <p className="font-inter text-sm text-on-surface-variant mt-3 text-center">No programs yet. Create one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {programs.map((p) => (
              <div key={p.id} className="bg-surface-container-lowest rounded-2xl px-4 py-3.5 flex items-center gap-2 shadow-sm hover:bg-surface-container-low transition-colors">
                <button className="flex-1 text-left min-w-0" onClick={() => router.push(`/program/${p.id}`)}>
                  <p className="font-inter font-semibold text-sm text-on-background truncate">{p.title}</p>
                  <p className="font-inter text-xs text-on-surface-variant mt-0.5">
                    {p.exercises?.length ?? 0} exercises · {p.estimated_minutes} min
                  </p>
                </button>
                <button onClick={() => router.push(`/program/${p.id}`)} className="shrink-0">
                  <ChevronRight size={18} className="text-outline" />
                </button>
                <button onClick={() => openDuplicate(p)} title="Duplicate to a client"
                  className="p-1.5 rounded-full hover:bg-surface-container transition-colors shrink-0">
                  <Copy size={15} className="text-outline" />
                </button>
                <button onClick={() => saveAsTemplate(p)} title="Save as template"
                  className="p-1.5 rounded-full hover:bg-primary-container transition-colors shrink-0">
                  <LayoutTemplate size={15} className="text-outline hover:text-primary" />
                </button>
                <button onClick={() => deleteProgram(p)}
                  className="p-1.5 rounded-full hover:bg-red-50 transition-colors group shrink-0">
                  <Trash2 size={15} className="text-outline group-hover:text-red-500 transition-colors" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : calLoading ? (
        <div className="flex justify-center mt-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Weekly session target stepper */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 mb-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-inter font-semibold text-sm text-on-background">Weekly Session Target</p>
              <p className="font-inter text-xs text-on-surface-variant">Used for compliance calculation</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateSessionsPerWeek(Math.max(1, sessionsPerWeek - 1))}
                disabled={savingSpw || sessionsPerWeek <= 1}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-low transition-colors disabled:opacity-40">
                <Minus size={16} className="text-on-surface-variant" />
              </button>
              <span className="font-manrope font-extrabold text-2xl text-primary w-6 text-center">{sessionsPerWeek}</span>
              <button
                onClick={() => updateSessionsPerWeek(Math.min(7, sessionsPerWeek + 1))}
                disabled={savingSpw || sessionsPerWeek >= 7}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-low transition-colors disabled:opacity-40">
                <Plus size={16} className="text-on-surface-variant" />
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="font-manrope font-bold text-lg text-on-background">{MONTH_NAMES[calMonth]} {calYear}</span>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-1 rounded-full hover:bg-surface-container transition-colors">
                  <ChevronLeft size={22} className="text-on-surface-variant" />
                </button>
                <button onClick={nextMonth} className="p-1 rounded-full hover:bg-surface-container transition-colors">
                  <ChevronRight size={22} className="text-on-surface-variant" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((d) => (
                <div key={d} className="flex justify-center">
                  <span className="font-inter font-medium text-[10px] text-on-surface-variant">{d}</span>
                </div>
              ))}
            </div>

            {Array.from({ length: rows }).map((_, row) => (
              <div key={row} className="grid grid-cols-7">
                {calDays.slice(row * 7, row * 7 + 7).map((cell, col) => {
                  const dayKey = cell.day ? `${calYear}-${calMonth}-${cell.day}` : null;
                  const isClickable = cell.status === "done" || cell.status === "partial";
                  return (
                    <div key={col} className="flex justify-center py-1.5">
                      {cell.day ? (
                        <button
                          onClick={() => isClickable && dayKey && setSelectedDay(dayKey)}
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-opacity
                            ${isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}
                            ${cell.status === "today" ? "ring-2 ring-primary" : ""}
                            ${cell.status === "done" ? "bg-primary" : ""}
                            ${cell.status === "partial" ? "bg-primary-container" : ""}`}>
                          <span className={`font-inter text-[13px]
                            ${cell.status === "done" ? "font-semibold text-on-primary" : ""}
                            ${cell.status === "today" ? "font-semibold text-primary" : ""}
                            ${cell.status === "future" ? "text-outline" : ""}
                            ${cell.status === "none" || cell.status === "partial" ? "text-on-background" : ""}`}>
                            {cell.day}
                          </span>
                        </button>
                      ) : <div className="w-8 h-8" />}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex gap-4 mt-3 pt-3 border-t border-surface-container">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-primary" />
                <span className="font-inter text-[11px] text-on-surface-variant">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-primary-container" />
                <span className="font-inter text-[11px] text-on-surface-variant">Partial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full ring-2 ring-primary" />
                <span className="font-inter text-[11px] text-on-surface-variant">Today</span>
              </div>
            </div>
          </div>

          {/* Sessions card */}
          <div className="bg-primary rounded-2xl p-6 mb-4">
            <p className="font-inter font-medium text-xs text-primary-container uppercase tracking-widest mb-1">{MONTH_NAMES[calMonth]}</p>
            <p className="font-manrope font-extrabold text-6xl text-on-primary">{totalSessions}</p>
            <p className="font-inter text-sm text-primary-container">
              {totalSessions === 1 ? "session completed" : "sessions completed"}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center shadow-sm">
              <Clock size={20} className="text-primary" />
              <span className="font-manrope font-extrabold text-3xl text-on-background mt-1">{totalMinutes}</span>
              <span className="font-inter text-xs text-on-surface-variant">mins this month</span>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center shadow-sm">
              <CalendarCheck size={20} className="text-primary" />
              <span className="font-manrope font-extrabold text-3xl text-on-background mt-1">{consistency}%</span>
              <span className="font-inter text-xs text-on-surface-variant">compliance</span>
            </div>
          </div>

          {/* Workout History */}
          {workoutHistory.length > 0 ? (
            <>
              <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-3">Workout History</p>
              <div className="flex flex-col gap-4 mb-8">
                {workoutHistory.map((day) => (
                  <div key={day.dateKey} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-container">
                      <span className="font-inter font-semibold text-sm text-on-background">{day.displayDate}</span>
                      <span className={`font-inter font-semibold text-xs px-2.5 py-1 rounded-full
                        ${day.isComplete ? "bg-primary text-on-primary" : "bg-primary-container text-primary"}`}>
                        {day.isComplete ? "Complete" : "Partial"}
                      </span>
                    </div>
                    <div className="divide-y divide-surface-container">
                      {day.entries.map((entry, i) => {
                        const pain = painLabel(entry.pain_level);
                        return (
                          <div key={i} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <span className="font-inter font-semibold text-sm text-on-background">
                                {entry.exercises?.name ?? "Exercise"}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pain.color }} />
                                <span className="font-inter font-semibold text-xs" style={{ color: pain.color }}>
                                  {pain.text}
                                </span>
                              </div>
                            </div>
                            {entry.exercises && (
                              <p className="font-inter text-xs text-on-surface-variant mb-1.5">
                                {entry.exercises.sets} {entry.exercises.sets === 1 ? "set" : "sets"} · {entry.exercises.detail}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="font-inter text-xs text-on-surface-variant italic bg-surface-container rounded-lg px-3 py-2">
                                "{entry.notes}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-10">
              <CalendarCheck size={36} className="text-outline-variant" />
              <p className="font-inter text-sm text-on-surface-variant mt-3 text-center">No workout history yet.</p>
            </div>
          )}
        </>
      )}

      {/* Duplicate program modal */}
      {showDuplicateModal && duplicatingProgram && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowDuplicateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-manrope font-bold text-lg text-on-background">Duplicate Program</h2>
              <button onClick={() => setShowDuplicateModal(false)} className="p-1.5 rounded-full hover:bg-surface-container transition-colors">
                <X size={20} className="text-on-surface-variant" />
              </button>
            </div>
            <p className="font-inter text-sm text-on-surface-variant mb-4">
              Copy <span className="font-semibold text-on-background">"{duplicatingProgram.title}"</span> to another client.
            </p>
            {ptClients.length === 0 ? (
              <p className="font-inter text-sm text-on-surface-variant text-center py-4">No other clients to assign to.</p>
            ) : (
              <>
                <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1.5 ml-1 tracking-wider">ASSIGN TO</label>
                <select
                  className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30 mb-5"
                  value={duplicateTargetId}
                  onChange={(e) => setDuplicateTargetId(e.target.value)}>
                  {ptClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}{c.id === id ? " (this client)" : ""}</option>
                  ))}
                </select>
                <button onClick={confirmDuplicate} disabled={duplicating || !duplicateTargetId}
                  className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-3.5 w-full disabled:opacity-60 hover:opacity-90 transition-opacity">
                  {duplicating ? "Copying..." : "Copy Program"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-container sticky top-0 bg-white rounded-t-2xl">
              <div>
                <p className="font-inter text-xs text-on-surface-variant uppercase tracking-widest">Session Log</p>
                <h2 className="font-manrope font-bold text-lg text-on-background">{formatDayTitle(selectedDay)}</h2>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-full hover:bg-surface-container transition-colors">
                <X size={20} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              {selectedDayFeedback.length === 0 ? (
                <p className="font-inter text-sm text-on-surface-variant text-center py-6">No exercise details logged.</p>
              ) : (
                selectedDayFeedback.map((entry, i) => {
                  const pain = painLabel(entry.pain_level);
                  return (
                    <div key={i} className="bg-surface-container-lowest rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-inter font-semibold text-sm text-on-background">
                          {entry.exercises?.name ?? "Exercise"}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pain.color }} />
                          <span className="font-inter font-semibold text-xs" style={{ color: pain.color }}>
                            {pain.text}
                          </span>
                        </div>
                      </div>
                      {entry.exercises && (
                        <p className="font-inter text-xs text-on-surface-variant mb-2">
                          {entry.exercises.sets} {entry.exercises.sets === 1 ? "set" : "sets"} · {entry.exercises.detail}
                        </p>
                      )}
                      {entry.notes && (
                        <div className="bg-surface-container rounded-xl px-3 py-2">
                          <p className="font-inter text-xs text-on-surface-variant italic">"{entry.notes}"</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
