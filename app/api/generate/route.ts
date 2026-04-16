import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!;

// ======================
// SAFE TAVILY (WITH TIMEOUT)
// ======================
async function tavilySearch(query: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s max

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

    const isPro = has({ feature: "unlimited_generations" });

    if (!isPro) {
      return NextResponse.json(
        { result: "Free limit reached. Upgrade to Pro for unlimited access." },
        { status: 403 }
      );
    }

    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { result: "No text provided." },
        { status: 400 }
      );
    }

    // ======================
    // 1. EXTRACT KEYWORDS
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

    // ======================
    // 2. TAVILY SEARCH (SAFE PARALLEL)
    // ======================
    const resultsArrays = await Promise.all(
      queries.map((q) => tavilySearch(q))
    );

    const allResults = resultsArrays.flat();

    // ======================
    // 3. FALLBACK
    // ======================
    const sourceData =
      allResults.length > 0
        ? allResults
        : [{ title: "No sources found", url: "" }];

    // ======================
    // 4. FORMAT APA
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

SOURCES:
${JSON.stringify(sourceData)}
      `,
    });

    // ======================
    // 5. SAFE OUTPUT PARSING
    // ======================
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

    return NextResponse.json({
      result: output || "No references generated.",
      sources: allResults.map((r: any) => ({
        title: r.title,
        url: r.url,
      })),
    });
  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json(
      { result: "Server error generating references." },
      { status: 500 }
    );
  }
}