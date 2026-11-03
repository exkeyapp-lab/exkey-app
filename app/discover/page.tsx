"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import NotificationBell from "../NotificationBell";
import { levelLabel, PUBLIC_PROFILE_COLUMNS, ENTRY_COLUMNS, type PublicProfile, type NetworkEntry } from "@/lib/types";

// ==================== 媒合計分 ====================
// 「不限」規則：任何一邊是不限（空陣列、層級 0）就視為符合，拿該維度滿分。
// 四個維度滿分合計 80：產業 20、地區 15、部門 15、層級 30。

interface Cond {
  industries: string[];
  regions: string[];
  departments: string[];
  level: number;
}
const FULL_SCORE = 80;

function condOf(e: NetworkEntry): Cond {
  return {
    industries: e.industries || [],
    regions: e.regions || [],
    departments: e.departments || [],
    level: e.level || 0,
  };
}

// 單一維度：有一邊不限就滿分；都有填就看有沒有交集
function dimensionScore(seekList: string[], offerList: string[], weight: number): number {
  if (seekList.length === 0 || offerList.length === 0) return weight;
  return offerList.some((v) => seekList.includes(v)) ? weight : 0;
}

// 層級：有一邊不限就滿分；都有填時達到門檻滿分，差一階仍給部分分數
function levelScore(seekLevel: number, offerLevel: number): number {
  if (!seekLevel || !offerLevel) return 30;
  const gap = offerLevel - seekLevel;
  if (gap >= 0) return 30;
  if (gap === -1) return 18;
  if (gap === -2) return 10;
  return 5;
}

function pairScore(seek: Cond, offer: Cond): number {
  return (
    dimensionScore(seek.industries, offer.industries, 20) +
    dimensionScore(seek.regions, offer.regions, 15) +
    dimensionScore(seek.departments, offer.departments, 15) +
    levelScore(seek.level, offer.level)
  );
}

// 列出實際對上的維度（不限也算對上）
function matchReasons(seek: Cond, offer: Cond): string[] {
  const out: string[] = [];
  if (dimensionScore(seek.industries, offer.industries, 1) > 0) out.push("產業");
  if (dimensionScore(seek.regions, offer.regions, 1) > 0) out.push("地區");
  if (dimensionScore(seek.departments, offer.departments, 1) > 0) out.push("部門");
  const ls = levelScore(seek.level, offer.level);
  if (ls === 30) out.push("層級");
  else if (ls === 18) out.push("層級接近");
  return out;
}

// 在「我的案件 × 對方案件」所有組合裡挑分數最高的一組
function bestPair(
  seeks: NetworkEntry[],
  offers: NetworkEntry[]
): { score: number; seek: NetworkEntry | null; offer: NetworkEntry | null } {
  let best = { score: -1, seek: null as NetworkEntry | null, offer: null as NetworkEntry | null };
  for (const s of seeks) {
    for (const o of offers) {
      const sc = pairScore(condOf(s), condOf(o));
      if (sc > best.score) best = { score: sc, seek: s, offer: o };
    }
  }
  return best;
}

// 對方填不限的維度，畫面上顯示「我這邊的值」，對方看起來就像是正好符合我的條件
function shownList(theirs: string[], mine: string[]): string[] {
  return theirs.length > 0 ? theirs : mine;
}
function shownLevel(theirs: number, mine: number): number {
  return theirs > 0 ? theirs : mine;
}

type Recommendation = PublicProfile & {
  score: number;
  mutual: boolean;
  percent: number;
  reasons: string[];
  // 對方「介紹人脈」那筆（配到我的找人脈），以及我用來配的那筆
  theirOffer: NetworkEntry | null;
  mySeek: NetworkEntry | null;
  // 對方「找人脈」那筆（配到我的介紹人脈；我沒填介紹人脈時取對方第一筆），以及我那筆
  theirSeek: NetworkEntry | null;
  myOffer: NetworkEntry | null;
};

// 每張卡片的解鎖狀態
type UnlockState =
  | { stage: "idle" }
  | { stage: "confirm" }
  | { stage: "loading" }
  | { stage: "revealed"; lineId: string }
  | { stage: "nopoints" }
  | { stage: "error" };

const UNLOCK_COST = 10;
const SITE_URL = "https://exkey-app.vercel.app";
const REF_BANNER_KEY = "exkey_ref_banner_seen";

