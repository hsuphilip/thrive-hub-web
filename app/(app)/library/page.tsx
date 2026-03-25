"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LibraryExercise = { id: string; name: string; sets: number; detail: string; video_url: string | null };
type Form = { name: string; sets: string; detail: string; video_url: string };

const EMPTY_FORM: Form = { name: "", sets: "3", detail: "", video_url: "" };

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default function LibraryPage() {
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [ptId, setPtId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LibraryExercise | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setPtId(user.id);
      const { data } = await supabase.from("exercise_library")
        .select("id, name, sets, detail, video_url")
        .eq("pt_id", user.id)
        .order("name");
      setExercises(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (ex: LibraryExercise) => {
    setEditTarget(ex);
    setForm({ name: ex.name, sets: String(ex.sets), detail: ex.detail, video_url: ex.video_url ?? "" });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditTarget(null); setForm(EMPTY_FORM); setError(""); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Exercise name is required."); return; }
    if (!form.detail.trim()) { setError("Reps/Hold detail is required."); return; }
    setSaving(true);
    setError("");

    if (editTarget) {
      const { error: err } = await supabase.from("exercise_library").update({
        name: form.name.trim(),
        sets: parseInt(form.sets) || 3,
        detail: form.detail.trim(),
        video_url: form.video_url.trim() || null,
      }).eq("id", editTarget.id);
      if (err) { setError(err.message); setSaving(false); return; }
      setExercises((prev) =>
        prev.map((ex) => ex.id === editTarget.id
          ? { ...ex, name: form.name.trim(), sets: parseInt(form.sets) || 3, detail: form.detail.trim(), video_url: form.video_url.trim() || null }
          : ex
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
    } else {
      if (!ptId) return;
      // Duplicate check
      const duplicate = exercises.find((ex) => ex.name.toLowerCase() === form.name.trim().toLowerCase());
      if (duplicate) { setError(`"${form.name.trim()}" already exists in your library.`); setSaving(false); return; }
      const { data, error: err } = await supabase.from("exercise_library").insert({
        pt_id: ptId,
        name: form.name.trim(),
        sets: parseInt(form.sets) || 3,
        detail: form.detail.trim(),
        video_url: form.video_url.trim() || null,
      }).select("id, name, sets, detail, video_url").single();
      if (err || !data) { setError(err?.message ?? "Could not save exercise."); setSaving(false); return; }
      setExercises((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }

    setSaving(false);
    closeForm();
  };

  const handleDelete = async (ex: LibraryExercise) => {
    if (!window.confirm(`Delete "${ex.name}" from your library?`)) return;
    await supabase.from("exercise_library").delete().eq("id", ex.id);
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-1">PT Tools</p>
          <h1 className="font-manrope font-extrabold text-3xl text-on-background">Exercise Library</h1>
        </div>
        <button
          onClick={openAdd}
          className="bg-primary text-on-primary font-inter font-semibold text-sm rounded-full px-4 py-2.5 flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Plus size={16} />
          Add Exercise
        </button>
      </div>

      {exercises.length === 0 ? (
        <div className="flex flex-col items-center py-20">
          <BookOpen size={48} className="text-outline-variant" />
          <h2 className="font-manrope font-bold text-lg text-on-background mt-4 mb-2">Library is empty</h2>
          <p className="font-inter text-sm text-on-surface-variant text-center">
            Add exercises here to quickly build programs for your patients.
          </p>
        </div>
      ) : (
        <>
          <input
            className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30 shadow-sm mb-3"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {exercises.filter((ex) => ex.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
            <p className="font-inter text-sm text-on-surface-variant text-center py-10">No exercises match "{search}"</p>
          ) : (
          <div className="flex flex-col gap-3">
            {exercises.filter((ex) => ex.name.toLowerCase().includes(search.toLowerCase())).map((ex) => (
            <div key={ex.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              <div
                className={`px-4 py-3.5 flex items-center gap-3 ${ex.video_url ? "cursor-pointer hover:bg-surface-container-low transition-colors" : ""}`}
                onClick={() => ex.video_url && setExpandedId(expandedId === ex.id ? null : ex.id)}>
                <div className="flex-1 min-w-0">
                  <p className="font-inter font-semibold text-sm text-on-background">{ex.name}</p>
                  <p className="font-inter text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                    {ex.sets} sets · {ex.detail}
                    {ex.video_url && (
                      <>
                        <span className="ml-1 text-primary">· video</span>
                        {expandedId === ex.id ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />}
                      </>
                    )}
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); openEdit(ex); }} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                  <Pencil size={16} className="text-on-surface-variant" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(ex); }} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                  <Trash2 size={16} className="text-error" />
                </button>
              </div>
              {expandedId === ex.id && ex.video_url && getYouTubeId(ex.video_url) && (
                <div className="aspect-video border-t border-surface-container">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${getYouTubeId(ex.video_url)}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          ))}
          </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-background rounded-3xl w-full max-w-md">
            <form onSubmit={handleSave}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <h2 className="font-manrope font-bold text-xl text-on-background">
                  {editTarget ? "Edit Exercise" : "Add Exercise"}
                </h2>
                <button type="button" onClick={closeForm} className="p-1 rounded-full hover:bg-surface-container transition-colors">
                  <X size={22} className="text-on-surface-variant" />
                </button>
              </div>

              <div className="px-5 pb-5 flex flex-col gap-3">
                <div>
                  <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">EXERCISE NAME</label>
                  <input
                    className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Hamstring Stretch"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">SETS</label>
                    <input
                      type="number"
                      className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="3"
                      value={form.sets}
                      onChange={(e) => setForm((f) => ({ ...f, sets: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">REPS / HOLD</label>
                    <input
                      className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="12 Reps / 30s"
                      value={form.detail}
                      onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-inter font-medium text-[11px] text-on-surface-variant mb-1 ml-1 tracking-wider">YOUTUBE VIDEO URL (OPTIONAL)</label>
                  <input
                    type="url"
                    className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="https://youtube.com/watch?v=..."
                    value={form.video_url}
                    onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                  />
                  {getYouTubeId(form.video_url) && (
                    <div className="mt-2 rounded-xl overflow-hidden aspect-video">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${getYouTubeId(form.video_url)}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>

                {error && <p className="font-inter text-sm text-error">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-on-primary font-manrope font-bold text-base rounded-full py-3.5 w-full disabled:opacity-60 hover:opacity-90 transition-opacity mt-1">
                  {saving ? "Saving..." : editTarget ? "Save Changes" : "Add to Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
