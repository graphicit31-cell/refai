import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    console.log("🚀 ROUTE HIT NEW VERSION");

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { result: "You must be signed in to use RefAI." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const text = body?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { result: "No text provided." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        result: "ROUTE HIT NEW VERSION",
        usage: {
          isPro: false,
          usedToday: 0,
          dailyLimit: 3,
          remaining: 3,
        },
        debugBypass: true,
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