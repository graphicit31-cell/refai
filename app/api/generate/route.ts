import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!;
const FREE_DAILY_LIMIT = 3;

type RefAiUsageMetadata = {
  date: string;
  count: number;
};

function getTodayJST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("Tavily error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    console.warn("Tavily failed:", err);
    return [];
  }
}

function extractOutputText(response: any): string {
  let output = "";

  for (const item of response?.output || []) {
    if (item?.type === "message") {
      for (const c of item?.content || []) {
        if (c?.type === "output_text" && typeof c.text === "string") {
          output += c.text;
        }
      }
    }
  }

  return output.trim();
}

export async function POST(req: Request) {
  try {
    const { userId, has } = await auth();

    if (!userId) {
      return NextResponse.json(
        { result: "You must be signed in to use RefAI." },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const resetUsage = url.searchParams.get("resetUsage") === "true";

    const body = await req.json().catch(() => null);
    const text = body?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { result: "No text provided." },
        { status: 400 }
      );
    }

    const isPro = has({ feature: "unlimited_generations" });
    const today = getTodayJST();
    const clerk = await clerkClient();

    let currentUsage = 0;
    let rawUsage: RefAiUsageMetadata | undefined;

    if (!isPro) {
      if (resetUsage) {
        await clerk.users.updateUserMetadata(userId, {
          privateMetadata: {
            refaiUsage: {
              date: today,
              count: 0,
            },
          },
        });
      }

      const user = await clerk.users.getUser(userId);

   const rawUsage = user.privateMetadata?.refaiUsage as
  | RefAiUsageMetadata
  | undefined;

const isValidUsage =
  !!rawUsage &&
  typeof rawUsage.date === "string" &&
  typeof rawUsage.count === "number" &&
  Number.isFinite(rawUsage.count) &&
  rawUsage.count >= 0;

      if (isValidUsage && rawUsage.date === today) {
        currentUsage = rawUsage.count;
      } else {
        currentUsage = 0;
      }

      console.log("RefAI debug usage:", {
        userId,
        isPro,
        today,
        rawUsage,
        currentUsage,
        resetUsage,
      });
    }

    const queryRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
Extract 3 academic search keywords from this text.
Return comma-separated only.
Keep them short and useful for academic web search.

TEXT:
${text}
      `,
    });

    const queryText = extractOutputText(queryRes);

    const queries = queryText
      .split(",")
      .map((q) => q.trim())
      .filter(Boolean);

    const safeQueries = queries.length > 0 ? queries : [text.trim()];

    const resultsArrays = await Promise.all(
      safeQueries.map((q) => tavilySearch(q))
    );

    const allResults = resultsArrays
      .flat()
      .filter((r: any) => r && (r.title || r.url));

    const sourceData =
      allResults.length > 0
        ? allResults
        : [{ title: "No sources found", url: "" }];

    const formatRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
You are an APA 7 reference generator.

RULES:
- Use ONLY the provided sources
- Format APA 7 as accurately as possible
- One reference per line
- Include URL only if available
- Do not invent missing details
- If source data is incomplete, use only available fields
- Do not add explanations, headings, bullets, or notes

SOURCES:
${JSON.stringify(sourceData)}
      `,
    });

    const output = extractOutputText(formatRes);

    let usageResponse = {
      isPro: Boolean(isPro),
      usedToday: null as number | null,
      dailyLimit: null as number | null,
      remaining: null as number | null,
      debug: {
        today,
        rawUsage: rawUsage ?? null,
      },
    };

    if (!isPro) {
      const nextUsage = currentUsage + 1;

      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: {
          refaiUsage: {
            date: today,
            count: nextUsage,
          },
        },
      });

      usageResponse = {
        isPro: false,
        usedToday: nextUsage,
        dailyLimit: FREE_DAILY_LIMIT,
        remaining: Math.max(0, FREE_DAILY_LIMIT - nextUsage),
        debug: {
          today,
          rawUsage: rawUsage ?? null,
        },
      };
    }

    return NextResponse.json(
      {
        result: output || "No references generated.",
        sources: allResults.map((r: any) => ({
          title: r.title ?? "",
          url: r.url ?? "",
        })),
        usage: usageResponse,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json(
      { result: "Server error generating references." },
      { status: 500 }
    );
  }
}