"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { levelLabel, PUBLIC_PROFILE_COLUMNS, type PublicProfile } from "@/lib/types";

interface SideSnapshot {
  industries: string[];
  regions: string[];
  departments: string[];
  level: number;
}

// 單一維度計分：seekList 為空 = 不限，不計分也不扣分
function dimensionScore(seekList: string[], offerList: string[], weight: number): number {
  if (seekList.length === 0) return 0;
  const overlap = offerList.filter((v) => seekList.includes(v)).length;
  return overlap * weight;
}

// 職級計分：達到門檻給滿分，差一階仍給部分分數（放寬媒合範圍，
// 避免「想找高階主管」時完全看不到課長級的人脈）
function levelScore(seekLevel: number, offerLevel: number | null | undefined): number {
  if (!seekLevel) return 0;
  if (offerLevel == null) return 0;
  const gap = offerLevel - seekLevel;
  if (gap >= 0) return 30;
  if (gap === -1) return 18;
  if (gap === -2) return 10;
  return 5;
}

// 這位會員「自己開的條件」最多能拿幾分，用來把分數換算成誠實的百分比
function maxPrimaryScore(seek: SideSnapshot): number {
  return (
    seek.industries.length * 20 +
    seek.regions.length * 15 +
    seek.departments.length * 15 +
    (seek.level ? 30 : 0)
  );
}

// 列出實際對上的維度，讓低分的推薦也看得懂為什麼出現
function matchReasons(
  seek: SideSnapshot,
  offer: { industries: string[]; regions: string[]; departments: string[]; level: number | null | undefined }
): string[] {
  const out: string[] = [];
  if (seek.industries.length && offer.industries.some((v) => seek.industries.includes(v))) out.push("產業");
  if (seek.regions.length && offer.regions.some((v) => seek.regions.includes(v))) out.push("地區");
  if (seek.departments.length && offer.departments.some((v) => seek.departments.includes(v))) out.push("部門");
  if (seek.level && offer.level != null) {
    if (offer.level >= seek.level) out.push("職級");
    else if (offer.level === seek.level - 1) out.push("職級接近");
  }
  return out;
}

// 單方向比對：某一方的「想找」對上另一方的「提供」
function oneDirectionScore(
  seek: SideSnapshot,
  offer: { industries: string[]; regions: string[]; departments: string[]; level: number | null | undefined }
): number {
  return (
    dimensionScore(seek.industries, offer.industries, 20) +
    dimensionScore(seek.regions, offer.regions, 15) +
    dimensionScore(seek.departments, offer.departments, 15) +
    levelScore(seek.level, offer.level)
  );
}

function sideFromProfile(p: PublicProfile, which: "seek" | "offer"): SideSnapshot {
  if (which === "seek") {
    return {
      industries: p.seek_industries || [],
      regions: p.seek_regions || [],
      departments: p.seek_departments || [],
      level: p.seek_level ?? 0,
    };
  }
  return {
    industries: p.offer_industries || [],
    regions: p.offer_regions || [],
    departments: p.offer_departments || [],
    level: p.offer_level ?? 0,
  };
}

