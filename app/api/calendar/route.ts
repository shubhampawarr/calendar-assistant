import { NextResponse } from "next/server";
import { google } from "googleapis";
import * as chrono from "chrono-node";

function formatLocalDateTime(date: Date) {
  const pad = (num: number) => String(num).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

async function getCalendarIdByName(calendar: any, calendarName?: string) {
  if (!calendarName || calendarName === "primary") return "primary";

  const list = await calendar.calendarList.list();
  const calendars = list.data.items || [];

  const found = calendars.find(
    (cal: any) => cal.summary?.toLowerCase() === calendarName.toLowerCase()
  );

  return found?.id || "primary";
}

export async function GET() {
  try {
    const calendar = getCalendarClient();

    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    const calendarList = await calendar.calendarList.list();
    const allCalendars = calendarList.data.items || [];

    const allEvents = await Promise.all(
      allCalendars.map(async (cal: any) => {
        if (!cal.id) return [];

        const events = await calendar.events.list({
          calendarId: cal.id,
          timeMin: now.toISOString(),
          timeMax: sevenDaysLater.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });

        return (events.data.items || []).map((event: any) => ({
          ...event,
          calendarId: cal.id,
          calendarName: cal.summary,
          calendarColor: cal.backgroundColor,
        }));
      })
    );

    return NextResponse.json({
      events: allEvents.flat().sort((a: any, b: any) => {
        const aStart = a.start?.dateTime || a.start?.date || "";
        const bStart = b.start?.dateTime || b.start?.date || "";
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { command, pin, calendarName } = await req.json();

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

    const calendar = getCalendarClient();
    const targetCalendarId = await getCalendarIdByName(calendar, calendarName);

    const event = await calendar.events.insert({
      calendarId: targetCalendarId,
      requestBody: {
        summary: title,
        start: {
          dateTime: formatLocalDateTime(startDate),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: formatLocalDateTime(endDate),
          timeZone: "Asia/Kolkata",
        },
      },
    });

    return NextResponse.json({
      success: true,
      title,
      link: event.data.htmlLink,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { pin, eventId, calendarId, command } = await req.json();

    if (pin !== process.env.APP_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const parsed = chrono.parse(command, new Date(), { forwardDate: true });

    if (!parsed.length) {
      return NextResponse.json(
        { error: "Could not understand updated date/time" },
        { status: 400 }
      );
    }

    const result = parsed[0];
    const startDate = result.start.date();
    const endDate = result.end
      ? result.end.date()
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    const title =
      command.replace(/update/i, "").replace(result.text, "").trim() ||
      "Updated Event";

    const calendar = getCalendarClient();

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: title,
        start: {
          dateTime: formatLocalDateTime(startDate),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: formatLocalDateTime(endDate),
          timeZone: "Asia/Kolkata",
        },
      },
    });

    return NextResponse.json({ success: true, title });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { pin, eventId, calendarId } = await req.json();

    if (pin !== process.env.APP_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const calendar = getCalendarClient();

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete event" },
      { status: 500 }
    );
  }
}