import { NextResponse } from "next/server";
import * as chrono from "chrono-node";

export async function POST(req: Request) {
  try {
    const { command, pin } = await req.json();

    if (pin !== process.env.APP_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const parsed = chrono.parse(command, new Date(), { forwardDate: true });

    if (!parsed.length) {
      return NextResponse.json(
        { error: "Could not understand date/time" },
        { status: 400 }
      );
    }

    const result = parsed[0];
    const startDate = result.start.date();
    const endDate = result.end
      ? result.end.date()
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    const title =
      command.replace(/add/i, "").replace(result.text, "").trim() ||
      "Calendar Event";

    return NextResponse.json({
      success: true,
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      spokenSummary: `${title}, from ${startDate.toLocaleString("en-IN", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "long",
      })} to ${endDate.toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Preview failed" },
      { status: 500 }
    );
  }
}