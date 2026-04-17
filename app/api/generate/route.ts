import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!;
const FREE_DAILY_LIMIT = 3;

// Temporary in-memory usage store
// key example: "user_123:2026-04-17" => 2
// NOTE: This resets when the server restarts and is not reliable for production/serverless.
const usageStore = new Map<string, number>();

function getTodayKey(userId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${userId}:${today}`;
}

// ======================
// SAFE TAVILY (WITH TIMEOUT)
// ======================
async function tavilySearch(query: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.warn("Tavily failed:", err);
    return [];
  }
}

// ======================
// MAIN ROUTE
// ======================
export async function POST(req: Request) {
  try {
    // ======================
    // 0. CLERK AUTH CHECK
    // ======================
    const { userId, has } = await auth();

    if (!userId) {
      return NextResponse.json(
        { result: "You must be signed in to use RefAI." },
        { status: 401 }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { result: "No text provided." },
        { status: 400 }
      );
    }

    // ======================
    // 1. PLAN / LIMIT CHECK
    // ======================
    const isPro = has({ feature: "unlimited_generations" });

    const usageKey = getTodayKey(userId);
    const currentUsage = usageStore.get(usageKey) ?? 0;

    if (!isPro && currentUsage >= FREE_DAILY_LIMIT) {
      return NextResponse.json(
        { result: "Free limit reached. Upgrade to Pro for unlimited access." },
        { status: 403 }
      );
    }

    // ======================
    // 2. EXTRACT KEYWORDS
    // ======================
    const queryRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
Extract 3 academic search keywords from this text.
Return comma-separated only.

TEXT:
${text}
      `,
    });

    let queryText = "";

    for (const item of queryRes.output || []) {
      if (item.type === "message") {
        for (const c of item.content || []) {
          if (c.type === "output_text") {
            queryText += c.text;
          }
        }
      }
    }

    const queries = queryText
      .split(",")
      .map((q) => q.trim())
      .filter(Boolean);

    // fallback if keyword extraction returns nothing
    const safeQueries = queries.length > 0 ? queries : [text.trim()];

    // ======================
    // 3. TAVILY SEARCH
    // ======================
    const resultsArrays = await Promise.all(
      safeQueries.map((q) => tavilySearch(q))
    );

    const allResults = resultsArrays.flat();

    // ======================
    // 4. FALLBACK SOURCE DATA
    // ======================
    const sourceData =
      allResults.length > 0
        ? allResults
        : [{ title: "No sources found", url: "" }];

    // ======================
    // 5. FORMAT APA
    // ======================
    const formatRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
You are an APA 7 reference generator.

RULES:
- Use ONLY provided sources
- Format APA 7 strictly
- One reference per line
- Include URL if available
- No invented sources
- If the source data is incomplete, do your best with ONLY the available fields
- Do not add explanations

SOURCES:
${JSON.stringify(sourceData)}
      `,
    });

    let output = "";

    for (const item of formatRes.output || []) {
      if (item.type === "message") {
        for (const c of item.content || []) {
          if (c.type === "output_text") {
            output += c.text;
          }
        }
      }
    }

    // ======================
    // 6. INCREMENT FREE USAGE ONLY AFTER SUCCESS
    // ======================
    if (!isPro) {
      usageStore.set(usageKey, currentUsage + 1);
    }

    return NextResponse.json({
      result: output || "No references generated.",
      sources: allResults.map((r: any) => ({
        title: r.title,
        url: r.url,
      })),
      usage: {
        isPro,
        usedToday: isPro ? null : currentUsage + 1,
        dailyLimit: isPro ? null : FREE_DAILY_LIMIT,
        remaining: isPro ? null : Math.max(0, FREE_DAILY_LIMIT - (currentUsage + 1)),
      },
    });
  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json(
      { result: "Server error generating references." },
      { status: 500 }
    );
  }
}