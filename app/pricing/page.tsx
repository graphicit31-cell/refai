import { PricingTable } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">
          Upgrade RefAI
        </h1>
        <p className="text-white/60 text-center mb-10">
          Unlock unlimited generations, PDF export, and saved history.
        </p>

        <div className="max-w-4xl mx-auto">
          <PricingTable
            for="user"
            newSubscriptionRedirectUrl="/?refreshBilling=true"
          />
        </div>
      </div>
    </main>
  );
}