// 分享訊息：先講清楚是誰、這是什麼、誰經營，最後才是推薦碼和連結，對方才不會當詐騙
function buildInviteMessage(senderName: string, code: string, link: string): string {
  return [
    `${senderName} 邀請你加入 ExKey 關鍵人脈`,
    "",
    "ExKey 是一個讓業務與廠商互相介紹人脈的平台：依產業、地區、部門、層級自動媒合你想認識的關鍵人脈，媒合後才取得聯絡方式。",
    "",
    `用我的推薦碼註冊，我們各得 5 點信用點數（可用來連繫關鍵人脈）`,
    `推薦碼：${code}`,
    "",
    "註冊連結（推薦碼會自動帶入）：",
    link,
    "",
    "由關鍵人脈資訊股份有限公司經營",
    `服務條款：${SITE_URL}/terms`,
  ].join("\n");
}

// 手機：開原生分享面板（LINE、訊息等）；電腦：直接複製到剪貼簿。
// 電腦版瀏覽器的分享面板常叫不出來又回報「取消」，所以電腦不走那條。
// 複製也被擋的話回傳 failed，由畫面把整段文字秀出來讓人手動複製。
async function shareOrCopy(text: string): Promise<"shared" | "copied" | "failed"> {
  const isMobile =
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as Navigator & { share: (d: { text: string }) => Promise<void> }).share({ text });
      return "shared";
    } catch {
      // 面板叫不出來或使用者取消，往下改用複製
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return "copied";
  } catch {}
  return "failed";
}
// 複製失敗時的備援：把訊息整段秀出來，讓人自己全選複製
function InviteTextPanel({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="mt-3 bg-white text-gray-800 rounded-xl p-3 border border-gold-100">
      <div className="text-xs text-gray-500 mb-2">瀏覽器不讓我們自動複製。點下面的文字框 → 全選 → 複製，貼給朋友即可。</div>
      <textarea
        readOnly
        value={text}
        rows={9}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full text-xs leading-relaxed p-2 rounded-lg border border-gray-200 bg-gray-50 resize-none"
      />
      <button onClick={onClose} className="mt-2 text-xs text-gray-500 underline">
        關閉
      </button>
    </div>
  );
}


// ==================== 視覺元件 ====================

// 配對度圓環：把百分比變成一眼可讀的圖形
function MatchRing({ percent }: { percent: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#EEE7F7" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={percent >= 60 ? "#D4AF37" : "#6B4FB8"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-purple-900 leading-none">
          {percent}
          <span className="text-[10px] text-gray-400 font-medium">%</span>
        </span>
      </div>
    </div>
  );
}

// 把一組條件整理成標籤清單，層級標籤加重顯示。
// theirs = 對方那筆案件；mine = 我拿來配的那筆（對方填不限的維度改顯示我的值）
function conditionChips(theirs: NetworkEntry | null, mine: NetworkEntry | null): { text: string; strong: boolean }[] {
  if (!theirs) return [];
  const out: { text: string; strong: boolean }[] = [];
  const m = mine ? condOf(mine) : { industries: [], regions: [], departments: [], level: 0 };
  const t = condOf(theirs);
  shownList(t.industries, m.industries).slice(0, 3).forEach((v) => out.push({ text: v, strong: false }));
  shownList(t.regions, m.regions).slice(0, 2).forEach((v) => out.push({ text: v, strong: false }));
  shownList(t.departments, m.departments).slice(0, 2).forEach((v) => out.push({ text: v, strong: false }));
  const lv = shownLevel(t.level, m.level);
  if (lv > 0) out.push({ text: levelLabel(lv), strong: true });
  return out;
}

