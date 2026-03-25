"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, ChevronRight, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ClientWithStats = {
  id: string; full_name: string;
  sessions_this_week: number; last_active: string | null;
};

function formatLastActive(ts: string | null) {
  if (!ts) return "never active";
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "active today";
  if (d === 1) return "active yesterday";
  return `active ${d}d ago`;
}

export default function Clients() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [ptId, setPtId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [nameResults, setNameResults] = useState<{ id: string; full_name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState("");

  const fetchClients = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("pt_clients")
      .select("client_id, profiles!pt_clients_client_id_fkey(id, full_name, avatar_url)")
      .eq("pt_id", id);

    const clientList = (data ?? []).map((r: any) => r.profiles).filter(Boolean);
    if (!clientList.length) { setClients([]); setLoading(false); return; }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const { data: fb } = await supabase.from("exercise_feedback")
      .select("client_id, created_at")
      .in("client_id", clientList.map((c: any) => c.id))
      .gte("created_at", weekStart.toISOString());

    const statsMap: Record<string, { days: Set<string>; last: string | null }> = {};
    (fb ?? []).forEach((f: any) => {
      if (!statsMap[f.client_id]) statsMap[f.client_id] = { days: new Set(), last: null };
      statsMap[f.client_id].days.add(new Date(f.created_at).toDateString());
      if (!statsMap[f.client_id].last || f.created_at > statsMap[f.client_id].last!) statsMap[f.client_id].last = f.created_at;
    });

    setClients(clientList.map((c: any) => ({
      id: c.id, full_name: c.full_name,
      sessions_this_week: statsMap[c.id]?.days.size ?? 0,
      last_active: statsMap[c.id]?.last ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setPtId(user.id);
      fetchClients(user.id);
    });
  }, [fetchClients]);

  const searchPatients = async (name: string) => {
    setSearchName(name);
    if (!name.trim()) { setNameResults([]); return; }
    setSearching(true);
    const { data } = await supabase.from("profiles")
      .select("id, full_name")
      .eq("role", "client")
      .ilike("full_name", `%${name.trim()}%`)
      .limit(10);
    const existingIds = new Set(clients.map((c) => c.id));
    setNameResults((data ?? []).filter((p: any) => !existingIds.has(p.id)));
    setSearching(false);
  };

  const addClient = async (profile: { id: string; full_name: string }) => {
    if (!ptId) return;
    setAdding(profile.id); setAddError("");
    const { error: linkErr } = await supabase.from("pt_clients").insert({ pt_id: ptId, client_id: profile.id });
    setAdding(null);
    if (linkErr) { setAddError(linkErr.message); return; }
    setSearchName(""); setNameResults([]); setShowModal(false);
    fetchClients(ptId);
  };

  const closeModal = () => { setShowModal(false); setSearchName(""); setNameResults([]); setAddError(""); };

  const removeClient = async (client: ClientWithStats) => {
    if (!confirm(`Remove ${client.full_name} from your client list?`)) return;
    await supabase.from("pt_clients").delete().eq("pt_id", ptId!).eq("client_id", client.id);
    setClients((prev) => prev.filter((c) => c.id !== client.id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <div className="mb-6">
        <p className="font-inter font-medium text-xs text-primary uppercase tracking-widest mb-1">PT Dashboard</p>
        <h1 className="font-manrope font-extrabold text-3xl text-on-background">My Clients</h1>
        <p className="font-inter text-sm text-on-surface-variant mt-1">
          {clients.length} {clients.length === 1 ? "patient" : "patients"} under your care
        </p>
      </div>

      {/* Add client button */}
      <button onClick={() => setShowModal(true)}
        className="bg-primary rounded-2xl p-4 flex items-center gap-3 w-full text-left mb-6 hover:opacity-95 transition-opacity">
        <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
          <UserPlus size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-inter font-semibold text-sm text-on-primary">Add New Client</p>
          <p className="font-inter text-xs text-primary-container">Search by patient name</p>
        </div>
        <ChevronRight size={20} className="text-primary-container" />
      </button>

      {/* Client list */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Users size={48} className="text-outline-variant" />
          <h2 className="font-manrope font-bold text-lg text-on-background mt-4 mb-2">No clients yet</h2>
          <p className="font-inter text-sm text-on-surface-variant text-center">
            Add your first client above. They'll need to sign up as a patient first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map((client) => (
            <div key={client.id} className="bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-3 shadow-sm group">
              <button onClick={() => router.push(`/clients/${client.id}`)} className="flex items-center gap-3 flex-1 text-left">
                <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                  <span className="font-manrope font-bold text-lg text-primary">{client.full_name[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter font-semibold text-sm text-on-background">{client.full_name}</p>
                  <p className="font-inter text-xs text-on-surface-variant">
                    {client.sessions_this_week > 0
                      ? `${client.sessions_this_week} session${client.sessions_this_week === 1 ? "" : "s"} this week · ${formatLastActive(client.last_active)}`
                      : "No activity this week"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-outline" />
              </button>
              <button onClick={() => removeClient(client)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-error-container ml-1"
                title="Remove client">
                <X size={14} className="text-error" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add client modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-background rounded-3xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="font-manrope font-bold text-xl text-on-background">Add a Patient</h2>
              <button onClick={closeModal} className="p-1 rounded-full hover:bg-surface-container transition-colors">
                <X size={22} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="px-5 pb-2">
              <input
                autoFocus
                className="w-full bg-surface-container-low rounded-2xl px-4 py-3.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search by patient name..."
                value={searchName}
                onChange={(e) => searchPatients(e.target.value)}
              />
            </div>
            <div className="px-5 pb-5 min-h-[80px]">
              {searching && (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!searching && searchName.trim() && nameResults.length === 0 && (
                <p className="font-inter text-sm text-on-surface-variant text-center py-6">
                  No patients found matching "{searchName}"
                </p>
              )}
              {!searching && nameResults.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {nameResults.map((p) => (
                    <button key={p.id} onClick={() => addClient(p)} disabled={adding === p.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low transition-colors w-full text-left disabled:opacity-60">
                      <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                        <span className="font-manrope font-bold text-sm text-primary">{p.full_name[0].toUpperCase()}</span>
                      </div>
                      <span className="font-inter font-semibold text-sm text-on-background flex-1">{p.full_name}</span>
                      {adding === p.id
                        ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        : <UserPlus size={16} className="text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              {addError && <p className="font-inter text-sm text-error mt-3">{addError}</p>}
              {!searchName.trim() && (
                <p className="font-inter text-xs text-on-surface-variant text-center pt-4 pb-2">
                  Patients need to sign up as a patient account first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
