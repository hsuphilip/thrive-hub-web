import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Emails a patient when their PT assigns them a new program.
// Called fire-and-forget from the New Program page. By design this is the
// ONLY email the app sends patients — messages intentionally don't ping.
//
// Needs two server-only env vars (Vercel -> Settings -> Environment Variables):
//   RESEND_API_KEY             - Resend key with sending access
//   SUPABASE_SERVICE_ROLE_KEY  - Supabase -> Settings -> API (server-only:
//                                bypasses RLS; never expose with NEXT_PUBLIC_)
// If either is missing, the route no-ops with a 503 and the program
// assignment itself is unaffected.

const FROM = "Thrive Hub <noreply@send.thriveinmotionpt.com>";

export async function POST(request: Request) {
  const { programId } = await request.json().catch(() => ({}));
  if (typeof programId !== "string" || !programId) {
    return NextResponse.json({ error: "programId required" }, { status: 400 });
  }

  // Who is calling? (session cookie, same as middleware)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!serviceKey || !resendKey) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  // Only the PT who owns the program may trigger its notification.
  const { data: program } = await admin
    .from("programs")
    .select("pt_id, client_id")
    .eq("id", programId)
    .single();
  if (!program || program.pt_id !== user.id) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  if (!program.client_id) {
    return NextResponse.json({ error: "Program has no patient" }, { status: 400 });
  }

  const [{ data: patientUser }, { data: names }] = await Promise.all([
    admin.auth.admin.getUserById(program.client_id),
    admin.from("profiles").select("id, full_name").in("id", [user.id, program.client_id]),
  ]);
  const email = patientUser?.user?.email;
  if (!email) return NextResponse.json({ error: "Patient email not found" }, { status: 404 });

  const ptName = names?.find((n) => n.id === user.id)?.full_name || "Your physical therapist";
  const patientFirst = names?.find((n) => n.id === program.client_id)?.full_name?.split(" ")[0] || "there";

  // Deliberately generic: no program title or exercise details, so no
  // health-adjacent info leaves the app (see /privacy data-minimization).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: email,
      subject: "You have a new exercise program",
      text:
        `Hi ${patientFirst},\n\n` +
        `${ptName} just assigned you a new exercise program in Thrive Hub.\n\n` +
        `Sign in to see your exercises:\n${new URL(request.url).origin}/workouts\n\n` +
        `— Thrive Hub`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Resend send failed:", res.status, detail);
    return NextResponse.json({ error: "Send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