// 條件區塊：左側色條 + 標題 + 標籤群，兩個區塊用顏色區分方向
function ConditionBlock({
  title,
  tone,
  chips,
  emptyText,
  note,
}: {
  title: string;
  tone: "offer" | "seek";
  chips: { text: string; strong: boolean }[];
  emptyText: string;
  note?: string | null;
}) {
  const bar = tone === "offer" ? "bg-purple-600" : "bg-gold-600";
  const label = tone === "offer" ? "text-purple-600" : "text-gold-900";
  const chipPlain =
    tone === "offer"
      ? "bg-purple-50 text-purple-900 border-purple-100"
      : "bg-gold-50 text-gold-900 border-gold-100";
  const chipStrong =
    tone === "offer" ? "bg-purple-600 text-white border-purple-600" : "bg-gold-600 text-purple-900 border-gold-600";

  return (
    <div className="flex gap-3">
      <div className={`w-1 rounded-full shrink-0 ${bar}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[11px] font-semibold tracking-wide mb-1.5 ${label}`}>{title}</div>
        {chips.length === 0 ? (
          <div className="text-xs text-gray-400">{emptyText}</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span
                key={`${title}-${c.text}-${i}`}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                  c.strong ? chipStrong : chipPlain
                }`}
              >
                {c.text}
              </span>
            ))}
          </div>
        )}
        {note && <div className="text-xs text-gray-500 mt-2 leading-relaxed">「{note}」</div>}
      </div>
    </div>
  );
}

// 載入中的骨架卡，比「載入中...」三個字更不像壞掉
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-purple-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-purple-100 rounded" />
          <div className="h-3 w-36 bg-gray-100 rounded" />
        </div>
        <div className="w-14 h-14 rounded-full bg-gray-100" />
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-3/5 bg-gray-100 rounded" />
      </div>
      <div className="mt-5 h-11 bg-purple-100 rounded-xl" />
    </div>
  );
}

// ==================== 頁面 ====================

export default function Discover() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [name, setName] = useState("");
  const [unlocks, setUnlocks] = useState<Record<string, UnlockState>>({});
  const [points, setPoints] = useState<number | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [showRefBanner, setShowRefBanner] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteFallback, setInviteFallback] = useState<string | null>(null);
  const [hasSeek, setHasSeek] = useState(true);

  async function refreshWallet() {
    const { data } = await supabase.rpc("get_my_wallet");
    if (data && typeof data.points === "number") setPoints(data.points);
  }

  useEffect(() => {
    async function load() {
      // 未登入者導回登入頁
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const uid = userData.user.id;

      // 讀取自己的檔案（基本資料）與自己的人脈案件
      const { data: mine } = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mine || mine.length === 0) {
        setNoProfile(true);
        setLoading(false);
        return;
      }
      const me = mine[0] as unknown as PublicProfile;
      setName(me.name);
      refreshWallet();

      // 我的推薦碼：第一次進媒合頁時提示一次，之後在「點數不足」時再提
      supabase.rpc("my_referral").then(({ data: ref }) => {
        const code = ref && typeof ref === "object" ? (ref as { code: string | null }).code : null;
        if (!code) return;
        setRefCode(code);
        try {
          if (!localStorage.getItem(REF_BANNER_KEY)) setShowRefBanner(true);
        } catch {}
      });

      // 全站媒合中會員的基本資料 ＋ 所有人脈案件（資料庫只會給看得見的檔案的案件）
      const [{ data: people, error: pErr }, { data: entries, error: eErr }] = await Promise.all([
        supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("is_active", true),
        supabase.from("network_entries").select(ENTRY_COLUMNS),
      ]);
      if (pErr || eErr || !people || !entries) {
        setLoading(false);
        return;
      }

      const byProfile = new Map<string, NetworkEntry[]>();
      (entries as unknown as NetworkEntry[]).forEach((e) => {
        const list = byProfile.get(e.profile_id) || [];
        list.push(e);
        byProfile.set(e.profile_id, list);
      });
      const myEntries = byProfile.get(me.id) || [];
      const mySeeks = myEntries.filter((e) => e.kind === "seek");
      const myOffers = myEntries.filter((e) => e.kind === "offer");
      setHasSeek(mySeeks.length > 0);
      if (mySeeks.length === 0) {
        // 沒有找人脈案件就沒有比對條件，不列名單
        setRecommendations([]);
        setLoading(false);
        return;
      }

      const scored = (people as unknown as PublicProfile[])
        .filter((p) => p.id !== me.id && p.user_id !== uid)
        .map((p) => {
          const theirs = byProfile.get(p.id) || [];
          const theirOffers = theirs.filter((e) => e.kind === "offer");
          const theirSeeks = theirs.filter((e) => e.kind === "seek");
          // 一筆案件都沒有的人不出現在任何人的名單裡
          if (theirs.length === 0) return null;

          // 主方向：我的找人脈 × 對方的介紹人脈
          const primary = bestPair(mySeeks, theirOffers);
          // 反方向：對方的找人脈 × 我的介紹人脈（都有才算「超級伙伴」）
          const secondary = bestPair(theirSeeks, myOffers);

          const primaryScore = Math.max(primary.score, 0);
          const secondaryScore = Math.max(secondary.score, 0);
          const seekToShow = secondary.seek || theirSeeks[0] || null;

          return {
            ...p,
            score: primaryScore + secondaryScore,
            mutual: primary.score >= 40 && secondary.score >= 40,
            percent: Math.round((primaryScore / FULL_SCORE) * 100),
            reasons: primary.seek && primary.offer ? matchReasons(condOf(primary.seek), condOf(primary.offer)) : [],
            theirOffer: primary.offer,
            mySeek: primary.seek,
            theirSeek: seekToShow,
            myOffer: secondary.offer,
          } as Recommendation;
        })
        .filter((r): r is Recommendation => r !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setRecommendations(scored);
      setLoading(false);
    }
    load();
  }, []);

  function setUnlock(id: string, state: UnlockState) {
    setUnlocks((prev) => ({ ...prev, [id]: state }));
  }

  // 確認後才向伺服器要 LINE ID（一次一筆，伺服器端留下解鎖紀錄）
  async function handleUnlock(id: string) {
    setUnlock(id, { stage: "loading" });
    const { data, error } = await supabase.rpc("reveal_line_id", { target_id: id });
    if (error) {
      if (error.message.includes("NO_POINTS")) {
        setUnlock(id, { stage: "nopoints" });
      } else {
        setUnlock(id, { stage: "error" });
      }
      return;
    }
    setUnlock(id, { stage: "revealed", lineId: (data as string | null) || "" });
    refreshWallet();
  }

  const shareLink = refCode ? `${SITE_URL}/onboarding?ref=${refCode}` : "";

  async function copyShareLink() {
    if (!shareLink || !refCode) return;
    const text = buildInviteMessage(name || "你的朋友", refCode, shareLink);
    const r = await shareOrCopy(text);
    if (r === "copied") {
      setInviteFallback(null);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } else if (r === "failed") {
      setInviteFallback(text);
    }
  }

  function dismissRefBanner() {
    setShowRefBanner(false);
    try {
      localStorage.setItem(REF_BANNER_KEY, "1");
    } catch {}
  }

  const roleLabel = (r: string) => (r === "sales" ? "業務" : r === "vendor" ? "廠商" : "業務 ＋ 廠商");

  return (
    <main className="min-h-screen bg-purple-50 pb-12">
      {/* 頂部固定列 */}
      <header className="sticky top-0 z-20 ek-rich-bar">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold-600 text-purple-900 flex items-center justify-center font-bold text-sm">
              EK
            </div>
            <span className="text-base font-bold text-white tracking-wide">ExKey</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell tone="dark" />
            {points != null && (
              <Link
                href="/topup"
                className="bg-white/10 border border-gold-400/50 text-gold-400 text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                {points} 點
              </Link>
            )}
            <button
              onClick={() => router.push("/member")}
              className="text-xs text-white/85 border border-white/25 px-3 py-1.5 rounded-full"
            >
              會員專區
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4">
        {/* 標題區 */}
        <div className="pt-7 pb-5">
          <h1 className="text-[26px] leading-tight font-bold text-purple-900">
            {name ? `${name}，自動媒合結果` : "自動媒合"}
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            {loading
              ? "正在比對全站人脈條件..."
              : recommendations.length > 0
              ? `依你的找人脈案件，找到 ${recommendations.length} 位關鍵人脈`
              : "依你的找人脈案件比對"}
          </p>
        </div>

        {/* 第一次進來：邀請提示（可關） */}
        {!loading && !noProfile && showRefBanner && refCode && (
          <div className="mb-5 ek-rich text-white rounded-2xl p-4 overflow-hidden">
            <button
              onClick={dismissRefBanner}
              aria-label="關閉"
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 text-white text-sm leading-none"
            >
              ×
            </button>
            <div className="text-xs text-purple-100 mb-1">你的邀請連結已準備好</div>
            <div className="text-sm leading-relaxed pr-8">
              分享給同業，每成功邀請一位，你和對方各得 <span className="font-bold text-gold-400">5 點</span>
              。你的推薦碼：<span className="font-bold tracking-widest text-gold-400">{refCode}</span>
            </div>
            <button
              onClick={copyShareLink}
              className="mt-3 w-full bg-gold-600 text-purple-900 text-sm font-bold py-2.5 rounded-xl"
            >
              {copiedLink ? "邀請訊息已複製，貼給朋友即可" : "分享邀請給同業"}
            </button>
            {inviteFallback && <InviteTextPanel text={inviteFallback} onClose={() => setInviteFallback(null)} />}
          </div>
        )}

        {/* 載入中 */}
        {loading && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* 尚未建立檔案 */}
        {!loading && noProfile && (
          <div className="bg-white rounded-2xl border border-purple-100 p-7 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl ek-rich-sm mx-auto mb-4 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-base font-semibold text-purple-900 mb-1">還沒有你的人脈檔案</p>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              填好你的找人脈、介紹人脈，
              <br />
              系統才知道要幫你媒合誰
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full bg-gold-600 text-purple-900 font-semibold py-3.5 rounded-xl shadow-sm"
            >
              開始建立檔案
            </button>
          </div>
        )}

        {/* 沒有找人脈案件 */}
        {!loading && !noProfile && !hasSeek && (
          <div className="bg-white rounded-2xl border border-gold-100 p-7 shadow-sm text-center mb-4">
            <p className="text-base font-semibold text-purple-900 mb-1">你還沒有找人脈的案件</p>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              先新增一筆「找人脈」，說明你想認識哪一類的關鍵人脈，
              <br />
              系統才有條件可以比對
            </p>
            <button
              onClick={() => router.push("/entry?kind=seek")}
              className="w-full bg-gold-600 text-purple-900 font-semibold py-3 rounded-xl"
            >
              新增找人脈
            </button>
          </div>
        )}

        {/* 沒有媒合結果 */}
        {!loading && !noProfile && hasSeek && recommendations.length === 0 && (
          <div className="bg-white rounded-2xl border border-purple-100 p-7 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 mx-auto mb-4 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4A2D8F" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </div>
            <p className="text-base font-semibold text-purple-900 mb-1">目前還沒有符合的關鍵人脈</p>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              平台還在累積人脈中。
              <br />
              把條件放寬一些，或過幾天再回來看看
            </p>
            <button
              onClick={() => router.push("/member")}
              className="w-full border border-purple-600 text-purple-600 font-semibold py-3 rounded-xl"
            >
              調整我的人脈案件
            </button>
          </div>
        )}

        {/* 推薦清單 */}
        <div className="space-y-4">
          {recommendations.map((p, idx) => {
            const unlock = unlocks[p.id] || { stage: "idle" };
            const top = idx === 0 && recommendations.length > 1 && p.percent >= 50;
            const offerChips = conditionChips(p.theirOffer, p.mySeek);
            const seekChips = conditionChips(p.theirSeek, p.myOffer);

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden border ${
                  top ? "border-gold-400" : "border-purple-100"
                }`}
              >
                {top && (
                  <div className="bg-gold-600 text-purple-900 text-[11px] font-bold tracking-wide px-4 py-1.5">
                    最符合你條件的一位
                  </div>
                )}

                <div className="p-5">
                  {/* 身份列 */}
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-2xl ek-rich-sm text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-lg font-bold text-purple-900 truncate">{p.name}</div>
                      <div className="text-sm text-gray-500 truncate">
                        {roleLabel(p.role)}
                        {p.company ? `・${p.company}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.is_verified && (
                          <span className="text-[11px] bg-gold-50 text-gold-900 border border-gold-100 px-2 py-0.5 rounded-full font-medium">
                            已驗證
                          </span>
                        )}
                        {p.mutual && (
                          <span className="text-[11px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-medium">
                            超級伙伴
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-center">
                      <MatchRing percent={p.percent} />
                      <div className="text-[10px] text-gray-400 mt-1">符合度</div>
                    </div>
                  </div>

                  {/* 配對原因 */}
                  {p.reasons.length > 0 && (
                    <div className="mt-4 bg-purple-50 rounded-xl px-3 py-2 text-xs text-purple-600 font-medium">
                      符合你的條件：{p.reasons.join("、")}
                    </div>
                  )}

                  {/* 自我介紹 */}
                  {p.bio && <p className="mt-4 text-sm text-gray-600 leading-relaxed">{p.bio}</p>}

                  {/* 條件兩欄 */}
                  <div className="mt-4 space-y-4">
                    <ConditionBlock
                      title="他的介紹人脈"
                      tone="offer"
                      chips={offerChips}
                      emptyText="尚未填寫"
                      note={p.theirOffer ? p.theirOffer.note : null}
                    />
                    <ConditionBlock
                      title="他的找人脈"
                      tone="seek"
                      chips={seekChips}
                      emptyText="尚未填寫"
                      note={p.theirSeek ? p.theirSeek.note : null}
                    />
                  </div>

                  {/* 解鎖區 */}
                  <div className="mt-5">
                    {unlock.stage === "idle" && (
                      <button
                        onClick={() => setUnlock(p.id, { stage: "confirm" })}
                        className="w-full bg-gold-600 text-purple-900 font-bold py-3.5 rounded-xl shadow-sm active:scale-[0.99] transition"
                      >
                        立即連繫
                      </button>
                    )}

                    {unlock.stage === "confirm" && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                        <div className="text-sm font-bold text-purple-900 mb-1.5">
                          立即連繫 {p.name}
                        </div>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                          取得對方聯絡方式需 <span className="font-bold text-purple-600">{UNLOCK_COST} 點</span>
                          {points != null && (
                            <>
                              ，你目前有 <span className="font-bold text-purple-600">{points} 點</span>
                            </>
                          )}
                          。連繫過的關鍵人脈之後免費查看，不重複扣點。
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setUnlock(p.id, { stage: "idle" })}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleUnlock(p.id)}
                            className="flex-1 bg-gold-600 text-purple-900 font-bold py-2.5 rounded-xl text-sm"
                          >
                            確認連繫（扣 {UNLOCK_COST} 點）
                          </button>
                        </div>
                      </div>
                    )}

                    {unlock.stage === "loading" && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl py-3.5 text-center text-sm text-purple-600 font-medium">
                        處理中...
                      </div>
                    )}

                    {unlock.stage === "revealed" && (
                      <div className="bg-purple-900 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] text-purple-100 mb-0.5">對方的 LINE ID</div>
                          <div className="font-bold text-gold-400 text-lg truncate">
                            {unlock.lineId || "（未提供）"}
                          </div>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(unlock.lineId)}
                          className="shrink-0 text-sm bg-gold-600 text-purple-900 font-bold px-4 py-2 rounded-lg"
                        >
                          複製
                        </button>
                      </div>
                    )}

                    {unlock.stage === "nopoints" && (
                      <div className="bg-gold-50 border border-gold-100 rounded-xl p-4">
                        <p className="text-sm font-bold text-gold-900 mb-1">信用點數不足</p>
                        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                          連繫一位需 {UNLOCK_COST} 點。用一杯咖啡的錢，創造無限的機會：100 點 NT$500，可連繫 10
                          位關鍵人脈。
                        </p>
                        <button
                          onClick={() => router.push("/member")}
                          className="w-full bg-gold-600 text-purple-900 font-bold py-3 rounded-xl text-sm"
                        >
                          前往會員專區加值
                        </button>
                        {refCode && (
                          <div className="mt-3 pt-3 border-t border-gold-100">
                            <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                              或邀請同業加入：每成功一位，你和對方各得 5 點
                            </p>
                            <button
                              onClick={copyShareLink}
                              className="w-full border border-gold-600 text-gold-900 font-semibold py-2.5 rounded-xl text-sm bg-white"
                            >
                              {copiedLink ? "邀請訊息已複製，貼給朋友即可" : "分享邀請給同業"}
                            </button>
                            {inviteFallback && (
                              <InviteTextPanel text={inviteFallback} onClose={() => setInviteFallback(null)} />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {unlock.stage === "error" && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-sm text-red-600 mb-2">連繫失敗，請稍後再試</p>
                        <button onClick={() => handleUnlock(p.id)} className="text-sm text-purple-600 underline">
                          重試
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部說明 */}
        {!loading && recommendations.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-7 leading-relaxed">
            符合度依你的找人脈案件計算，不代表對方的合作意願。
            <br />
            連繫過的關鍵人脈可永久免費查看。
          </p>
        )}
      </div>
    </main>
  );
}
