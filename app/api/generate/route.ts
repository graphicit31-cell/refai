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

type Usage = {
  date: string;
  count: number;
};

function getToday() {
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
        max_results: 5,
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
  } catch (error) {
    console.error("Tavily search failed:", error);
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
        { result: "You must be signed in." },
        { status: 401 }
      );
    }

    const isPro = has({ feature: "unlimited_generations" });

    const body = await req.json().catch(() => null);
    const text = body?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { result: "No text provided." },
        { status: 400 }
      );
    }

    const today = getToday();
    const clerk = await clerkClient();

    let currentUsage = 0;

    if (!isPro) {
      const user = await clerk.users.getUser(userId);
      const raw = user.privateMetadata?.refaiUsage as Usage | undefined;

      if (
        raw &&
        typeof raw.date === "string" &&
        typeof raw.count === "number"
      ) {
        currentUsage = raw.date === today ? raw.count : 0;
      }

      if (currentUsage >= FREE_DAILY_LIMIT) {
        return NextResponse.json(
          {
            result: "Free limit reached.",
            usage: {
              isPro: false,
              usedToday: currentUsage,
              dailyLimit: FREE_DAILY_LIMIT,
              remaining: 0,
            },
            sources: [],
          },
          { status: 403 }
        );
      }
    }

    const keywordRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
Extract 3 academic search keywords from this text.
Return comma-separated only.

TEXT:
${text}
      `,
    });

    const keywordText = extractOutputText(keywordRes);

    const queries = keywordText
      .split(",")
      .map((q) => q.trim())
      .filter(Boolean);

    const safeQueries = queries.length > 0 ? queries : [text.trim()];

    const searchResultsArrays = await Promise.all(
      safeQueries.map((q) => tavilySearch(q))
    );

    const allResults = searchResultsArrays
      .flat()
      .filter((r: any) => r && (r.title || r.url));

    const uniqueSources = Array.from(
      new Map(
        allResults.map((r: any) => [
          r.url || `${r.title}-${Math.random()}`,
          {
            title: r.title ?? "Untitled source",
            url: r.url ?? "",
          },
        ])
      ).values()
    );

    const sourceData =
      uniqueSources.length > 0
        ? uniqueSources
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

    let usageData = {
      isPro: Boolean(isPro),
      usedToday: null as number | null,
      dailyLimit: null as number | null,
      remaining: null as number | null,
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

      usageData = {
        isPro: false,
        usedToday: nextUsage,
        dailyLimit: FREE_DAILY_LIMIT,
        remaining: FREE_DAILY_LIMIT - nextUsage,
      };
    }

    return NextResponse.json({
      result: output || "No references generated.",
      usage: usageData,
      sources: uniqueSources,
    });
  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json(
      { result: "Server error." },
      { status: 500 }
    );
  }
}