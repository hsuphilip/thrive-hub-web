"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, X, Bookmark, BookmarkCheck, BookOpen, Trash2, Check, LayoutTemplate } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast, ToastContainer } from "@/components/toast";

type Exercise = { name: string; sets: string; detail: string; video_url: string };

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
type LibraryExercise = { id: string; name: string; sets: number; detail: string; video_url: string | null };
type TemplateItem = { id: string; title: string; estimated_minutes: number; sessions_per_week: number; notes: string | null };

function NewProgramContent() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("clientId") ?? "";
  const clientName = params.get("clientName") ?? "";
  const ptId = params.get("ptId") ?? "";
  const isTemplate = params.get("template") === "true";

  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [spw, setSpw] = useState(3);
  const [exercises, setExercises] = useState<Exercise[]>([{ name: "", sets: "3", detail: "", video_url: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedLibIds, setSelectedLibIds] = useState<Set<string>>(new Set());
  const [savedToLibrary, setSavedToLibrary] = useState<Set<string>>(new Set());
  const [libraryEditMode, setLibraryEditMode] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const { toasts, showToast } = useToast();

  const fetchLibrary = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: lib }, { data: tmpl }] = await Promise.all([
      supabase.from("exercise_library").select("id, name, sets, detail, video_url").eq("pt_id", user.id).order("name"),
      supabase.from("programs").select("id, title, estimated_minutes, sessions_per_week, notes").eq("pt_id", user.id).eq("is_template", true).order("title"),
    ]);
    setLibraryExercises(lib ?? []);
    setSavedToLibrary(new Set((lib ?? []).map((e: any) => e.name)));
    setTemplates(tmpl ?? []);
  };

  useEffect(() => { fetchLibrary(); }, []);

  const loadFromTemplate = async (template: TemplateItem) => {
    const { data: exList } = await supabase.from("exercises")
      .select("name, sets, detail, sort_order, video_url")
      .eq("program_id", template.id)
      .order("sort_order");
    setTitle(template.title);
    setMinutes(String(template.estimated_minutes));
    setNotes(template.notes ?? "");
    setSpw(template.sessions_per_week ?? 3);
    setExercises((exList ?? []).map((e) => ({ name: e.name, sets: String(e.sets), detail: e.detail, video_url: e.video_url ?? "" })));
    setShowTemplates(false);
    setTemplateSearch("");
    showToast("Template loaded");
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
    setExercises((prev) => [...prev, ...toAdd.map((e) => ({ name: e.name, sets: String(e.sets), detail: e.detail, video_url: e.video_url ?? "" }))]);
    setSelectedLibIds(new Set()); setShowLibrary(false); setLibraryEditMode(false);
  };

  const saveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Please enter a program title."); return; }
    const valid = exercises.filter((ex) => ex.name.trim() && ex.detail.trim());
    if (!valid.length) { setError("Add at least one exercise with a name and detail."); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const resolvedPtId = isTemplate ? (user?.id ?? "") : ptId;

    const { data: program, error: pErr } = await supabase.from("programs").insert({
      pt_id: resolvedPtId,
      client_id: isTemplate ? null : clientId,
      title: title.trim(),
      estimated_minutes: parseInt(minutes) || 30,
      notes: notes.trim() || null,
      sessions_per_week: spw,
      is_template: isTemplate,
    }).select().single();

    if (pErr || !program) { setError(pErr?.message ?? "Could not save."); setSaving(false); return; }

    await supabase.from("exercises").insert(valid.map((ex, i) => ({
      program_id: program.id, name: ex.name.trim(), sets: parseInt(ex.sets) || 3,
      detail: ex.detail.trim(), sort_order: i, video_url: ex.video_url.trim() || null,
    })));

    setSaving(false);
    if (isTemplate) {
      showToast("Template saved");
      setTimeout(() => router.push("/library"), 1000);
    } else {
      // Email the patient that a program was assigned. The assignment is
      // already saved either way — but surface the email result so a
      // failed notification doesn't silently look like success.
      let note = "";
      try {
        const res = await fetch("/api/notify-program", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programId: program.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          note = ` — email failed (${body?.error ?? `HTTP ${res.status}`})`;
        }
      } catch {
        note = " — email failed (network error)";
      }
      showToast(
        note ? `Program assigned to ${clientName}${note}` : `Program assigned to ${clientName} — email sent`,
        note ? "error" : "success"
      );
      setTimeout(() => router.back(), note ? 2500 : 1000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <ToastContainer toasts={toasts} />
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-surface-container transition-colors">
          <ArrowLeft size={22} className="text-on-surface-variant" />
        </button>
        <div>
          <p className="font-inter text-xs text-on-surface-variant">
            {isTemplate ? "Reusable Template" : `For ${clientName}`}
          </p>
          <h1 className="font-manrope font-bold text-xl text-on-background">
            {isTemplate ? "New Template" : "New Program"}
          </h1>
        </div>
      </div>

      <form onSubmit={saveProgram} className="flex flex-col gap-5">
        {/* Program info */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-4">
          <div>
            <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">PROGRAM TITLE</label>
            <input className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Week 1 Knee Recovery" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">ESTIMATED DURATION (MINUTES)</label>
            <input type="number" className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="30" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
          <div>
            <label className="block font-inter font-medium text-xs text-on-surface-variant mb-2 ml-1 tracking-wider">TIMES PER WEEK</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setSpw((v) => Math.max(1, v-1))}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
                <span className="text-on-surface-variant text-lg leading-none">−</span>
              </button>
              <span className="font-manrope font-extrabold text-3xl text-primary w-8 text-center">{spw}</span>
              <button type="button" onClick={() => setSpw((v) => Math.min(7, v+1))}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
                <Plus size={18} className="text-on-surface-variant" />
              </button>
              <span className="font-inter text-sm text-on-surface-variant">{spw === 1 ? "day per week" : "days per week"}</span>
            </div>
          </div>
          <div>
            <label className="block font-inter font-medium text-xs text-on-surface-variant mb-1.5 ml-1 tracking-wider">NOTES FOR PATIENT (OPTIONAL)</label>
            <textarea className="w-full bg-surface-container-low rounded-xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-20"
              placeholder="e.g. Focus on slow controlled movements..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        {/* Exercises */}
        <h2 className="font-manrope font-bold text-lg text-on-background">Exercises</h2>
        <div className="flex flex-col gap-3">
          {exercises.map((ex, i) => (
            <div key={i} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
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
                  {exercises.length > 1 && (
                    <button type="button" onClick={() => setExercises((prev) => prev.filter((_,j) => j!==i))}>
                      <X size={18} className="text-outline" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">EXERCISE NAME</label>
                  <input className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Hamstring Stretch" value={ex.name}
                    onChange={(e) => setExercises((prev) => prev.map((x,j) => j===i ? {...x, name: e.target.value} : x))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">SETS</label>
                    <input type="number" className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="3" value={ex.sets}
                      onChange={(e) => setExercises((prev) => prev.map((x,j) => j===i ? {...x, sets: e.target.value} : x))} />
                  </div>
                  <div>
                    <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">REPS / HOLD</label>
                    <input className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="12 Reps / 30s" value={ex.detail}
                      onChange={(e) => setExercises((prev) => prev.map((x,j) => j===i ? {...x, detail: e.target.value} : x))} />
                  </div>
                </div>
                <div>
                  <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">YOUTUBE VIDEO URL (OPTIONAL)</label>
                  <input type="url" className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="https://youtube.com/watch?v=..." value={ex.video_url}
                    onChange={(e) => setExercises((prev) => prev.map((x,j) => j===i ? {...x, video_url: e.target.value} : x))} />
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
          ))}
        </div>

        <button type="button" onClick={() => setExercises((prev) => [...prev, { name: "", sets: "3", detail: "", video_url: "" }])}
          className="border border-outline-variant rounded-2xl py-3 flex items-center justify-center gap-2 hover:bg-surface-container transition-colors">
          <Plus size={18} className="text-outline" />
          <span className="font-inter font-medium text-sm text-on-surface-variant">Add Exercise</span>
        </button>

        <button type="button" onClick={() => { fetchLibrary(); setShowLibrary(true); }}
          className="border border-primary-container rounded-2xl py-3 flex items-center justify-center gap-2 hover:bg-primary-container/20 transition-colors">
          <BookOpen size={18} className="text-primary" />
          <span className="font-inter font-medium text-sm text-primary">Browse exercise library</span>
        </button>

        {!isTemplate && templates.length > 0 && (
          <button type="button" onClick={() => setShowTemplates(true)}
            className="border border-primary-container rounded-2xl py-3 flex items-center justify-center gap-2 hover:bg-primary-container/20 transition-colors">
            <LayoutTemplate size={18} className="text-primary" />
            <span className="font-inter font-medium text-sm text-primary">Start from a template</span>
          </button>
        )}

        {error && <p className="text-sm text-error font-inter text-center">{error}</p>}

        <button type="submit" disabled={saving}
          className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-4 disabled:opacity-60 hover:opacity-90 transition-opacity mb-4">
          {saving ? "Saving..." : isTemplate ? "Save Template" : "Save & Assign Program"}
        </button>
      </form>

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-background rounded-3xl w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="font-manrope font-bold text-xl text-on-background">Start from Template</h2>
              <button onClick={() => { setShowTemplates(false); setTemplateSearch(""); }}
                className="p-1 rounded-full hover:bg-surface-container transition-colors">
                <X size={22} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="px-5 pb-3 shrink-0">
              <input
                className="w-full bg-surface-container rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-5 flex flex-col gap-2">
              {templates.filter((t) => t.title.toLowerCase().includes(templateSearch.toLowerCase())).map((t) => (
                <button key={t.id} onClick={() => loadFromTemplate(t)}
                  className="flex items-center px-4 py-3 rounded-2xl bg-surface-container-lowest shadow-sm w-full text-left hover:bg-primary-container/30 transition-colors">
                  <div className="flex-1">
                    <p className="font-inter font-semibold text-sm text-on-background">{t.title}</p>
                    <p className="font-inter text-xs text-on-surface-variant">{t.estimated_minutes} min · {t.sessions_per_week ?? 3}x/week</p>
                  </div>
                  <LayoutTemplate size={16} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <BookOpen size={40} className="text-outline-variant" />
                <p className="font-inter text-sm text-on-surface-variant mt-3 text-center">
                  No exercises saved yet.{"\n"}Tap the bookmark icon on any exercise to save it here.
                </p>
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
                      onClick={() => {
                        if (libraryEditMode) return;
                        setSelectedLibIds((prev) => { const n = new Set(prev); sel ? n.delete(item.id) : n.add(item.id); return n; });
                      }}
                      className={`flex items-center px-4 py-3 rounded-2xl w-full text-left transition-colors
                        ${!libraryEditMode && sel ? "bg-primary-container" : "bg-surface-container-lowest"} shadow-sm`}>
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

export default function NewProgram() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <NewProgramContent />
    </Suspense>
  );
}
