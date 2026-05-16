// app/terms/page.tsx

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="text-white/60">Last updated: May 16, 2026</p>

        <p>
          These Terms of Service govern your use of RefAI, an AI-powered citation
          generation service.
        </p>

        <h2 className="text-2xl font-semibold">Use of Service</h2>
        <p>
          You may use RefAI only for lawful purposes. You may not misuse the
          service, attempt to disrupt it, reverse engineer it, or use it for
          plagiarism, academic misconduct, or illegal activity.
        </p>

        <h2 className="text-2xl font-semibold">AI-Generated Content</h2>
        <p>
          RefAI uses artificial intelligence to assist citation generation.
          Generated references may not always be accurate, complete, or suitable
          for your specific academic requirements. You are responsible for
          checking all outputs before submission.
        </p>

        <h2 className="text-2xl font-semibold">Subscriptions and Payments</h2>
        <p>
          Paid plans are billed through Stripe. Subscription fees are charged in
          advance and may renew automatically unless canceled. Due to the digital
          nature of the service, payments are generally non-refundable unless
          required by law.
        </p>

        <h2 className="text-2xl font-semibold">Intellectual Property</h2>
        <p>
          RefAI owns the service, software, branding, design, and website content.
          Users retain ownership of text they submit, but grant RefAI permission
          to process it to provide the service.
        </p>

        <h2 className="text-2xl font-semibold">Limitation of Liability</h2>
        <p>
          RefAI is provided “as is” without guarantees. We are not responsible for
          academic penalties, lost work, incorrect citations, service downtime, or
          other damages resulting from use of the service.
        </p>

        <h2 className="text-2xl font-semibold">Termination</h2>
        <p>
          We may suspend or terminate access if a user violates these Terms or
          abuses the service.
        </p>

        <h2 className="text-2xl font-semibold">Governing Law</h2>
        <p>
          These Terms are governed by the laws of Japan.
        </p>

        <h2 className="text-2xl font-semibold">Contact</h2>
        <p>
          If you have questions about these Terms, contact us at
          support@getrefai.com.
        </p>
      </div>
    </main>
  );
}