"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, CalendarCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DayStatus = "done" | "partial" | "none" | "future" | "today";
type CalendarDay = { day: number | null; status: DayStatus; isToday: boolean };

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getMondayOffset(date: Date) { return (date.getDay() + 6) % 7; }

export default function Calendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [doneDays, setDoneDays] = useState<Set<string>>(new Set());
  const [partialDays, setPartialDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [consistency, setConsistency] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Separate queries — nested select can silently return null for exercises
    const { data: prog } = await supabase.from("programs")
      .select("id, estimated_minutes, sessions_per_week")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1).single();

    const estMin = prog?.estimated_minutes ?? 30;
    const spw = prog?.sessions_per_week ?? 3;

    const { data: exList } = prog
      ? await supabase.from("exercises").select("id").eq("program_id", prog.id)
      : { data: [] };
    const totalEx = exList?.length ?? 0;

    // Fetch all feedback — no exercise ID filter to avoid mismatches
    const { data: fb } = await supabase
      .from("exercise_feedback")
      .select("exercise_id, created_at")
      .eq("client_id", user.id);

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

    const today = new Date();
    const monthDone = Array.from(done).filter((k) => {
      const [y, m] = k.split("-").map(Number);
      return y === year && m === month;
    }).length;
    setTotalSessions(monthDone);
    setTotalMinutes(monthDone * estMin);

    const daysIntoMonth = today.getMonth() === month && today.getFullYear() === year
      ? today.getDate()
      : new Date(year, month + 1, 0).getDate();
    const target = Math.max(1, (daysIntoMonth / 7) * spw);
    const active = Array.from(done).concat(Array.from(partial)).filter((k) => {
      const [y, m] = k.split("-").map(Number);
      return y === year && m === month;
    }).length;
    setConsistency(Math.min(100, Math.round((active / target) * 100)));
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build grid — done/partial takes priority over today so completed workouts always show filled
  useEffect(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = getMondayOffset(first);
    const today = new Date();
    const days: CalendarDay[] = [];
    for (let i = 0; i < offset; i++) days.push({ day: null, status: "none", isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const k = `${year}-${month}-${d}`;
      const isToday = date.toDateString() === today.toDateString();
      const isFuture = date > today;
      let status: DayStatus = "none";
      if (isFuture) status = "future";
      else if (doneDays.has(k)) status = "done";
      else if (partialDays.has(k)) status = "partial";
      else if (isToday) status = "today";
      days.push({ day: d, status, isToday });
    }
    setCalDays(days);
  }, [year, month, doneDays, partialDays]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const rows = Math.ceil(calDays.length / 7);

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <div className="mb-6">
        <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-1">Habit Tracker</p>
        <h1 className="font-manrope font-extrabold text-3xl text-on-background">
          Your Recovery <span className="text-primary">Consistency.</span>
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-surface-container-lowest rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="font-manrope font-bold text-lg text-on-background">{MONTH_NAMES[month]} {year}</span>
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
                {calDays.slice(row * 7, row * 7 + 7).map((cell, col) => (
                  <div key={col} className="flex justify-center py-1.5">
                    {cell.day ? (
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-full
                          ${cell.status === "done" ? "bg-primary" : ""}
                          ${cell.status === "partial" ? "bg-primary-container" : ""}`}
                        style={cell.isToday ? {
                          outline: "2px solid #00687b",
                          outlineOffset: "1px",
                        } : undefined}>
                        <span className={`font-inter text-[13px]
                          ${cell.status === "done" ? "font-semibold text-on-primary" : ""}
                          ${cell.status === "today" ? "font-semibold text-primary" : ""}
                          ${cell.status === "future" ? "text-outline" : ""}
                          ${cell.status === "none" || cell.status === "partial" ? "text-on-background" : ""}`}>
                          {cell.day}
                        </span>
                      </div>
                    ) : <div className="w-8 h-8" />}
                  </div>
                ))}
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

          <div className="bg-primary rounded-2xl p-6 mb-4">
            <p className="font-inter font-medium text-xs text-primary-container uppercase tracking-widest mb-1">{MONTH_NAMES[month]}</p>
            <p className="font-manrope font-extrabold text-6xl text-on-primary">{totalSessions}</p>
            <p className="font-inter text-sm text-primary-container">
              {totalSessions === 1 ? "session completed" : "sessions completed"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center shadow-sm">
              <Clock size={20} className="text-primary" />
              <span className="font-manrope font-extrabold text-3xl text-on-background mt-1">{totalMinutes}</span>
              <span className="font-inter text-xs text-on-surface-variant">mins this month</span>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center shadow-sm">
              <CalendarCheck size={20} className="text-primary" />
              <span className="font-manrope font-extrabold text-3xl text-on-background mt-1">{consistency}%</span>
              <span className="font-inter text-xs text-on-surface-variant">consistency</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
