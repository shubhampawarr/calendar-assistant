"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarEvent = {
  id: string;
  summary: string;
  calendarId?: string;
  calendarName?: string;
  calendarColor?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

type Weather = {
  temp: number;
  wind: number;
};

type SpeechRecognitionType = typeof window & {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
};

function formatTime(value?: string) {
  if (!value) return "All day";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export default function Home() {
  const [pin, setPin] = useState("");
  const [command, setCommand] = useState("");
  const [calendarName, setCalendarName] = useState("primary");
  const [result, setResult] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editCommand, setEditCommand] = useState("");

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date;
    });
  }, []);

  const todayEvents = events.filter((event) => {
    const start = event.start.dateTime || event.start.date;
    return start ? isSameDay(new Date(start), now) : false;
  });

  async function fetchEvents() {
    const res = await fetch("/api/calendar");
    const data = await res.json();
    setEvents(data.events || []);
  }

  async function fetchWeather() {
    const lat = 19.076;
    const lon = 72.8777;

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`
    );

    const data = await res.json();

    setWeather({
      temp: Math.round(data.current.temperature_2m),
      wind: Math.round(data.current.wind_speed_10m),
    });
  }

  useEffect(() => {
    fetchEvents();
    fetchWeather();

    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    const refreshTimer = setInterval(fetchEvents, 60000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(refreshTimer);
    };
  }, []);

  async function addEvent() {
    setLoading(true);
    setResult("");

    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin, command, calendarName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setResult(`Error: ${data.error}`);
    } else {
      setResult(`Created: ${data.title}`);
      setCommand("");
      fetchEvents();
    }

    setLoading(false);
  }

  async function deleteEvent(event: CalendarEvent) {
    if (!pin) {
      setResult("Error: Enter PIN before deleting.");
      return;
    }

    if (!confirm(`Delete "${event.summary}"?`)) return;

    const res = await fetch("/api/calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        eventId: event.id,
        calendarId: event.calendarId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setResult(`Error: ${data.error}`);
    } else {
      setResult(`Deleted: ${event.summary}`);
      fetchEvents();
    }
  }

  async function updateEvent() {
    if (!editingEvent) return;

    if (!pin) {
      setResult("Error: Enter PIN before updating.");
      return;
    }

    const res = await fetch("/api/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        eventId: editingEvent.id,
        calendarId: editingEvent.calendarId,
        command: editCommand,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setResult(`Error: ${data.error}`);
    } else {
      setResult(`Updated: ${data.title}`);
      setEditingEvent(null);
      setEditCommand("");
      fetchEvents();
    }
  }

  function startVoiceCommand() {
    const browserWindow = window as SpeechRecognitionType;
    const SpeechRecognition =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setResult("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    setListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
      setResult(`Voice captured: ${transcript}`);
      setListening(false);
    };

    recognition.onerror = () => {
      setResult("Voice command failed.");
      setListening(false);
    };

    recognition.onend = () => setListening(false);
  }

  return (
    <main className="min-h-screen bg-[#10130f] text-white relative overflow-hidden px-5 py-6">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=1800&auto=format&fit=crop')] bg-cover bg-center opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#10130f]/60 to-[#10130f]" />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-6">
        <header className="grid gap-4 md:grid-cols-[1fr_1.6fr_1fr] md:items-start">
          <div>
            <h1 className="text-5xl font-light tracking-tight">
              {now.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </h1>
            <p className="mt-1 text-white/70">
              {now.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/45 p-5 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Today</h2>
              <span className="text-xs text-white/45">
                {todayEvents.length} events
              </span>
            </div>

            <div className="space-y-2">
              {todayEvents.length === 0 ? (
                <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/50">
                  No events scheduled for today.
                </p>
              ) : (
                todayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl bg-white/7 px-4 py-3 border border-white/10"
                  >
                    <p className="text-xs text-white/50">
                      {formatTime(event.start.dateTime)} –{" "}
                      {formatTime(event.end.dateTime)}
                    </p>
                    <p className="font-medium">{event.summary}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {event.calendarName}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="justify-self-start rounded-2xl bg-black/50 px-5 py-4 backdrop-blur-md border border-white/10 text-left md:justify-self-end md:text-right">
            <p className="text-sm text-white/60">Weather</p>
            <p className="text-3xl font-light">
              {weather ? `${weather.temp}°C` : "--"}
            </p>
            <p className="text-xs text-white/50">
              Wind {weather ? weather.wind : "--"} km/h
            </p>
          </div>
        </header>

        <section className="flex-1 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-md">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-medium">7-Day Schedule</h2>
            <button
              onClick={fetchEvents}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              Refresh
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {days.map((day) => {
              const dayEvents = events.filter((event) => {
                const start = event.start.dateTime || event.start.date;
                return start ? isSameDay(new Date(start), day) : false;
              });

              const isToday = isSameDay(day, now);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[260px] rounded-2xl p-4 border ${
                    isToday
                      ? "bg-white/15 border-white/25"
                      : "bg-black/45 border-white/10"
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="text-4xl font-light">{day.getDate()}</p>
                      <p className="text-sm text-white/60">
                        {day.toLocaleDateString("en-IN", {
                          weekday: "long",
                        })}
                      </p>
                    </div>

                    {isToday && (
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase text-black">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {dayEvents.length === 0 ? (
                      <p className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/45">
                        No events
                      </p>
                    ) : (
                      dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg bg-black/55 px-3 py-2"
                          style={{
                            borderLeft: `4px solid ${
                              event.calendarColor || "#34d399"
                            }`,
                          }}
                        >
                          <p className="text-xs text-white/50">
                            {formatTime(event.start.dateTime)} –{" "}
                            {formatTime(event.end.dateTime)}
                          </p>
                          <p className="text-sm font-medium">
                            {event.summary || "Untitled"}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/35">
                            {event.calendarName}
                          </p>

                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => {
                                setEditingEvent(event);
                                setEditCommand(
                                  `${event.summary} tomorrow 8am to 9am`
                                );
                              }}
                              className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteEvent(event)}
                              className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur-md">
          <div className="grid gap-3 md:grid-cols-[120px_150px_1fr_120px_140px]">
            <input
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none placeholder:text-white/35"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
            />

            <select
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
            >
              <option className="bg-black" value="primary">
                Primary
              </option>
              <option className="bg-black" value="Work">
                Work
              </option>
              <option className="bg-black" value="Learning">
                Learning
              </option>
              <option className="bg-black" value="Health">
                Health
              </option>
              <option className="bg-black" value="Personal">
                Personal
              </option>
            </select>

            <input
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none placeholder:text-white/35"
              placeholder="add workout tomorrow 8am to 9am"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />

            <button
              onClick={startVoiceCommand}
              disabled={listening}
              className="rounded-xl bg-white/10 px-4 py-3 font-medium hover:bg-white/20 disabled:opacity-50"
            >
              {listening ? "Listening..." : "Voice"}
            </button>

            <button
              onClick={addEvent}
              disabled={loading || !pin || !command}
              className="rounded-xl bg-white px-4 py-3 font-semibold text-black hover:bg-white/85 disabled:opacity-40"
            >
              {loading ? "Adding..." : "Add Task"}
            </button>
          </div>

          {result && <p className="mt-3 text-sm text-white/60">{result}</p>}
        </section>
      </section>

      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151812] p-5 shadow-2xl">
            <h2 className="text-xl font-medium">Edit Event</h2>
            <p className="mt-1 text-sm text-white/50">
              Current: {editingEvent.summary}
            </p>

            <input
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
              value={editCommand}
              onChange={(e) => setEditCommand(e.target.value)}
              placeholder="example: workout tomorrow 8am to 9am"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={updateEvent}
                className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-black"
              >
                Save
              </button>

              <button
                onClick={() => {
                  setEditingEvent(null);
                  setEditCommand("");
                }}
                className="flex-1 rounded-xl bg-white/10 px-4 py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}