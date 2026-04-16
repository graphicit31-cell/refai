"use client";

import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import Logo from "@/components/Logo";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";

export default function Page() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFinal, setIsFinal] = useState(false);

  // COMMENT SECTION
  const [comment, setComment] = useState("");

  // SUBSCRIPTION / LIMIT SECTION
  const FREE_DAILY_LIMIT = 3;
  const [usageCount, setUsageCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  const { isLoaded, isSignedIn, has } = useAuth();
  const { user } = useUser();

  console.log("isLoaded:", isLoaded);
  console.log("isSignedIn:", isSignedIn);
  console.log(
    "unlimited_generations:",
    isLoaded && isSignedIn ? has({ feature: "unlimited_generations" }) : false
  );
  console.log(
    "pdf_export:",
    isLoaded && isSignedIn ? has({ feature: "pdf_export" }) : false
  );
  console.log(
    "history_access:",
    isLoaded && isSignedIn ? has({ feature: "history_access" }) : false
  );

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

  // FEATURE CHECKS
  const canUseUnlimited =
    isLoaded && isSignedIn ? has({ feature: "unlimited_generations" }) : false;

  const canUsePdfExport =
    isLoaded && isSignedIn ? has({ feature: "pdf_export" }) : false;

  const canUseHistory =
    isLoaded && isSignedIn ? has({ feature: "history_access" }) : false;

  const goToPricing = () => {
    window.location.href = "/pricing";
  };

  // LOAD HISTORY
  useEffect(() => {
    const saved = localStorage.getItem("refai-history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // LOAD / RESET DAILY USAGE
  useEffect(() => {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem("refai-usage-date");
    const savedCount = localStorage.getItem("refai-usage-count");

    if (savedDate !== today) {
      localStorage.setItem("refai-usage-date", today);
      localStorage.setItem("refai-usage-count", "0");
      setUsageCount(0);
    } else {
      setUsageCount(Number(savedCount || 0));
    }
  }, []);

  // SCROLL CONTROL
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // ANIMATION
  useEffect(() => {
    const animate = () => {
      scroll.current += (target.current - scroll.current) * 0.08;

      const w = window.innerWidth;
      const h = window.innerHeight;

      blobs.current = blobs.current.map((b) => {
        const x = b.x + b.dx;
        const y = b.y + b.dy;

        const limitX = w / 2 - 150;
        const limitY = h / 2 - 150;

        if (x > limitX || x < -limitX) b.dx *= -1;
        if (y > limitY || y < -limitY) b.dy *= -1;

        return { ...b, x, y };
      });

      setIsFinal(scroll.current > window.innerHeight * 1.5);

      force((v) => v + 1);
      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  const y = scroll.current;

  const incrementUsage = () => {
    const next = usageCount + 1;
    setUsageCount(next);
    localStorage.setItem("refai-usage-count", String(next));
  };

  // GENERATE
  const handleGenerate = async () => {
    if (!text.trim()) return;

    setLimitReached(false);

    if (!canUseUnlimited && usageCount >= FREE_DAILY_LIMIT) {
      setLimitReached(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setLimitReached(true);
        }
        return;
      }

      const newRefs = data.result
        .split("\n")
        .map((r: string) => r.replace(/^[-–—]\s*/, "").trim())
        .filter(Boolean);

      const mergedResults = [...results, ...newRefs].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      setResults(mergedResults);

      if (canUseHistory) {
        const uniqueHistory = Array.from(new Set([...history, ...newRefs])).sort(
          (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        setHistory(uniqueHistory);
        localStorage.setItem("refai-history", JSON.stringify(uniqueHistory));
      }

      if (!canUseUnlimited) {
        incrementUsage();
      }
    } catch (error) {
      console.error("Generate failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // PDF
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

  // CLEAR FUNCTIONS
  const clearAll = () => setResults([]);
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("refai-history");
  };

  // COMMENT → Gmail
  const sendComment = () => {
    const subject = encodeURIComponent("RefAI Feedback");
    const body = encodeURIComponent(comment);

    window.open(`mailto:yourgmail@gmail.com?subject=${subject}&body=${body}`);

    setComment("");
  };

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* TOP BAR */}
      <div
        className={`fixed top-6 left-6 right-6 z-[999] flex items-center justify-between transition-opacity duration-500 ${
          isFinal ? "opacity-0" : "opacity-100"
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

          <Show when="signed-out">
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
          </Show>

          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-black" />

      {/* BLOBS */}
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

      {/* SCROLL */}
      <div
        ref={worldRef}
        className="absolute inset-0 will-change-transform"
        style={{ transform: `translateY(${-y}px)` }}
      >
        {/* HERO */}
        <section className="h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-6xl font-bold">RefAI</h1>
            <p className="text-white/60 mt-4">
              AI-powered APA reference generator
            </p>
          </div>
        </section>

        {/* INFO */}
        <section className="h-screen flex items-center justify-center">
          <div className="max-w-2xl p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl text-center">
            <h2 className="text-4xl font-bold mb-6">
              A new way to write academic references
            </h2>
            <p className="text-white/60">
              RefAI removes formatting friction so you can focus on ideas.
            </p>
          </div>
        </section>

        {/* FINAL */}
        <section className="min-h-screen flex items-start justify-center bg-black py-16">
          <div className="w-full max-w-4xl px-6 text-center">
            {/* LOGO */}
            <div className="mb-8">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                RefAI
              </div>
              <p className="text-white/50 text-sm">APA Reference Generator</p>
            </div>

            {/* PLAN / USAGE INFO */}
            <div className="mb-4 text-sm text-white/60">
              {canUseUnlimited
                ? "Pro plan active — unlimited generations"
                : `Free plan — ${Math.max(
                    0,
                    FREE_DAILY_LIMIT - usageCount
                  )} generation(s) left today`}
            </div>

            {/* DEBUG (temporary) */}
            <div className="text-xs text-white/40 mb-4">
              loaded: {String(isLoaded)} | signedIn: {String(isSignedIn)} | pro:{" "}
              {String(canUseUnlimited)} | pdf: {String(canUsePdfExport)} | history:{" "}
              {String(canUseHistory)}
            </div>

            {/* INPUT */}
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-40 p-4 rounded-2xl bg-white/5 border border-white/10 mb-4"
              placeholder="Paste your text here..."
            />

            {/* BUTTON */}
            <button
              onClick={handleGenerate}
              className="w-full bg-blue-500 py-3 rounded-2xl"
            >
              {loading ? "Generating..." : "Generate References"}
            </button>

            {/* LIMIT MESSAGE */}
            {limitReached && (
              <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-sm text-white/70">
                  You’ve reached the free limit. Upgrade to Pro for unlimited
                  access.
                </p>
                <button
                  onClick={goToPricing}
                  className="mt-3 bg-white text-black px-4 py-2 rounded-xl"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

            {/* GENERATED */}
            {results.length > 0 && (
              <div
                ref={resultRef}
                className="mt-6 p-4 bg-white/5 border border-white/10 rounded-2xl max-h-60 overflow-y-auto overflow-x-hidden"
              >
                <div className="flex justify-between mb-3">
                  <p className="text-sm text-white/60">Generated</p>
                  <button
                    onClick={clearAll}
                    className="text-xs border px-2 py-1"
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
                  className={`mt-4 w-full py-2 rounded-xl ${
                    canUsePdfExport
                      ? "bg-cyan-500"
                      : "bg-white/10 border border-white/10"
                  }`}
                >
                  {canUsePdfExport ? "Export PDF" : "Upgrade to export PDF"}
                </button>
              </div>
            )}

            {/* HISTORY */}
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
                      className="text-xs border px-2 py-1"
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
                  className="mt-3 bg-blue-500 px-4 py-2 rounded-xl"
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* COMMENT */}
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
                className="w-full bg-green-500 py-2 rounded-xl"
              >
                Send via Gmail
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}