import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Privacy Notice — Thrive Hub",
};

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="w-full max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Image src="/logo-icon.png" alt="Thrive Hub" width={64} height={64} className="mb-4" />
          <h1 className="font-manrope font-extrabold text-3xl text-on-background text-center">Privacy Notice</h1>
          <p className="font-inter text-sm text-on-surface-variant mt-2">Last updated: June 11, 2026</p>
        </div>

        <div className="flex flex-col gap-7 font-inter text-sm text-on-background leading-relaxed">
          <section>
            <p>
              Thrive Hub is the client platform of Thrive in Motion Physical Therapy, a cash-based,
              out-of-network physical therapy practice in San Jose, California. This notice explains
              what information we collect, how we use and protect it, and the choices you have.
            </p>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">Information we collect</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li><span className="font-semibold">Account details</span> — your name and email address.</li>
              <li>
                <span className="font-semibold">Exercise and program information</span> — the exercises
                your physical therapist assigns, your sets, reps, and progress, and any notes or feedback
                you choose to share about your exercises.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">Information we do <span className="italic">not</span> collect</h2>
            <p>
              Thrive Hub is used solely for exercise tracking and prescription. We do not collect or store
              medical records, diagnoses, medical history, insurance details, or payment card information
              in this app. Please do not enter sensitive medical information into notes, feedback, or
              messages — these fields are meant for exercise-related communication only.
            </p>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">How we use your information</h2>
            <p>
              We use your information only to deliver and manage your exercise program and to communicate
              with you about it. We do not sell or rent your information, and we do not share it for
              advertising.
            </p>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">How we protect it</h2>
            <p>
              Your data is encrypted in transit and at rest and is hosted by our service provider
              (Supabase). Access controls ensure that your information is visible only to you and your
              physical therapist. We maintain reasonable administrative, technical, and physical
              safeguards to keep it confidential.
            </p>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">Who we share it with</h2>
            <p>
              We share your information only with the service providers that host and operate the platform
              on our behalf, who are bound to keep it confidential. We will not otherwise disclose your
              information without your authorization, except where required by law.
            </p>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">Your choices</h2>
            <p>
              You may request access to, correction of, or deletion of your information at any time by
              contacting us. You may also ask us to close your account.
            </p>
          </section>

          <section>
            <h2 className="font-manrope font-bold text-lg text-on-background mb-2">Contact us</h2>
            <p>
              Questions about this notice or your information? Email us at{" "}
              <a href="mailto:philiphsu.pt@gmail.com" className="text-primary font-semibold hover:underline">
                philiphsu.pt@gmail.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-10 text-center">
          <Link href="/signup" className="text-primary font-semibold text-sm hover:underline">
            Back to sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
