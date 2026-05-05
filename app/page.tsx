"use client";

import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import Logo from "@/components/Logo";
import {
SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";

type UsageInfo = {
  isPro: boolean;
  usedToday: number | null;
  dailyLimit: number | null;
  remaining: number | null;
};

export default function Page() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const [comment, setComment] = useState("");
  const [usageReady, setUsageReady] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const { isLoaded, isSignedIn, has } = useAuth();
  const { user } = useUser();

  const [, force] = useState(0);

  const scroll = useRef(0);
  const target = useRef(0);

  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  const blobs = useRef([
    { x: 0, y: 0, dx: 1.2, dy: 1.1 },
    { x: 200, y: -120, dx: -1.1, dy: 1.3 },
    { x: -180, y: 150, dx: 1.0, dy: -1.2 },
  ]);

  const canUseUnlimited =
    isLoaded && isSignedIn ? has({ feature: "unlimited_generations" }) : false;

  const canUsePdfExport =
    isLoaded && isSignedIn ? has({ feature: "pdf_export" }) : false;

  const canUseHistory =
    isLoaded && isSignedIn ? has({ feature: "history_access" }) : false;

  const goToPricing = () => {
    window.location.href = "/pricing";
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const shouldRefresh =
      typeof window !== "undefined" &&
      window.location.search.includes("refreshBilling=true");

    if (!shouldRefresh || !user) return;

    const run = async () => {
      try {
        await user.reload();
        window.history.replaceState({}, "", "/");
        window.location.reload();
      } catch (err) {
        console.error("Billing refresh failed:", err);
      }
    };

    run();
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem("refai-history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (isLoaded) {
      setUsageReady(true);

      if (canUseUnlimited) {
        setUsageInfo({
          isPro: true,
          usedToday: null,
          dailyLimit: null,
          remaining: null,
        });
      }
    }
  }, [isLoaded, canUseUnlimited]);

  useEffect(() => {
    if (isMobile) return;

    const onWheel = (e: WheelEvent) => {
      const el = e.target as Node;

      if (
        textRef.current?.contains(el) ||
        resultRef.current?.contains(el) ||
        historyRef.current?.contains(el)
      ) {
        return;
      }

      const worldHeight =
        worldRef.current?.scrollHeight || window.innerHeight * 3;
      const maxScroll = Math.max(0, worldHeight - window.innerHeight);

      target.current += e.deltaY * 0.8;
      target.current = Math.max(0, Math.min(target.current, maxScroll));
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [isMobile]);

useEffect(() => {
  if (!isMobile) {
    document.body.style.overflow = "auto";
  }
}, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      setIsFinal(false);
      return;
    }

    let frameId = 0;

    const animate = () => {
      scroll.current += (target.current - scroll.current) * 0.08;

      const w = window.innerWidth;
      const h = window.innerHeight;

      blobs.current = blobs.current.map((b) => {
        let { x, y, dx, dy } = b;

        x += dx;
        y += dy;

        const limitX = w / 2 - 150;
        const limitY = h / 2 - 150;

        if (x > limitX || x < -limitX) dx *= -1;
        if (y > limitY || y < -limitY) dy *= -1;

        return { x, y, dx, dy };
      });

      setIsFinal(scroll.current > window.innerHeight * 1.5);

      force((v) => v + 1);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isMobile]);

  const y = isMobile ? 0 : scroll.current;

  const handleGenerate = async () => {
    if (!text.trim()) return;
    if (!usageReady) return;

    setLoading(true);
    setLimitReached(false);

    try {
      console.log("fetching /api/generate");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      console.log("generate status:", res.status);
      console.log("generate data:", data);

      setLimitReached(res.status === 403);

      if (!res.ok) {
        if (res.status !== 403) {
          alert(data?.result || "Generate failed");
        }
        return;
      }

      if (data?.usage) {
        setUsageInfo(data.usage);
      }

      if (data?.message) {
        alert(data.message);
        return;
      }

      if (!data?.result || typeof data.result !== "string") {
        alert("No references were returned.");
        return;
      }

      const newRefs = data.result
        .split("\n")
        .map((r: string) => r.replace(/^[-–—]\s*/, "").trim())
        .filter((r: string) => r.length > 0);

      if (newRefs.length === 0) {
        alert("No references were generated.");
        return;
      }

      const mergedResults = [...results, ...newRefs].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      setResults(mergedResults);

      if (canUseHistory) {
        const uniqueHistory = Array.from(
          new Set([...history, ...newRefs])
        ).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        setHistory(uniqueHistory);
        localStorage.setItem("refai-history", JSON.stringify(uniqueHistory));
      }
    } catch (error) {
      console.error("Generate failed:", error);
      alert("Something went wrong while generating references.");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    if (!canUsePdfExport) {
      goToPricing();
      return;
    }

    const doc = new jsPDF();
    const textContent = results.join("\n");
    const lines = doc.splitTextToSize(textContent, 180);
    doc.text(lines, 10, 10);
    doc.save("refai.pdf");
  };

  const clearAll = () => setResults([]);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("refai-history");
  };

  const sendComment = () => {
    const subject = encodeURIComponent("RefAI Feedback");
    const body = encodeURIComponent(comment);
    window.open(`mailto:yourgmail@gmail.com?subject=${subject}&body=${body}`);
    setComment("");
  };

  const usageMessage = () => {
    if (!usageReady) return "Checking usage...";
    if (usageInfo?.isPro || canUseUnlimited) {
      return "Pro plan active — unlimited generations";
    }
    if (usageInfo) {
      return `Free plan — ${usageInfo.remaining} left today`;
    }
    return "Free plan — usage updates after first generation";
  };

  return (
    <main
  className={`inset-0 bg-black text-white ${
    isMobile
      ? "relative min-h-screen overflow-x-hidden"
      : "relative min-h-screen overflow-x-hidden"
  }`}
>
      <div
        className={`fixed top-6 left-6 right-6 z-[999] flex items-center justify-between transition-opacity duration-500 ${
          !isMobile && isFinal ? "opacity-0" : "opacity-100"
        }`}
      >
        <Logo />

        <div className="flex items-center gap-3">
          <button
            onClick={goToPricing}
            className="text-sm bg-white text-black px-3 py-2 rounded-xl hover:opacity-90 transition"
          >
            Upgrade
          </button>
{isLoaded && !isSignedIn && (
  <>
    <SignInButton mode="modal">
      <button className="text-sm border border-white/20 px-3 py-2 rounded-xl hover:bg-white/10 transition">
        Log in
      </button>
    </SignInButton>

    <SignUpButton mode="modal">
      <button className="text-sm bg-blue-500 px-3 py-2 rounded-xl hover:opacity-90 transition">
        Sign up
      </button>
    </SignUpButton>
  </>
)}

{isLoaded && isSignedIn && <UserButton />}
        </div>
      </div>

      <div className="absolute inset-0 bg-black" />

       {isMobile ? (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* base */}
    <div className="absolute inset-0 bg-gradient-to-b from-black via-[#050816] to-black" />

    {/* main hero glow */}
    <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[380px] h-[380px] bg-blue-500/40 rounded-full blur-3xl" />

    {/* middle brand blob */}
    <div className="absolute top-[38%] left-1/2 -translate-x-1/2 w-[240px] h-[240px] bg-indigo-500/30 rounded-full blur-2xl" />

    {/* left blob */}
    <div className="absolute top-1/3 -left-20 w-[260px] h-[260px] bg-indigo-500/30 rounded-full blur-2xl" />

    {/* right blob */}
    <div className="absolute bottom-0 right-[-60px] w-[300px] h-[300px] bg-cyan-400/25 rounded-full blur-2xl" />

    {/* 🔵 NEW blobs (adds depth) */}
    <div className="absolute bottom-[20%] left-[10%] w-[180px] h-[180px] bg-blue-400/25 rounded-full blur-2xl" />

    <div className="absolute top-[55%] right-[15%] w-[160px] h-[160px] bg-indigo-400/20 rounded-full blur-2xl" />

    <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 w-[220px] h-[220px] bg-cyan-300/20 rounded-full blur-2xl" />

    {/* subtle highlight */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_60%)]" />
  </div>
) : (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            isFinal ? "opacity-0" : "opacity-100"
          }`}
        >
          {blobs.current.map((b, i) => (
            <div
              key={i}
              className={`absolute w-72 h-72 blur-3xl rounded-full opacity-30 ${
                i === 0
                  ? "bg-blue-500"
                  : i === 1
                  ? "bg-indigo-500"
                  : "bg-cyan-400"
              }`}
              style={{
                transform: `translate(calc(50vw + ${b.x}px), calc(50vh + ${b.y}px))`,
              }}
            />
          ))}
        </div>
      )}

      <div
        ref={worldRef}
        className={isMobile ? "relative z-10" : "absolute inset-0 will-change-transform"}
        style={isMobile ? undefined : { transform: `translateY(${-y}px)` }}
      >
        <section className="h-screen flex items-center justify-center">
          <div className="text-center px-6">
            <h1 className="text-5xl md:text-6xl font-bold">RefAI</h1>
            <p className="text-white/60 mt-4">
              AI-powered APA reference generator
            </p>
          </div>
        </section>

        <section className="h-screen flex items-center justify-center px-6">
          <div
            className={`max-w-2xl p-10 rounded-3xl text-center ${
              isMobile
                ? "bg-white/[0.04] border border-white/10 shadow-[0_0_60px_rgba(59,130,246,0.06)]"
                : "bg-white/5 border border-white/10 backdrop-blur-xl"
            }`}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              A new way to write academic references
            </h2>
            <p className="text-white/60">
              RefAI removes formatting friction so you can focus on ideas.
            </p>
          </div>
        </section>

        <section className="min-h-screen flex items-start justify-center bg-black/80 py-16">
          <div className="w-full max-w-4xl px-6 text-center">
            <div className="mb-8">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                RefAI
              </div>
              <p className="text-white/50 text-sm">APA Reference Generator</p>
            </div>

            <div className="mb-4 text-sm text-white/60">{usageMessage()}</div>

            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-40 p-4 rounded-2xl bg-white/5 border border-white/10 mb-4"
              placeholder="Paste your text here..."
            />

            <button
              onClick={handleGenerate}
              disabled={loading || !usageReady}
              className={`w-full py-3 rounded-2xl transition ${
                loading || !usageReady
                  ? "bg-blue-500/50 cursor-not-allowed"
                  : "bg-blue-500 hover:opacity-90"
              }`}
            >
              {!usageReady
                ? "Checking plan..."
                : loading
                ? "Generating..."
                : "Generate References"}
            </button>

            {limitReached && (
              <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-white/70">
                  You’ve reached the free limit. Upgrade to Pro for unlimited access.
                </p>
                <button
                  onClick={goToPricing}
                  className="mt-3 bg-white text-black px-4 py-2 rounded-xl"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

            {results.length > 0 && (
              <div
                ref={resultRef}
                className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl max-h-60 overflow-y-auto overflow-x-hidden"
              >
                <div className="flex justify-between mb-3">
                  <p className="text-sm text-white/60">Generated</p>
                  <button
                    onClick={clearAll}
                    className="text-xs border px-2 py-1 rounded-lg hover:bg-white/10 transition"
                  >
                    Clear
                  </button>
                </div>

                <ul className="space-y-2 text-sm text-left">
                  {results.map((ref, i) => (
                    <li key={i} className="break-words whitespace-pre-wrap">
                      - {ref}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={exportPDF}
                  className={`mt-4 w-full py-2 rounded-xl transition ${
                    canUsePdfExport
                      ? "bg-cyan-500 hover:opacity-90"
                      : "bg-white/10 border border-white/10 hover:bg-white/15"
                  }`}
                >
                  {canUsePdfExport ? "Export PDF" : "Upgrade to export PDF"}
                </button>
              </div>
            )}

            {canUseHistory ? (
              history.length > 0 && (
                <div
                  ref={historyRef}
                  className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl max-h-60 overflow-y-auto overflow-x-hidden"
                >
                  <div className="flex justify-between mb-3">
                    <p className="text-sm text-white/60">History</p>
                    <button
                      onClick={clearHistory}
                      className="text-xs border px-2 py-1 rounded-lg hover:bg-white/10 transition"
                    >
                      Clear History
                    </button>
                  </div>

                  <ul className="space-y-2 text-sm text-left">
                    {history.map((ref, i) => (
                      <li key={i} className="break-words whitespace-pre-wrap">
                        - {ref}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl">
                <p className="text-sm text-white/60">
                  Saved history is available on Pro.
                </p>
                <button
                  onClick={goToPricing}
                  className="mt-3 bg-blue-500 px-4 py-2 rounded-xl hover:opacity-90 transition"
                >
                  Upgrade
                </button>
              </div>
            )}

            <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-sm text-white/60 mb-2">Feedback</p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full h-24 p-3 rounded-xl bg-black/40 border border-white/10 mb-3"
                placeholder="Write feedback..."
              />

              <button
                onClick={sendComment}
                className="w-full bg-green-500 py-2 rounded-xl hover:opacity-90 transition"
              >
                Send Feedback
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}