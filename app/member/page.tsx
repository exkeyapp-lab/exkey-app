"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import NotificationBell from "../NotificationBell";
import { levelLabel, PUBLIC_PROFILE_COLUMNS, ENTRY_COLUMNS, type PublicProfile, type NetworkEntry } from "@/lib/types";

const SITE_URL = "https://exkey-app.vercel.app";


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


interface UnlockedRow {
  id: string;
  name: string;
  company: string | null;
  role: string;
  line_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface FinderSeek {
  industries: string[] | null;
  regions: string[] | null;
  departments: string[] | null;
  level: number | null;
  note: string | null;
}
interface FinderRow {
  name: string | null;
  company: string | null;
  role: string | null;
  seeks: FinderSeek[] | null;
  created_at: string;
}

const LIST_PREVIEW = 5;

function roleText(r: string | null | undefined): string {
  return r === "sales" ? "業務" : r === "vendor" ? "廠商" : r === "both" ? "業務＋廠商" : "";
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
  const [entries, setEntries] = useState<NetworkEntry[]>([]);
  const [inviteFallback, setInviteFallback] = useState<string | null>(null);
  const [myUnlocks, setMyUnlocks] = useState<UnlockedRow[]>([]);
  const [finders, setFinders] = useState<FinderRow[]>([]);
  const [showAllUnlocks, setShowAllUnlocks] = useState(false);
  const [showAllFinders, setShowAllFinders] = useState(false);
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);

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

      // 我的人脈案件（找人脈／介紹人脈，可多筆）
      const { data: ent } = await supabase.rpc("my_entries");
      if (Array.isArray(ent)) setEntries(ent as NetworkEntry[]);

      const { data: adm } = await supabase.rpc("am_i_admin");
      if (adm === true) setIsAdmin(true);

      const { data: wallet } = await supabase.rpc("get_my_wallet");
      if (wallet) {
        if (typeof wallet.points === "number") setPoints(wallet.points);
        if (typeof wallet.unlocked_times === "number") setUnlockedTimes(wallet.unlocked_times);
      }

      const { data: ref } = await supabase.rpc("my_referral");
      if (ref && typeof ref === "object") setReferral(ref as ReferralInfo);

      // 解鎖紀錄：函式還沒建（SQL 沒跑）時不擋整頁
      const [mu, wu] = await Promise.all([supabase.rpc("my_unlocks"), supabase.rpc("who_unlocked_me")]);
      if (!mu.error && Array.isArray(mu.data)) setMyUnlocks(mu.data as UnlockedRow[]);
      if (!wu.error && Array.isArray(wu.data)) setFinders(wu.data as FinderRow[]);

      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
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

