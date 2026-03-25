"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus, MessageCircle, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Program = { id: string; title: string; estimated_minutes: number; created_at: string };

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ptId, setPtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setPtId(user.id);

      const [{ data: profile }, { data: progs }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", id).single(),
        supabase.from("programs").select("id, title, estimated_minutes, created_at")
          .eq("client_id", id).order("created_at", { ascending: false }),
      ]);

      setClientName(profile?.full_name ?? "Client");
      setPrograms(progs ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-surface-container transition-colors">
          <ArrowLeft size={22} className="text-on-surface-variant" />
        </button>
        <div>
          <p className="font-inter text-xs text-on-surface-variant">Patient</p>
          <h1 className="font-manrope font-bold text-xl text-on-background">{clientName}</h1>
        </div>
      </div>

      {/* Actions */}
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

      {/* Programs */}
      <h2 className="font-inter font-semibold text-xs text-on-surface-variant uppercase tracking-widest mb-3">Programs</h2>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <ClipboardList size={40} className="text-outline-variant" />
          <p className="font-inter text-sm text-on-surface-variant mt-3 text-center">No programs yet. Create one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {programs.map((p) => (
            <button key={p.id} onClick={() => router.push(`/program/${p.id}`)}
              className="bg-surface-container-lowest rounded-2xl px-4 py-3.5 flex items-center gap-3 w-full text-left shadow-sm hover:bg-surface-container-low transition-colors">
              <div className="flex-1">
                <p className="font-inter font-semibold text-sm text-on-background">{p.title}</p>
                <p className="font-inter text-xs text-on-surface-variant mt-0.5">
                  {p.estimated_minutes} min · {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <ChevronRight size={18} className="text-outline shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