type Recommendation = PublicProfile & {
  score: number;
  mutual: boolean;
  percent: number | null;
  reasons: string[];
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
    "ExKey 是一個讓業務與廠商互相介紹人脈的平台：依產業、地區、部門、職級幫你配對想認識的合作對象，配對後才解鎖聯絡方式。",
    "",
    `用我的推薦碼註冊，我們各得 5 點（可用來解鎖聯絡方式）`,
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

// 把一組條件整理成標籤清單，職級標籤加重顯示
function conditionChips(
  industries: string[] | null | undefined,
  regions: string[] | null | undefined,
  departments: string[] | null | undefined,
  level: number | null | undefined
): { text: string; strong: boolean }[] {
  const out: { text: string; strong: boolean }[] = [];
  (industries || []).slice(0, 3).forEach((v) => out.push({ text: v, strong: false }));
  (regions || []).slice(0, 2).forEach((v) => out.push({ text: v, strong: false }));
  (departments || []).slice(0, 2).forEach((v) => out.push({ text: v, strong: false }));
  if (level != null && level > 0) out.push({ text: levelLabel(level), strong: true });
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

      // 讀取自己的檔案作為配對條件（單一資料來源，不再依賴瀏覽器暫存）
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

      // 我的推薦碼：第一次進推薦頁時提示一次，之後在「點數不足」時再提
      supabase.rpc("my_referral").then(({ data: ref }) => {
        const code = ref && typeof ref === "object" ? (ref as { code: string | null }).code : null;
        if (!code) return;
        setRefCode(code);
        try {
          if (!localStorage.getItem(REF_BANNER_KEY)) setShowRefBanner(true);
        } catch {}
      });
      const mySeek = sideFromProfile(me, "seek");
      const myOffer = sideFromProfile(me, "offer");
      const myHasOffer = me.has_offer;

      const { data, error } = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("is_active", true);
      if (error || !data) {
        setLoading(false);
        return;
      }

      const myMax = maxPrimaryScore(mySeek);

      const scored = (data as unknown as PublicProfile[])
        .filter((p) => p.id !== me.id && p.user_id !== uid)
        .map((p) => {
          const theirOffer = sideFromProfile(p, "offer");

          // 主方向：我想找 vs 對方提供
          const primary = oneDirectionScore(mySeek, theirOffer);

          // 反方向：對方想找 vs 我提供（只有我有填提供側時才計算，達成「雙向互補」加分）
          let secondary = 0;
          if (myHasOffer) {
            secondary = oneDirectionScore(sideFromProfile(p, "seek"), myOffer);
          }

          return {
            ...p,
            score: primary + secondary,
            mutual: primary > 0 && secondary > 0,
            percent: myMax > 0 ? Math.round(Math.min(primary / myMax, 1) * 100) : null,
            reasons: matchReasons(mySeek, theirOffer),
          };
        })
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
            {name ? `${name}，為你推薦` : "推薦人脈"}
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            {loading
              ? "正在比對全站人脈條件..."
              : recommendations.length > 0
              ? `依你設定的條件，找到 ${recommendations.length} 位合適對象`
              : "依你設定的條件比對"}
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
              填好你想找什麼、能介紹什麼，
              <br />
              系統才知道要幫你配對誰
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full bg-gold-600 text-purple-900 font-semibold py-3.5 rounded-xl shadow-sm"
            >
              開始建立檔案
            </button>
          </div>
        )}

        {/* 沒有推薦 */}
        {!loading && !noProfile && recommendations.length === 0 && (
          <div className="bg-white rounded-2xl border border-purple-100 p-7 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 mx-auto mb-4 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4A2D8F" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </div>
            <p className="text-base font-semibold text-purple-900 mb-1">目前還沒有符合的對象</p>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              平台還在累積人脈中。
              <br />
              把條件放寬一些，或過幾天再回來看看
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full border border-purple-600 text-purple-600 font-semibold py-3 rounded-xl"
            >
              調整我的條件
            </button>
          </div>
        )}

        {/* 推薦清單 */}
        <div className="space-y-4">
          {recommendations.map((p, idx) => {
            const unlock = unlocks[p.id] || { stage: "idle" };
            const top = idx === 0 && recommendations.length > 1 && (p.percent == null || p.percent >= 50);
            const offerChips = conditionChips(
              p.offer_industries,
              p.offer_regions,
              p.offer_departments,
              p.offer_level
            );
            const seekChips = conditionChips(
              p.seek_industries,
              p.seek_regions,
              p.seek_departments,
              p.seek_level
            );

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
                            雙向互補
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-center">
                      {p.percent != null ? (
                        <>
                          <MatchRing percent={p.percent} />
                          <div className="text-[10px] text-gray-400 mt-1">符合度</div>
                        </>
                      ) : (
                        <div className="w-14 h-14 rounded-full border-[5px] border-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                          不限
                        </div>
                      )}
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
                      title="他能介紹"
                      tone="offer"
                      chips={p.has_offer ? offerChips : []}
                      emptyText="尚未填寫"
                      note={p.offer_note}
                    />
                    <ConditionBlock
                      title="他想找"
                      tone="seek"
                      chips={seekChips}
                      emptyText="不限"
                      note={p.seek_note}
                    />
                  </div>

                  {/* 解鎖區 */}
                  <div className="mt-5">
                    {unlock.stage === "idle" && (
                      <button
                        onClick={() => setUnlock(p.id, { stage: "confirm" })}
                        className="w-full bg-gold-600 text-purple-900 font-bold py-3.5 rounded-xl shadow-sm active:scale-[0.99] transition"
                      >
                        想合作，解鎖聯絡方式
                      </button>
                    )}

                    {unlock.stage === "confirm" && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                        <div className="text-sm font-bold text-purple-900 mb-1.5">
                          解鎖 {p.name} 的聯絡方式
                        </div>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                          解鎖需 <span className="font-bold text-purple-600">{UNLOCK_COST} 點</span>
                          {points != null && (
                            <>
                              ，你目前有 <span className="font-bold text-purple-600">{points} 點</span>
                            </>
                          )}
                          。解鎖過的對象之後免費查看，不重複扣點。
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
                            確認解鎖（扣 {UNLOCK_COST} 點）
                          </button>
                        </div>
                      </div>
                    )}

                    {unlock.stage === "loading" && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl py-3.5 text-center text-sm text-purple-600 font-medium">
                        解鎖中...
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
                        <p className="text-sm font-bold text-gold-900 mb-1">點數不足</p>
                        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                          解鎖需 {UNLOCK_COST} 點。用一杯咖啡的錢，創造無限的機會——100 點 NT$500，可解鎖 10
                          位合作對象。
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
                        <p className="text-sm text-red-600 mb-2">解鎖失敗，請稍後再試</p>
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
            符合度依你設定的條件計算，不代表對方的合作意願。
            <br />
            解鎖過的對象可永久免費查看。
          </p>
        )}
      </div>
    </main>
  );
}
