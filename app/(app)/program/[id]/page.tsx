"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/toast";
import { ArrowLeft, Pencil, X, Plus, Repeat2, Timer, PlayCircle, Bookmark, BookmarkCheck, BookOpen, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Exercise = { id?: string; name: string; sets: string; detail: string; sort_order: number; video_url: string };

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
type LibraryExercise = { id: string; name: string; sets: number; detail: string; video_url: string | null };
type ProgramDetail = { title: string; estimated_minutes: number; notes: string | null; sessions_per_week: number };

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftMinutes, setDraftMinutes] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftSpw, setDraftSpw] = useState(3);
  const [draftExercises, setDraftExercises] = useState<Exercise[]>([]);

  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedLibIds, setSelectedLibIds] = useState<Set<string>>(new Set());
  const [savedToLibrary, setSavedToLibrary] = useState<Set<string>>(new Set());
  const [libraryEditMode, setLibraryEditMode] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [error, setError] = useState("");
  const { toasts, showToast } = useToast();

  const loadProgram = async () => {
    const [{ data: prog }, { data: exList }] = await Promise.all([
      supabase.from("programs").select("title, estimated_minutes, notes, sessions_per_week").eq("id", id).single(),
      supabase.from("exercises").select("id, name, sets, detail, sort_order, video_url").eq("program_id", id).order("sort_order"),
    ]);
    setProgram(prog);
    setExercises((exList ?? []).map((e) => ({ ...e, sets: String(e.sets), video_url: e.video_url ?? "" })));
    setLoading(false);
  };

  const fetchLibrary = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("exercise_library").select("id, name, sets, detail, video_url").eq("pt_id", user.id).order("name");
    setLibraryExercises(data ?? []);
    setSavedToLibrary(new Set((data ?? []).map((e: any) => e.name)));
  };

  useEffect(() => { loadProgram(); fetchLibrary(); }, [id]);

  const startEditing = () => {
    if (!program) return;
    setDraftTitle(program.title); setDraftMinutes(String(program.estimated_minutes));
    setDraftNotes(program.notes ?? ""); setDraftSpw(program.sessions_per_week ?? 3);
    setDraftExercises(exercises.map((e) => ({ ...e })));
    setEditing(true);
  };

  const saveToLibrary = async (ex: Exercise) => {
    if (!ex.name.trim()) return;
    if (savedToLibrary.has(ex.name.trim())) { alert(`"${ex.name}" is already saved in your library.`); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("exercise_library").insert({
      pt_id: user.id, name: ex.name.trim(), sets: parseInt(ex.sets) || 3,
      detail: ex.detail.trim(), video_url: ex.video_url.trim() || null,
    });
    if (err) { alert(err.message); return; }
    setSavedToLibrary((prev) => new Set(prev).add(ex.name.trim()));
  };

  const deleteFromLibrary = async (item: LibraryExercise) => {
    await supabase.from("exercise_library").delete().eq("id", item.id);
    setLibraryExercises((prev) => prev.filter((e) => e.id !== item.id));
    setSavedToLibrary((prev) => { const n = new Set(prev); n.delete(item.name); return n; });
  };

  const addFromLibrary = () => {
    const toAdd = libraryExercises.filter((e) => selectedLibIds.has(e.id));
    setDraftExercises((prev) => [...prev, ...toAdd.map((e) => ({ name: e.name, sets: String(e.sets), detail: e.detail, sort_order: 0, video_url: e.video_url ?? "" }))]);
    setSelectedLibIds(new Set()); setShowLibrary(false); setLibraryEditMode(false);
  };

  const saveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!draftTitle.trim()) { setError("Program title is required."); return; }
    const valid = draftExercises.filter((ex) => ex.name.trim() && ex.detail.trim());
    if (!valid.length) { setError("Add at least one exercise with a name and detail."); return; }
    setSaving(true);

    const { error: pErr } = await supabase.from("programs").update({
      title: draftTitle.trim(), estimated_minutes: parseInt(draftMinutes) || 30,
      notes: draftNotes.trim() || null, sessions_per_week: draftSpw,
    }).eq("id", id);
    if (pErr) { setError(pErr.message); setSaving(false); return; }

    const rows = valid.map((ex, i) => {
      const row: any = { program_id: id, name: ex.name.trim(), sets: parseInt(ex.sets) || 3, detail: ex.detail.trim(), sort_order: i, video_url: ex.video_url.trim() || null };
      if (ex.id) row.id = ex.id;
      return row;
    });
    await supabase.from("exercises").upsert(rows);

    const keptIds = valid.filter((e) => e.id).map((e) => e.id!);
    const removedIds = exercises.filter((e) => e.id && !keptIds.includes(e.id)).map((e) => e.id!);
    if (removedIds.length > 0) await supabase.from("exercises").delete().in("id", removedIds);

    setSaving(false);
    await loadProgram();
    setEditing(false);
    showToast("Program saved");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const ExerciseForm = ({ ex, i, onChange, onRemove }: { ex: Exercise; i: number; onChange: (i: number, field: keyof Exercise, v: string) => void; onRemove: (i: number) => void }) => (
    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-inter font-semibold text-sm text-primary">Exercise {i+1}</span>
        <div className="flex items-center gap-2">
          {ex.name.trim() && (
            <button type="button" onClick={() => saveToLibrary(ex)} title="Save to library">
              {savedToLibrary.has(ex.name.trim())
                ? <BookmarkCheck size={18} className="text-primary" />
                : <Bookmark size={18} className="text-primary" />}
            </button>
          )}
          {draftExercises.length > 1 && (
            <button type="button" onClick={() => onRemove(i)}>
              <X size={18} className="text-outline" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">EXERCISE NAME</label>
          <input className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. Hamstring Stretch" value={ex.name} onChange={(e) => onChange(i, "name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">SETS</label>
            <input type="number" className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
              value={ex.sets} onChange={(e) => onChange(i, "sets", e.target.value)} />
          </div>
          <div>
            <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">REPS / HOLD</label>
            <input className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="12 Reps / 30s" value={ex.detail} onChange={(e) => onChange(i, "detail", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">YOUTUBE VIDEO URL (OPTIONAL)</label>
          <input type="url" className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="https://youtube.com/watch?v=..." value={ex.video_url} onChange={(e) => onChange(i, "video_url", e.target.value)} />
          {getYouTubeId(ex.video_url) && (
            <div className="mt-2 rounded-xl overflow-hidden aspect-video">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${getYouTubeId(ex.video_url)}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Edit mode
  if (editing) {
    const update = (i: number, field: keyof Exercise, v: string) =>
      setDraftExercises((prev) => prev.map((ex, j) => j === i ? { ...ex, [field]: v } : ex));

    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        <form onSubmit={saveChanges}>
          <div className="flex items-center gap-3 mb-6">
            <button type="button" onClick={() => setEditing(false)} className="p-1 rounded-full hover:bg-surface-container transition-colors">
              <X size={22} className="text-on-surface-variant" />
            </button>
            <h1 className="font-manrope font-bold text-xl text-on-background flex-1">Edit Program</h1>
            <button type="submit" disabled={saving}
              className="bg-primary text-on-primary font-inter font-semibold text-sm rounded-full px-4 py-2 disabled:opacity-60 hover:opacity-90 transition-opacity">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-4 mb-5">
            <div>
              <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">PROGRAM TITLE</label>
              <input className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </div>
            <div>
              <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">ESTIMATED DURATION (MINUTES)</label>
              <input type="number" className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                value={draftMinutes} onChange={(e) => setDraftMinutes(e.target.value)} />
            </div>
            <div>
              <label className="block font-inter font-medium text-xs text-on-surface-variant mb-2 ml-1 tracking-wider">TIMES PER WEEK</label>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setDraftSpw((v) => Math.max(1, v-1))} className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high">
                  <span className="text-on-surface-variant text-lg leading-none">−</span>
                </button>
                <span className="font-manrope font-extrabold text-3xl text-primary w-8 text-center">{draftSpw}</span>
                <button type="button" onClick={() => setDraftSpw((v) => Math.min(7, v+1))} className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high">
                  <Plus size={18} className="text-on-surface-variant" />
                </button>
                <span className="font-inter text-sm text-on-surface-variant">{draftSpw === 1 ? "day per week" : "days per week"}</span>
              </div>
            </div>
            <div>
              <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">NOTES FOR PATIENT (OPTIONAL)</label>
              <textarea className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} rows={3} placeholder="Notes for your patient..." />
            </div>
          </div>

          <h2 className="font-manrope font-bold text-lg text-on-background mb-3">Exercises</h2>
          <div className="flex flex-col gap-3 mb-3">
            {draftExercises.map((ex, i) => (
              <ExerciseForm key={i} ex={ex} i={i} onChange={update}
                onRemove={(j) => setDraftExercises((prev) => prev.filter((_,k) => k!==j))} />
            ))}
          </div>

          <button type="button" onClick={() => setDraftExercises((prev) => [...prev, { name:"", sets:"3", detail:"", sort_order: prev.length, video_url:"" }])}
            className="border border-outline-variant rounded-2xl py-3 flex items-center justify-center gap-2 w-full mb-3 hover:bg-surface-container transition-colors">
            <Plus size={18} className="text-outline" />
            <span className="font-inter font-medium text-sm text-on-surface-variant">Add Exercise</span>
          </button>

          <button type="button" onClick={() => { fetchLibrary(); setShowLibrary(true); }}
            className="border border-primary-container rounded-2xl py-3 flex items-center justify-center gap-2 w-full mb-6 hover:bg-primary-container/20 transition-colors">
            <BookOpen size={18} className="text-primary" />
            <span className="font-inter font-medium text-sm text-primary">Browse library</span>
          </button>

          {error && <p className="text-sm text-error font-inter text-center mb-4">{error}</p>}
        </form>

        {/* Library modal */}
        {showLibrary && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-background rounded-3xl w-full max-w-md flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <h2 className="font-manrope font-bold text-xl text-on-background">Exercise Library</h2>
                <div className="flex items-center gap-4">
                  {libraryExercises.length > 0 && (
                    <button onClick={() => setLibraryEditMode((v) => !v)}
                      className={`font-inter font-medium text-sm ${libraryEditMode ? "text-primary" : "text-on-surface-variant"}`}>
                      {libraryEditMode ? "Done" : "Edit"}
                    </button>
                  )}
                  <button onClick={() => { setShowLibrary(false); setSelectedLibIds(new Set()); setLibraryEditMode(false); setLibrarySearch(""); }}
                    className="p-1 rounded-full hover:bg-surface-container transition-colors">
                    <X size={22} className="text-on-surface-variant" />
                  </button>
                </div>
              </div>
              {libraryExercises.length === 0 ? (
                <div className="flex flex-col items-center py-12 px-6">
                  <BookOpen size={40} className="text-outline-variant" />
                  <p className="font-inter text-sm text-on-surface-variant mt-3 text-center">No exercises saved yet.</p>
                </div>
              ) : (
                <>
                  <div className="px-5 pb-3 shrink-0">
                    <input
                      className="w-full bg-surface-container rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Search exercises..."
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                    />
                  </div>
                <div className="overflow-y-auto flex-1 px-5 pb-4 flex flex-col gap-2">
                  {libraryExercises.filter((item) => item.name.toLowerCase().includes(librarySearch.toLowerCase())).map((item) => {
                    const sel = selectedLibIds.has(item.id);
                    return (
                      <button key={item.id}
                        onClick={() => { if (libraryEditMode) return; setSelectedLibIds((prev) => { const n = new Set(prev); sel ? n.delete(item.id) : n.add(item.id); return n; }); }}
                        className={`flex items-center px-4 py-3 rounded-2xl w-full text-left shadow-sm transition-colors ${!libraryEditMode && sel ? "bg-primary-container" : "bg-surface-container-lowest"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-inter font-semibold text-sm text-on-background">{item.name}</p>
                          <p className="font-inter text-xs text-on-surface-variant">{item.sets} sets · {item.detail}</p>
                        </div>
                        {libraryEditMode ? (
                          <button onClick={(e) => { e.stopPropagation(); deleteFromLibrary(item); }} className="p-1">
                            <Trash2 size={18} className="text-error" />
                          </button>
                        ) : (
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${sel ? "bg-primary" : "border-2 border-outline-variant"}`}>
                            {sel && <Check size={12} className="text-on-primary" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                </>
              )}
              {libraryExercises.length > 0 && !libraryEditMode && (
                <div className="px-5 pb-6 pt-3 border-t border-outline-variant/50 shrink-0">
                  <button onClick={addFromLibrary} disabled={selectedLibIds.size === 0}
                    className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 w-full disabled:opacity-40 hover:opacity-90 transition-opacity">
                    {selectedLibIds.size > 0 ? `Add ${selectedLibIds.size} selected` : "Add selected"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // View mode
  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <ToastContainer toasts={toasts} />
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-surface-container transition-colors">
          <ArrowLeft size={22} className="text-on-surface-variant" />
        </button>
        <h1 className="font-manrope font-bold text-xl text-on-background flex-1">{program?.title}</h1>
        <button onClick={startEditing} className="p-1.5 rounded-full hover:bg-surface-container transition-colors">
          <Pencil size={20} className="text-primary" />
        </button>
      </div>

      {program?.notes && (
        <>
          <button onClick={() => setNotesExpanded((v) => !v)}
            className="bg-surface-container-lowest rounded-2xl px-4 py-3 mb-2 flex items-center gap-3 w-full text-left shadow-sm hover:bg-surface-container-low transition-colors">
            <span className="font-inter font-medium text-sm text-primary flex-1">Notes for patient</span>
            {notesExpanded ? <ChevronUp size={18} className="text-outline" /> : <ChevronDown size={18} className="text-outline" />}
          </button>
          {notesExpanded && (
            <div className="bg-surface-container-lowest rounded-2xl px-4 py-3 mb-4 -mt-1 shadow-sm">
              <p className="font-inter text-sm text-on-surface-variant leading-relaxed">{program.notes}</p>
            </div>
          )}
        </>
      )}

      {program?.sessions_per_week && (
        <div className="flex items-center gap-2 bg-surface-container-low rounded-2xl px-4 py-3 mb-5">
          <span className="font-inter font-semibold text-sm text-on-background">
            Do this <span className="text-primary">{program.sessions_per_week}x per week</span>
          </span>
        </div>
      )}

      {exercises.length === 0 ? (
        <p className="font-inter text-sm text-on-surface-variant text-center py-10">No exercises in this program.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {exercises.map((ex, i) => (
            <div key={ex.id ?? i} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
              <p className="font-inter font-medium text-[11px] text-primary uppercase tracking-wider mb-1">Exercise {i+1}</p>
              <p className="font-inter font-semibold text-base text-on-background mb-2">{ex.name}</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1 font-inter text-sm text-on-surface-variant">
                  <Repeat2 size={14} /> {ex.sets} Sets
                </span>
                <span className="flex items-center gap-1 font-inter text-sm text-on-surface-variant">
                  <Timer size={14} /> {ex.detail}
                </span>
              </div>
              {ex.video_url && (
                <div className="flex items-center gap-1.5 mt-2">
                  <PlayCircle size={14} className="text-primary" />
                  <span className="font-inter text-xs text-primary">Video attached</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="h-8" />
    </div>
  );
}
