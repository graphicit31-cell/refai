"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

export default function DebugBillingPage() {
  const clerk = useClerk();
  const [data, setData] = useState<any>(null);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <button
        className="bg-white text-black px-4 py-2 rounded"
        onClick={async () => {
          const sub = await clerk.billing.getSubscription({});
          console.log(sub);
          setData(sub);
        }}
      >
        Check subscription
      </button>

      <pre className="mt-6 whitespace-pre-wrap text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}