  // 一筆案件的條件標籤；全部不限時明講「不限」
  function EntryTags({ e }: { e: NetworkEntry }) {
    const items = [...(e.industries || []), ...(e.regions || []), ...(e.departments || [])];
    const lv = e.level || 0;
    if (items.length === 0 && lv === 0) {
      return <span className="text-xs text-gray-400">產業、地區、部門、層級皆不限</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((v) => (
          <span key={v} className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded">
            {v}
          </span>
        ))}
        {lv > 0 && (
          <span className="text-xs bg-gold-50 text-gold-900 px-2 py-1 rounded border border-gold-100">
            {levelLabel(lv)}
          </span>
        )}
      </div>
    );
  }

  function EntryList({ kind }: { kind: "seek" | "offer" }) {
    const list = entries.filter((e) => e.kind === kind);
    const isSeek = kind === "seek";
    return (
      <div className="flex gap-3">
        <div className={`w-1 rounded-full shrink-0 ${isSeek ? "bg-gold-600" : "bg-purple-600"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className={`text-[11px] font-semibold ${isSeek ? "text-gold-900" : "text-purple-600"}`}>
              {isSeek ? "找人脈" : "介紹人脈"}
              <span className="text-gray-400 font-normal ml-1">{list.length} 筆</span>
            </div>
            <button
              onClick={() => router.push(`/entry?kind=${kind}`)}
              className="text-[11px] text-purple-600 font-semibold underline"
            >
              ＋ 新增
            </button>
          </div>
          {list.length === 0 ? (
            <p className="text-xs text-gray-400">
              {isSeek ? "還沒有找人脈的案件，新增一筆系統才能幫你媒合" : "還沒有介紹人脈的案件"}
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/entry?id=${e.id}`)}
                  className="w-full text-left bg-purple-50/60 hover:bg-purple-50 rounded-xl p-2.5 transition"
                >
                  <EntryTags e={e} />
                  {e.note && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">「{e.note}」</p>}
                  <div className="text-[10px] text-gray-400 mt-1">點一下修改或刪除</div>
                </button>
              ))}
            </div>
          )}
        </div>
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
            <NotificationBell tone="light" />
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
                  {!profile.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已停用</span>
                  )}
                  <button
                    onClick={() => router.push("/onboarding?edit=1")}
                    className="text-xs text-purple-600 underline"
                  >
                    編輯基本資料
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {profile.role === "sales" ? "業務" : profile.role === "vendor" ? "廠商" : "業務+廠商"}
                {profile.company ? `・${profile.company}` : ""}
              </div>
              {profile.bio && <p className="text-sm text-gray-600 mt-2">{profile.bio}</p>}
            </div>

            {/* 我的人脈案件：找人脈／介紹人脈，各可多筆 */}
            <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-purple-900">我的人脈案件</div>
                <span className="text-xs text-gray-400">{entries.length} 筆</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">
                系統依這些案件自動媒合。兩種案件都沒有的話，你不會出現在別人的名單裡
              </p>
              <div className="space-y-4">
                <EntryList kind="seek" />
                <EntryList kind="offer" />
              </div>
            </div>

            <button
              onClick={() => router.push("/discover")}
              className="w-full bg-gold-600 text-purple-900 font-semibold py-3 rounded-xl"
            >
              查看自動媒合結果 →
            </button>

            {/* 我連繫過的關鍵人脈 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-purple-900">我連繫過的關鍵人脈</div>
                <span className="text-xs text-gray-400">{myUnlocks.length} 位</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">你按過「立即連繫」取得的聯絡方式都留在這裡，永久免費查看</p>
              {myUnlocks.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">還沒有連繫過任何人</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(showAllUnlocks ? myUnlocks : myUnlocks.slice(0, LIST_PREVIEW)).map((u) => (
                    <div key={u.id} className="py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl ek-rich-sm flex items-center justify-center font-bold shrink-0">
                        {u.name ? u.name[0] : "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {u.name}
                          {!u.is_active && <span className="ml-1.5 text-[10px] text-gray-400 font-normal">已停用</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {[roleText(u.role), u.company].filter(Boolean).join("・")}
                        </div>
                        <div className="text-xs text-purple-600 font-medium mt-0.5 truncate">
                          LINE：{u.line_id || "（未提供）"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-gray-400">{u.created_at.slice(0, 10)}</span>
                        {u.line_id && (
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(u.line_id || "");
                                setCopiedLineId(u.id);
                                setTimeout(() => setCopiedLineId(null), 1500);
                              } catch {}
                            }}
                            className="text-[11px] bg-gold-600 text-purple-900 font-semibold px-2.5 py-1 rounded-lg"
                          >
                            {copiedLineId === u.id ? "已複製" : "複製"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {myUnlocks.length > LIST_PREVIEW && (
                <button
                  onClick={() => setShowAllUnlocks((v) => !v)}
                  className="w-full mt-2 text-xs text-purple-600 underline"
                >
                  {showAllUnlocks ? "收起" : `顯示全部 ${myUnlocks.length} 位`}
                </button>
              )}
            </div>

            {/* 想合作：誰連繫了我 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-purple-900">想合作</div>
                <span className="text-xs text-gray-400">{finders.length} 位</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">這些人對你按了「立即連繫」、取得你的 LINE，可能會主動加你</p>
              {finders.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">還沒有人連繫你</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(showAllFinders ? finders : finders.slice(0, LIST_PREVIEW)).map((f, i) => {
                    const firstSeek = (f.seeks || [])[0];
                    const seekTags = firstSeek
                      ? [
                          ...(firstSeek.industries || []),
                          ...(firstSeek.regions || []),
                          ...(firstSeek.departments || []),
                          ...(firstSeek.level ? [levelLabel(firstSeek.level)] : []),
                        ]
                      : [];
                    return (
                      <div key={`${f.created_at}-${i}`} className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{f.name || "（已刪除的會員）"}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {[roleText(f.role), f.company].filter(Boolean).join("・")}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0">{f.created_at.slice(0, 10)}</span>
                        </div>
                        {seekTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] text-gold-900 font-semibold mr-0.5">他的找人脈</span>
                            {seekTags.slice(0, 5).map((t) => (
                              <span key={t} className="text-[10px] bg-gold-50 text-gold-900 border border-gold-100 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {firstSeek && firstSeek.note && <p className="text-[11px] text-gray-500 mt-1">「{firstSeek.note}」</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {finders.length > LIST_PREVIEW && (
                <button
                  onClick={() => setShowAllFinders((v) => !v)}
                  className="w-full mt-2 text-xs text-purple-600 underline"
                >
                  {showAllFinders ? "收起" : `顯示全部 ${finders.length} 位`}
                </button>
              )}
            </div>

            {!profile.is_active && (
              <div className="bg-gold-50 border border-gold-100 text-gold-900 text-xs rounded-xl p-3 leading-relaxed">
                你的檔案已由管理員停用，其他會員看不到你。有疑問請寫信到 exkey.app@gmail.com。
              </div>
            )}

            {/* 點數與解鎖 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-gold-900">{points ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">信用點數餘額</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-purple-600">{unlockedTimes ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">被連繫次數</div>
              </div>
            </div>

            <button
              onClick={() => router.push("/topup")}
              className="w-full border border-gold-600 text-gold-900 font-medium py-2.5 rounded-xl text-sm bg-white"
            >
              加值信用點數（100 點 / NT$500）→
            </button>

            {/* 推薦碼 */}
            {referral && referral.code && (
              <div className="ek-rich text-white rounded-2xl p-4 overflow-hidden">
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
                  朋友用你的推薦碼完成註冊並建檔，你們各得 5 點信用點數。
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
          </div>
        )}
      </div>
    </main>
  );
}
