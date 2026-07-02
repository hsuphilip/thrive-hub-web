"use client";

import { useState, useEffect, useCallback } from "react";
import { Dumbbell, Repeat2, Timer, ChevronDown, ChevronUp, Check, CalendarRange, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast, ToastContainer } from "@/components/toast";

type Exercise = {
  id: string; name: string; sets: number; detail: string; sort_order: number;
  done: boolean; video_url: string | null; feedback_id: string | null;
  submitted_pain_level: number; submitted_notes: string;
};
type Program = { id: string; title: string; estimated_minutes: number; notes: string | null; sessions_per_week: number | null };

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function Workouts() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selected, setSelected] = useState<Program | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEx, setLoadingEx] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [painLevel, setPainLevel] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [editPain, setEditPain] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toasts, showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("programs").select("id, title, estimated_minutes, notes, sessions_per_week")
        .eq("client_id", user.id).order("created_at", { ascending: false });
      const list = data ?? [];
      setPrograms(list);
      if (list.length > 0) setSelected(list[0]);
      setLoading(false);
    };
    load();
  }, []);

  const loadExercises = useCallback(async (prog: Program) => {
    if (!userId) return;
    setLoadingEx(true); setActiveIndex(null);
    const { data: exList } = await supabase.from("exercises").select("id, name, sets, detail, sort_order, video_url")
      .eq("program_id", prog.id).order("sort_order");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: todayFb } = await supabase.from("exercise_feedback").select("id, exercise_id, pain_level, notes")
      .eq("client_id", userId).gte("created_at", today.toISOString());
    const fbMap = new Map((todayFb ?? []).map((f: any) => [f.exercise_id, f]));
    setExercises((exList ?? []).map((e) => {
      const fb = fbMap.get(e.id);
      return { ...e, done: !!fb, feedback_id: fb?.id ?? null, submitted_pain_level: fb?.pain_level ?? 0, submitted_notes: fb?.notes ?? "" };
    }));
    setLoadingEx(false);
  }, [userId]);

  useEffect(() => { if (selected && userId) loadExercises(selected); }, [selected, userId, loadExercises]);

  const markDone = async (i: number) => {
    const ex = exercises[i];
    const { data: inserted, error } = await supabase.from("exercise_feedback")
      .insert({ client_id: userId, exercise_id: ex.id, pain_level: painLevel, notes: feedback.trim() || null })
      .select("id").single();
    if (error || !inserted) {
      showToast("Couldn't save — check your connection and try again.", "error");
      return;
    }
    setExercises((prev) => prev.map((e, j) => j === i ? { ...e, done: true, feedback_id: inserted.id, submitted_pain_level: painLevel, submitted_notes: feedback.trim() } : e));
    setActiveIndex(null); setPainLevel(0); setFeedback("");
  };

  const unmarkDone = async (i: number) => {
    const ex = exercises[i];
    if (!ex.feedback_id) return;
    const { error } = await supabase.from("exercise_feedback").delete().eq("id", ex.feedback_id);
    if (error) {
      showToast("Couldn't update — check your connection and try again.", "error");
      return;
    }
    setExercises((prev) => prev.map((e, j) => j === i ? { ...e, done: false, feedback_id: null, submitted_pain_level: 0, submitted_notes: "" } : e));
    setActiveIndex(null);
  };

  const saveEdit = async (i: number) => {
    const ex = exercises[i];
    if (!ex.feedback_id) return;
    setSavingEdit(true);
    const { error } = await supabase.from("exercise_feedback").update({ pain_level: editPain, notes: editNotes.trim() || null }).eq("id", ex.feedback_id);
    setSavingEdit(false);
    if (error) {
      showToast("Couldn't save your changes — try again.", "error");
      return;
    }
    setExercises((prev) => prev.map((e, j) => j === i ? { ...e, submitted_pain_level: editPain, submitted_notes: editNotes.trim() } : e));
    setActiveIndex(null);
  };

  const completed = exercises.filter((e) => e.done).length;
  const total = exercises.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const PainSelector = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div>
      <div className="flex justify-between mb-1">
        {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-inter font-medium transition-colors
              ${value === n ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <span className="font-inter text-[10px] text-on-surface-variant">NO PAIN</span>
        <span className="font-inter text-[10px] text-on-surface-variant">MODERATE</span>
        <span className="font-inter text-[10px] text-on-surface-variant">UNBEARABLE</span>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <ToastContainer toasts={toasts} />
      <div className="mb-5">
        <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-1">Daily Recovery Plan</p>
        <h1 className="font-manrope font-extrabold text-3xl text-on-background">Exercise Tracker</h1>
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Dumbbell size={48} className="text-outline-variant" />
          <h2 className="font-manrope font-bold text-lg text-on-background mt-4 mb-2">No program assigned yet</h2>
          <p className="font-inter text-sm text-on-surface-variant text-center">Your therapist will assign an exercise program soon.</p>
        </div>
      ) : (
        <>
          {programs.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {programs.map((p) => (
                <button key={p.id} onClick={() => setSelected(p)}
                  className={`px-4 py-1.5 rounded-full text-sm font-inter font-medium whitespace-nowrap transition-colors
                    ${selected?.id === p.id ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}>
                  {p.title}
                </button>
              ))}
            </div>
          )}

          {loadingEx ? (
            <div className="flex justify-center mt-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : selected && (
            <>
              {/* Progress banner */}
              <div className="bg-primary-container rounded-2xl p-4 flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center shrink-0">
                  <span className="font-manrope font-extrabold text-sm text-primary">{pct}%</span>
                </div>
                <div>
                  <p className="font-inter font-semibold text-sm text-on-background">
                    {completed === total && total > 0 ? "All done! Great work!" : "Keep going!"}
                  </p>
                  <p className="font-inter text-sm text-on-surface-variant">
                    {completed} of {total} exercises · {selected.estimated_minutes} min
                  </p>
                </div>
              </div>

              {/* Title row */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-inter font-semibold text-sm text-on-surface-variant">{selected.title}</span>
                {selected.sessions_per_week && (
                  <div className="flex items-center gap-1 bg-primary-container rounded-full px-3 py-1">
                    <CalendarRange size={12} className="text-primary" />
                    <span className="font-inter font-semibold text-xs text-primary">{selected.sessions_per_week}x / week</span>
                  </div>
                )}
              </div>

              {/* PT notes */}
              {selected.notes && (
                <button onClick={() => setNotesExpanded((v) => !v)}
                  className="bg-surface-container-lowest rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 w-full text-left shadow-sm hover:bg-surface-container-low transition-colors">
                  <FileText size={16} className="text-primary shrink-0" />
                  <span className="font-inter font-medium text-sm text-primary flex-1">Notes from your therapist</span>
                  {notesExpanded ? <ChevronUp size={18} className="text-outline" /> : <ChevronDown size={18} className="text-outline" />}
                </button>
              )}
              {selected.notes && notesExpanded && (
                <div className="bg-surface-container-lowest rounded-2xl px-4 py-3 mb-4 -mt-2 shadow-sm">
                  <p className="font-inter text-sm text-on-surface-variant leading-relaxed">{selected.notes}</p>
                </div>
              )}

              {/* Exercise list */}
              <div className="flex flex-col gap-3 mb-8">
                {exercises.map((ex, i) => (
                  <div key={ex.id}
                    className={`bg-surface-container-lowest rounded-2xl p-4 shadow-sm transition-all
                      ${activeIndex === i ? "ring-2 ring-primary" : ""} ${ex.done ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        if (ex.done) { setEditPain(ex.submitted_pain_level); setEditNotes(ex.submitted_notes); }
                        setActiveIndex(activeIndex === i ? null : i);
                      }}>
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                        <Dumbbell size={20} className="text-outline" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-semibold text-sm text-on-background mb-1">{ex.name}</p>
                        <div className="flex gap-3">
                          <span className="flex items-center gap-1 font-inter text-xs text-on-surface-variant">
                            <Repeat2 size={12} /> {ex.sets} Sets
                          </span>
                          <span className="flex items-center gap-1 font-inter text-xs text-on-surface-variant">
                            <Timer size={12} /> {ex.detail}
                          </span>
                        </div>
                      </div>
                      {ex.done ? (
                        <button onClick={(e) => { e.stopPropagation(); unmarkDone(i); }}
                          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                          <Check size={18} className="text-on-primary" />
                        </button>
                      ) : (
                        activeIndex === i ? <ChevronUp size={22} className="text-outline shrink-0" /> : <ChevronDown size={22} className="text-outline shrink-0" />
                      )}
                    </div>

                    {activeIndex === i && (
                      <div className="mt-4 border-t border-surface-container pt-4">
                        {ex.video_url && getYouTubeId(ex.video_url) && (
                          <div className="rounded-xl overflow-hidden mb-4 aspect-video">
                            <iframe
                              className="w-full h-full"
                              src={`https://www.youtube.com/embed/${getYouTubeId(ex.video_url)}`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                        <p className="font-inter font-semibold text-sm text-on-background mb-3">
                          {ex.done ? "Edit your feedback" : "How was your pain level?"}
                        </p>
                        <div className="mb-4">
                          <PainSelector value={ex.done ? editPain : painLevel} onChange={ex.done ? setEditPain : setPainLevel} />
                        </div>
                        <textarea
                          className="w-full bg-surface-container rounded-xl p-3 mb-4 font-inter text-sm text-on-surface-variant resize-none outline-none focus:ring-2 focus:ring-primary/30 min-h-16"
                          placeholder={ex.done ? "Notes for your therapist..." : "Optional notes for your therapist..."}
                          value={ex.done ? editNotes : feedback}
                          onChange={(e) => ex.done ? setEditNotes(e.target.value) : setFeedback(e.target.value)}
                          rows={2}
                        />
                        <button
                          onClick={() => ex.done ? saveEdit(i) : markDone(i)}
                          disabled={savingEdit}
                          className="bg-primary text-on-primary font-inter font-semibold text-sm rounded-full py-3 w-full disabled:opacity-60 hover:opacity-90 transition-opacity">
                          {ex.done ? (savingEdit ? "Saving..." : "Save Changes") : "Mark Complete"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
