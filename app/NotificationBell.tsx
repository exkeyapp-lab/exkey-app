"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

// 站內通知鈴：放在媒合頁與會員專區的頂列
// 新通知進來時叮一聲（瀏覽器規定要等使用者碰過畫面才准出聲，所以沒碰過就先記著，碰到就響）

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

const SEEN_KEY = "exkey_notif_seen";
const POLL_MS = 60 * 1000;

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids).slice(-200)));
  } catch {}
}

// 兩個短音，用瀏覽器內建的合成器畫出來，不用音檔
function playDing(): boolean {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = w.AudioContext || w.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    if (ctx.state === "suspended") {
      ctx.close();
      return false;
    }
    const now = ctx.currentTime;
    [[880, 0], [1320, 0.12]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.32);
    });
    setTimeout(() => ctx.close(), 800);
    return true;
  } catch {
    return false;
  }
}

function timeText(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return iso.slice(0, 10);
}

export default function NotificationBell({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pendingDing = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    const { data, error } = await supabase.rpc("my_notifications");
    if (error || !data || typeof data !== "object") return;
    const d = data as { unread: number; items: NotificationItem[] };
    const list = Array.isArray(d.items) ? d.items : [];
    setItems(list);
    setUnread(typeof d.unread === "number" ? d.unread : 0);
    setReady(true);

    // 沒看過的未讀通知才叮，叮過就記下來，重新整理不會再響
    const seen = readSeen();
    const fresh = list.filter((n) => !n.read && !seen.has(n.id));
    if (fresh.length > 0) {
      fresh.forEach((n) => seen.add(n.id));
      writeSeen(seen);
      if (!playDing()) pendingDing.current = true;
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);

    // 瀏覽器不准在使用者碰畫面前出聲：第一次點擊或觸碰時補響
    const onGesture = () => {
      if (pendingDing.current) {
        pendingDing.current = false;
        playDing();
      }
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);

    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);

    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      await supabase.rpc("mark_notifications_read");
    }
  }

  function go(n: NotificationItem) {
    setOpen(false);
    router.push(n.kind === "contact" ? "/member" : "/discover");
  }

  if (!ready) return null;

  const btnCls =
    tone === "dark"
      ? "text-white/85 border border-white/25"
      : "text-purple-600 border border-purple-100 bg-white";

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="通知"
        className={`relative w-9 h-9 rounded-full flex items-center justify-center ${btnCls}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-600 text-purple-900 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[340px] bg-white rounded-2xl border border-purple-100 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-bold text-purple-900">通知</div>
            <button onClick={() => setOpen(false)} className="text-xs text-gray-400">
              關閉
            </button>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-400">目前沒有通知</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className={`w-full text-left px-4 py-3 ${n.read ? "bg-white" : "bg-purple-50/70"}`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        n.kind === "contact" ? "bg-gold-600" : "bg-purple-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 leading-snug">{n.title}</div>
                      {n.body && <div className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</div>}
                      <div className="text-[10px] text-gray-400 mt-1">{timeText(n.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
