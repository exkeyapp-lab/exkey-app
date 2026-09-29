"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { levelLabel, PUBLIC_PROFILE_COLUMNS, type PublicProfile } from "@/lib/types";

const SITE_URL = "https://exkey-app.vercel.app";


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


interface ReferralInfo {
  code: string | null;
  referred_count: number;
  cap: number;
}

export default function Member() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [unlockedTimes, setUnlockedTimes] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [toggling, setToggling] = useState(false);
  const [inviteFallback, setInviteFallback] = useState<string | null>(null);

  async function loadProfile(uid: string) {
    const { data } = await supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1);
    setProfile(data && data.length > 0 ? (data[0] as unknown as PublicProfile) : null);
  }

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setEmail(userData.user.email || "");

      await loadProfile(userData.user.id);

      const { data: adm } = await supabase.rpc("am_i_admin");
      if (adm === true) setIsAdmin(true);

      const { data: wallet } = await supabase.rpc("get_my_wallet");
      if (wallet) {
        if (typeof wallet.points === "number") setPoints(wallet.points);
        if (typeof wallet.unlocked_times === "number") setUnlockedTimes(wallet.unlocked_times);
      }

      const { data: ref } = await supabase.rpc("my_referral");
      if (ref && typeof ref === "object") setReferral(ref as ReferralInfo);

      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // 停用／啟用自己的檔案：停用後不會出現在別人的推薦裡，隨時可以開回來
  async function toggleActive() {
    if (!profile) return;
    const next = !profile.is_active;
    const msg = next
      ? "重新啟用後，你的檔案會再次出現在其他會員的推薦裡。確定？"
      : "停用後，其他會員找不到你、也不能解鎖你的聯絡方式。你的資料和點數都會保留，隨時可以再啟用。確定停用？";
    if (!window.confirm(msg)) return;
    setToggling(true);
    const { error } = await supabase.rpc("set_my_active", { p_active: next });
    setToggling(false);
    if (error) {
      alert("操作失敗：" + error.message);
      return;
    }
    setProfile({ ...profile, is_active: next });
  }

  async function copyText(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  async function shareInvite() {
    if (!referral?.code || !profile) return;
    const text = buildInviteMessage(profile.name, referral.code, shareLink);
    const r = await shareOrCopy(text);
    if (r === "copied") {
      setInviteFallback(null);
      setCopied("link");
      setTimeout(() => setCopied(null), 1500);
    } else if (r === "failed") {
      setInviteFallback(text);
    }
  }

  function Tags({ items, level }: { items: string[]; level: number | null }) {
    const empty = items.length === 0 && level == null;
    if (empty) return <span className="text-xs text-gray-400">不限</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((v) => (
          <span key={v} className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
            {v}
          </span>
        ))}
        {level != null && level > 0 && (
          <span className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
            {levelLabel(level)}
          </span>
        )}
      </div>
    );
  }

  const shareLink = referral?.code ? `${SITE_URL}/onboarding?ref=${referral.code}` : "";

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => router.push("/admin")}
                className="text-sm text-purple-600 underline"
              >
                管理後台
              </button>
            )}
            <button onClick={handleLogout} className="text-sm text-gray-500 underline">
              登出
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">會員專區</h1>
        <p className="text-sm text-gray-500 mb-6">{email}</p>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}

        {!loading && !profile && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
            <p className="text-gray-600 mb-4">你還沒有建立人脈檔案</p>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full bg-purple-600 text-white font-medium py-3 rounded-xl"
            >
              開始建立 →
            </button>
          </div>
        )}

        {!loading && profile && (
          <div className="space-y-4">
            {/* 身份卡 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-gray-900">{profile.name}</div>
                <div className="flex items-center gap-2">
                  {profile.is_active ? (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                      媒合中
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已停用</span>
                  )}
                  <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded-full">免費會員</span>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {profile.role === "sales" ? "業務" : profile.role === "vendor" ? "廠商" : "業務+廠商"}
                {profile.company ? `・${profile.company}` : ""}
              </div>
              {profile.bio && <p className="text-sm text-gray-600 mt-2">{profile.bio}</p>}
            </div>

            {/* 我的人脈條件：註冊時填的內容，放在最上面，直接可改 */}
            <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-purple-900">我的人脈條件</div>
                <button
                  onClick={() => router.push("/onboarding?edit=1")}
                  className="text-xs bg-purple-600 text-white font-semibold px-3 py-1.5 rounded-lg"
                >
                  編輯
                </button>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="w-1 rounded-full bg-gold-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-gold-900 mb-1.5">我想找</div>
                  <Tags items={profile.seek_industries || []} level={profile.seek_level} />
                  <div className="mt-1.5">
                    <Tags items={[...(profile.seek_regions || []), ...(profile.seek_departments || [])]} level={null} />
                  </div>
                  {profile.seek_note && (
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">「{profile.seek_note}」</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-1 rounded-full bg-purple-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-purple-600 mb-1.5">我能介紹</div>
                  {profile.has_offer ? (
                    <>
                      <Tags items={profile.offer_industries || []} level={profile.offer_level} />
                      <div className="mt-1.5">
                        <Tags items={[...(profile.offer_regions || []), ...(profile.offer_departments || [])]} level={null} />
                      </div>
                      {profile.offer_note && (
                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">「{profile.offer_note}」</p>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => router.push("/onboarding?edit=1")}
                      className="text-xs text-purple-600 underline"
                    >
                      尚未填寫，點此補上
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push("/discover")}
              className="w-full bg-gold-600 text-purple-900 font-semibold py-3 rounded-xl"
            >
              查看為我推薦的人脈 →
            </button>

            {!profile.is_active && (
              <div className="bg-gold-50 border border-gold-100 text-gold-900 text-xs rounded-xl p-3 leading-relaxed">
                你的檔案目前已停用，其他會員看不到你。要重新被找到，按最下方「重新啟用」。
              </div>
            )}

            {/* 點數與解鎖 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-gold-900">{points ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">點數餘額</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-purple-600">{unlockedTimes ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">檔案被解鎖次數</div>
              </div>
            </div>

            <button
              onClick={() => router.push("/topup")}
              className="w-full border border-gold-600 text-gold-900 font-medium py-2.5 rounded-xl text-sm bg-white"
            >
              加值點數（100 點 / NT$500）→
            </button>

            {/* 推薦碼 */}
            {referral && referral.code && (
              <div className="bg-gradient-to-br from-purple-600 to-purple-900 text-white rounded-2xl p-4 shadow-lg">
                <div className="text-xs text-purple-100 mb-1">我的推薦碼</div>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold tracking-[0.2em] text-gold-400">{referral.code}</div>
                  <button
                    onClick={() => copyText(referral.code || "", "code")}
                    className="text-xs bg-white/15 border border-white/30 px-3 py-1.5 rounded-lg"
                  >
                    {copied === "code" ? "已複製" : "複製"}
                  </button>
                </div>
                <div className="text-xs text-purple-100 mt-3 leading-relaxed">
                  朋友用你的推薦碼完成註冊（含信箱驗證與建檔），你們各得 5 點。
                  已成功推薦 <span className="font-bold text-gold-400">{referral.referred_count}</span> / {referral.cap} 人
                </div>
                <button
                  onClick={shareInvite}
                  className="w-full mt-3 bg-gold-600 text-purple-900 text-sm font-semibold py-2.5 rounded-lg"
                >
                  {copied === "link" ? "邀請訊息已複製，貼給朋友即可" : "分享邀請給同業"}
                </button>
                <p className="text-[11px] text-purple-100/90 mt-2 leading-relaxed">
                  會帶一段說明文字（誰邀請、平台在做什麼、誰經營）＋你的推薦碼與連結，對方才不會當成詐騙。
                </p>
                <button
                  onClick={() => copyText(shareLink, "link")}
                  className="w-full mt-2 text-[11px] text-purple-100/80 underline"
                >
                  只複製純連結
                </button>
                {inviteFallback && <InviteTextPanel text={inviteFallback} onClose={() => setInviteFallback(null)} />}
              </div>
            )}

            {/* 帳號狀態：暫停／重新啟用 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500 leading-relaxed">
                {profile.is_active
                  ? "你的檔案目前在媒合中，其他會員找得到你"
                  : "你的檔案已停用，其他會員看不到你"}
              </div>
              <button
                disabled={toggling}
                onClick={toggleActive}
                className="shrink-0 border border-gray-200 text-gray-500 text-xs py-2 px-3 rounded-lg disabled:opacity-50"
              >
                {toggling ? "處理中..." : profile.is_active ? "暫停媒合" : "重新啟用"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
