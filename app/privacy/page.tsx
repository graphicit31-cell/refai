// app/privacy/page.tsx

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-white/60">Last updated: May 16, 2026</p>

        <p>
          RefAI collects limited information necessary to provide our AI-powered
          citation generation service, including account information, usage data,
          and text submitted for citation generation.
        </p>

        <h2 className="text-2xl font-semibold">Information We Collect</h2>
        <p>
          We may collect your email address, account login information, usage
          history, submitted text, generated citation results, and payment-related
          information. Payment information is processed by Stripe and is not
          directly stored by RefAI.
        </p>

        <h2 className="text-2xl font-semibold">Use of Third-Party Services</h2>
        <p>
          RefAI uses third-party services including Clerk for authentication,
          Stripe for payments, OpenAI for AI processing, Tavily for web search,
          and Vercel for hosting.
        </p>

        <h2 className="text-2xl font-semibold">AI Processing</h2>
        <p>
          Text submitted to RefAI may be processed by AI and search providers to
          generate citation suggestions. Users should not submit sensitive,
          confidential, or personal information.
        </p>

        <h2 className="text-2xl font-semibold">Cookies</h2>
        <p>
          RefAI may use cookies and similar technologies for authentication,
          security, and session management.
        </p>

        <h2 className="text-2xl font-semibold">Data Accuracy</h2>
        <p>
          AI-generated references may contain errors. Users are responsible for
          verifying all citation results before academic or professional use.
        </p>

        <h2 className="text-2xl font-semibold">Contact</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at
          support@getrefai.com.
        </p>
      </div>
    </main>
  );
}