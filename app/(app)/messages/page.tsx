"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast, ToastContainer } from "@/components/toast";

type Profile = { id: string; full_name: string; role: string };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };

export default function Messages() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [selectedContact, setSelectedContact] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toasts, showToast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => setCurrentUser(data));
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const fetch = async () => {
      if (currentUser.role === "pt") {
        const { data } = await supabase.from("pt_clients")
          .select("client_id, profiles!pt_clients_client_id_fkey(id, full_name, role)").eq("pt_id", currentUser.id);
        const list = (data ?? []).map((r: any) => r.profiles).filter(Boolean);
        setContacts(list);
        if (list.length > 0) setSelectedContact(list[0]);
      } else {
        const { data } = await supabase.from("pt_clients")
          .select("pt_id, profiles!pt_clients_pt_id_fkey(id, full_name, role)").eq("client_id", currentUser.id);
        const list = (data ?? []).map((r: any) => r.profiles).filter(Boolean);
        setContacts(list);
        if (list.length > 0) setSelectedContact(list[0]);
      }
      setLoading(false);
    };
    fetch();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedContact) return;
    const fetch = async () => {
      const { data } = await supabase.from("messages").select("*")
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${currentUser.id})`)
        .order("created_at", { ascending: true });
      setMessages(data ?? []);
    };
    fetch();

    const channel = supabase.channel(`messages-${selectedContact.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === currentUser.id && msg.receiver_id === selectedContact.id) ||
            (msg.sender_id === selectedContact.id && msg.receiver_id === currentUser.id)) {
          setMessages((prev) => [...prev, msg]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, selectedContact]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUser || !selectedContact) return;
    const content = message.trim();
    setMessage("");
    const { error } = await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: selectedContact.id, content });
    if (error) {
      setMessage(content);
      showToast("Message didn't send — try again.", "error");
    }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (contacts.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <MessageCircle size={48} className="text-outline-variant" />
      <h2 className="font-manrope font-bold text-xl text-on-background mt-4 mb-2 text-center">No conversations yet</h2>
      <p className="font-inter text-sm text-on-surface-variant text-center">
        {currentUser?.role === "pt" ? "Add a client to start messaging them." : "Your PT hasn't connected with you yet."}
      </p>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      <ToastContainer toasts={toasts} />

      {/* Contact sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 border-r border-outline-variant/50 shrink-0 overflow-y-auto">
        <p className="font-inter font-semibold text-xs text-on-surface-variant uppercase tracking-widest px-4 pt-5 pb-3">
          {currentUser?.role === "pt" ? "Patients" : "Therapist"}
        </p>
        {contacts.map((c) => (
          <button key={c.id} onClick={() => setSelectedContact(c)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors
              ${selectedContact?.id === c.id ? "bg-primary/10" : "hover:bg-surface-container"}`}>
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="font-manrope font-bold text-sm text-primary">{c.full_name[0]}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className={`font-inter font-semibold text-sm truncate ${selectedContact?.id === c.id ? "text-primary" : "text-on-background"}`}>
                {c.full_name}
              </p>
              <p className="font-inter text-xs text-on-surface-variant">{c.role === "pt" ? "Therapist" : "Patient"}</p>
            </div>
          </button>
        ))}
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile tabs — always visible */}
        <div className="md:hidden flex gap-2 overflow-x-auto px-4 pt-4 pb-2 border-b border-outline-variant/50 shrink-0">
          {contacts.map((c) => (
            <button key={c.id} onClick={() => setSelectedContact(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-inter font-medium whitespace-nowrap transition-colors shrink-0
                ${selectedContact?.id === c.id ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}>
              {c.full_name}
            </button>
          ))}
        </div>

        {/* Chat header */}
        {selectedContact && (
          <div className="px-5 py-3 border-b border-outline-variant/50 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="font-manrope font-bold text-sm text-primary">{selectedContact.full_name[0]}</span>
            </div>
            <div>
              <p className="font-inter font-semibold text-sm text-on-background">{selectedContact.full_name}</p>
              <p className="font-inter text-xs text-on-surface-variant">{selectedContact.role === "pt" ? "Physical Therapist" : "Patient"}</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="font-inter text-sm text-on-surface-variant text-center mt-8">No messages yet. Say hello!</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUser?.id;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                    <span className="font-inter font-semibold text-xs text-primary">{selectedContact?.full_name[0]}</span>
                  </div>
                )}
                <div className="max-w-xs">
                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${isMe ? "bg-primary rounded-br-sm" : "bg-surface-container-lowest rounded-bl-sm"}`}>
                    <p className={`font-inter text-sm ${isMe ? "text-on-primary" : "text-on-background"}`}>{msg.content}</p>
                  </div>
                  <p className={`font-inter text-[10px] text-on-surface-variant mt-1 ${isMe ? "text-right" : "text-left"}`}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="px-5 py-3 border-t border-outline-variant/50 flex items-center gap-3 shrink-0">
          <input
            className="flex-1 bg-surface-container rounded-full px-4 py-2.5 font-inter text-sm text-on-background outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" disabled={!message.trim()}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-50 hover:opacity-90 transition-opacity">
            <Send size={16} className="text-on-primary" />
          </button>
        </form>
      </div>
    </div>
  );
}
