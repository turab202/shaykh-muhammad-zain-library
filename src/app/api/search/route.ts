import { type NextRequest, NextResponse } from "next/server";
import { searchLibrary } from "@/server/search/queries";
import type { Locale } from "@/types/i18n";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") ?? "";
  const locale = (searchParams.get("locale") ?? "en") as Locale;

  if (!query.trim()) {
    return NextResponse.json({ lessons: [], series: [], books: [], categories: [], totalCount: 0 });
  }

  try {
    const results = await searchLibrary(query, locale);
    return NextResponse.json(results);
  } catch (err) {
    console.error("[search] error:", err);
    return NextResponse.json(
      { lessons: [], series: [], books: [], categories: [], totalCount: 0, error: "Search unavailable" },
      { status: 500 }
    );
  }
}
