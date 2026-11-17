"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { levelLabel, REGIONS, INDUSTRIES, DEPARTMENTS, JOB_LEVELS } from "@/lib/types";

interface DailyCount {
  day: string;
  count: number;
}
interface Overview {
  total_members: number;
  total_unlocks: number;
  daily: DailyCount[];
}
interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  points: number;
  created_at: string;
  unlocked_times: number;
}
interface UnlockRow {
  created_at: string;
  unlocker_name: string;
  target_name: string;
}
interface TopupRow {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  amount_ntd: number;
  bank_last5: string | null;
}
interface InvoiceInfo {
  email: string | null;
  name: string | null;
  tax_id: string | null;
  title: string | null;
  address: string | null;
}
interface ReferralRow {
  created_at: string;
  referrer: string;
  referrer_email: string | null;
  referred: string;
  referred_email: string | null;
  awarded: boolean;
}

// 後台人脈明細：資料庫回來的一筆案件
interface AdminEntry {
  profile_id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  is_active: boolean;
  entry_id: string;
  kind: "seek" | "offer";
  industries: string[] | null;
  regions: string[] | null;
  departments: string[] | null;
  level: number | null;
  note: string | null;
  created_at: string;
}
// 展開後的一筆明細：一個縣市 × 一個產業 × 一個部門 × 一個層級
interface DetailRow {
  kind: "seek" | "offer";
  region: string;
  industry: string;
  department: string;
  level: string;
  note: string;
}
// 一筆案件展開前的四組清單（不限 = 該項的全部選項）
interface EntryAxes {
  kind: "seek" | "offer";
  regions: string[];
  industries: string[];
  departments: string[];
  levels: string[];
  note: string;
  count: number;
  // 會員實際填的內容（沒選就是不限），給後台對照用
  raw: { regions: string[]; industries: string[]; departments: string[]; level: number };
  created_at: string;
}
interface MemberDetail {
  profile_id: string;
  name: string;
  company: string;
  email: string;
  is_active: boolean;
  entries: EntryAxes[];
  seekCount: number;
  offerCount: number;
}

const ALL_LEVELS = JOB_LEVELS.map((l) => l.label);

// 一筆案件 = 縣市 × 產業 × 部門 × 層級。例：20 個縣市、2 個產業、3 個部門、1 個層級 = 120 筆
// 某一項填「不限」就是該項全部選項都算：縣市 22、產業 9、部門 13、層級 4
function axesOf(e: AdminEntry): EntryAxes {
  const regions = e.regions && e.regions.length > 0 ? e.regions : REGIONS;
  const industries = e.industries && e.industries.length > 0 ? e.industries : INDUSTRIES;
  const departments = e.departments && e.departments.length > 0 ? e.departments : DEPARTMENTS;
  const levels = e.level && e.level > 0 ? [levelLabel(e.level)] : ALL_LEVELS;
  return {
    kind: e.kind,
    regions,
    industries,
    departments,
    levels,
    note: e.note || "",
    count: regions.length * industries.length * departments.length * levels.length,
    raw: {
      regions: e.regions || [],
      industries: e.industries || [],
      departments: e.departments || [],
      level: e.level || 0,
    },
    created_at: e.created_at,
  };
}

// 取出某位會員展開後的第 from ～ from+limit 筆（筆數可能上萬，不一次全部生出來）
function sliceRows(entries: EntryAxes[], from: number, limit: number): DetailRow[] {
  const out: DetailRow[] = [];
  let skipped = 0;
  for (const e of entries) {
    if (skipped + e.count <= from) {
      skipped += e.count;
      continue;
    }
    for (const region of e.regions)
      for (const industry of e.industries)
        for (const department of e.departments)
          for (const level of e.levels) {
            if (skipped < from) {
              skipped++;
              continue;
            }
            if (out.length >= limit) return out;
            out.push({ kind: e.kind, region, industry, department, level, note: e.note });
          }
  }
  return out;
}

function groupDetails(list: AdminEntry[]): MemberDetail[] {
  const map = new Map<string, MemberDetail>();
  list.forEach((e) => {
    let m = map.get(e.profile_id);
    if (!m) {
      m = {
        profile_id: e.profile_id,
        name: e.name || "（未命名）",
        company: e.company || "",
        email: e.email || "",
        is_active: e.is_active,
        entries: [],
        seekCount: 0,
        offerCount: 0,
      };
      map.set(e.profile_id, m);
    }
    const ax = axesOf(e);
    m.entries.push(ax);
    if (ax.kind === "seek") m.seekCount += ax.count;
    else m.offerCount += ax.count;
  });
  return Array.from(map.values());
}

const DETAIL_PAGE = 100;

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function Admin() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [unlockLogs, setUnlockLogs] = useState<UnlockRow[]>([]);
  const [topups, setTopups] = useState<TopupRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState("");
  const [activeMap, setActiveMap] = useState<Record<string, boolean> | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [invoiceByEmail, setInvoiceByEmail] = useState<Record<string, InvoiceInfo>>({});
  const [details, setDetails] = useState<MemberDetail[]>([]);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [detailsReady, setDetailsReady] = useState(false);
  const [detailShown, setDetailShown] = useState(DETAIL_PAGE);

  async function loadAll() {
    const [ov, mem, ul, tp, rf, st, iv, ne] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.rpc("admin_members"),
      supabase.rpc("admin_unlock_logs"),
      supabase.rpc("admin_topup_requests"),
      supabase.rpc("admin_referrals"),
      supabase.rpc("admin_member_status"),
      supabase.rpc("admin_invoice_info"),
      supabase.rpc("admin_network_entries"),
    ]);
    if (ov.error || mem.error || ul.error || tp.error) {
      setDenied(true);
      setLoading(false);
      return;
    }
    setOverview(ov.data as Overview);
    setMembers((mem.data as MemberRow[]) || []);
    setUnlockLogs((ul.data as UnlockRow[]) || []);
    setTopups((tp.data as TopupRow[]) || []);
    // 推薦紀錄函式還沒建（SQL 沒跑）時不擋整頁
    setReferrals(rf.error ? [] : ((rf.data as ReferralRow[]) || []));
    // 停用狀態函式還沒建（SQL 沒跑）時，列表照舊全部顯示
    if (!st.error && Array.isArray(st.data)) {
      const map: Record<string, boolean> = {};
      (st.data as { id: string; is_active: boolean }[]).forEach((r) => (map[r.id] = r.is_active));
      setActiveMap(map);
    }
    // 發票資料（SQL 沒跑時不擋整頁）
    if (!iv.error && Array.isArray(iv.data)) {
      const map: Record<string, InvoiceInfo> = {};
      (iv.data as InvoiceInfo[]).forEach((r) => {
        if (r.email) map[r.email] = r;
      });
      setInvoiceByEmail(map);
    }
    // 人脈明細（SQL 沒跑時不擋整頁）
    if (!ne.error && Array.isArray(ne.data)) {
      setDetails(groupDetails(ne.data as AdminEntry[]));
      setDetailsReady(true);
    }
    setLoading(false);
  }

  // 把全部明細下載成 CSV（Excel 可直接開）。筆數多時會有幾 MB，屬正常
  function downloadDetails() {
    const lines = [["會員", "公司", "Email", "狀態", "類型", "縣市", "產業", "部門", "層級", "說明"].join(",")];
    details.forEach((m) => {
      const head = [m.name, m.company, m.email, m.is_active ? "媒合中" : "已停用"].map(csvCell).join(",");
      sliceRows(m.entries, 0, Number.MAX_SAFE_INTEGER).forEach((r) =>
        lines.push(
          head +
            "," +
            [r.kind === "seek" ? "找人脈" : "介紹人脈", r.region, r.industry, r.department, r.level, r.note]
              .map(csvCell)
              .join(",")
        )
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ExKey人脈明細-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setMyEmail(userData.user.email || "");
      loadAll();
    }
    init();
  }, []);

  async function addPoints(profileId: string, amount: number, note: string) {
    setBusyId(profileId);
    const { error } = await supabase.rpc("admin_add_points", {
      p_profile: profileId,
      p_amount: amount,
      p_note: note,
    });
    setBusyId(null);
    if (error) {
      alert("加點失敗：" + error.message);
      return;
    }
    loadAll();
  }

  function customAdd(profileId: string) {
    const raw = window.prompt("要加多少點？（可輸入負數扣點）", "100");
    if (raw == null) return;
    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount === 0) {
      alert("請輸入有效數字");
      return;
    }
    const note = window.prompt("備註（會寫進點數流水帳）", "管理員調整") || "管理員調整";
    addPoints(profileId, amount, note);
  }

  async function handleTopup(id: string, approve: boolean) {
    if (!window.confirm(approve ? "確認已收到匯款並加點？" : "確定拒絕此筆申請？")) return;
    setBusyId(id);
    const { error } = await supabase.rpc("admin_handle_topup", {
      p_request: id,
      p_approve: approve,
    });
    setBusyId(null);
    if (error) {
      alert("處理失敗：" + error.message);
      return;
    }
    loadAll();
  }

  // 產出「最近 14 個日曆天」的連續日期串，沒有註冊的日子補 0，
  // 避免長條圖只畫有資料的日期、日期軸斷裂
  function lastNDays(n: number): string[] {
    const out: string[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      out.push(`${d.getFullYear()}-${mm}-${dd}`);
    }
    return out;
  }

  const activeMembers = activeMap ? members.filter((m) => activeMap[m.id] !== false) : members;
  const inactiveMembers = activeMap ? members.filter((m) => activeMap[m.id] === false) : [];

  const countByDay = new Map((overview ? overview.daily : []).map((d) => [d.day, d.count]));
  const recentDays: DailyCount[] = lastNDays(14).map((day) => ({
    day,
    count: countByDay.get(day) ?? 0,
  }));
  const maxCount = Math.max(1, ...recentDays.map((d) => d.count));

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-900 rounded-full flex items-center justify-center text-gold-400 font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey 管理後台</span>
          </Link>
          <div className="flex items-center gap-3">
            {myEmail && <span className="text-xs text-gray-400">{myEmail}</span>}
            <button onClick={() => router.push("/member")} className="text-sm text-gray-500 underline">
              回會員專區
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}

        {!loading && denied && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center text-gray-600">
            此頁僅限管理員使用
            {myEmail && <p className="text-xs text-gray-400 mt-2">目前登入：{myEmail}</p>}
          </div>
        )}

        {!loading && !denied && overview && (
          <div className="space-y-6">
            {/* 總覽 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {activeMap ? activeMembers.length : overview.total_members}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {activeMap ? "媒合中會員" : "總會員數"}
                  {activeMap && inactiveMembers.length > 0 && (
                    <span className="block text-[10px] text-gray-300">另有 {inactiveMembers.length} 筆已停用</span>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-gold-900">{overview.total_unlocks}</div>
                <div className="text-xs text-gray-400 mt-1">累計連繫次數</div>
              </div>
            </div>

            {/* 每日新增長條圖 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">每日新增會員（近 14 天）</div>
              {recentDays.length === 0 ? (
                <p className="text-xs text-gray-400">尚無資料</p>
              ) : (
                <div className="flex items-end gap-1 h-36">
                  {recentDays.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="text-[10px] text-gray-500 mb-0.5">{d.count > 0 ? d.count : ""}</div>
                      <div
                        className="w-full bg-purple-600 rounded-t"
                        style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: "3px" }}
                      />
                      <div className="text-[9px] text-gray-400 mt-1">
                        {recentDays.indexOf(d) % 2 === 0 ? d.day.slice(5) : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 加值申請待處理 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">
                加值申請待處理{topups.length > 0 && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{topups.length} 筆</span>}
              </div>
              {topups.length === 0 ? (
                <p className="text-xs text-gray-400">目前沒有待處理的申請</p>
              ) : (
                <div className="space-y-3">
                  {topups.map((t) => (
                    <div key={t.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="text-sm font-medium text-gray-900">
                        {t.name || "（未建檔）"} <span className="text-xs text-gray-400">{t.email}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        NT${t.amount_ntd}・帳號末五碼 {t.bank_last5 || "—"}・{fmtDate(t.created_at)}
                      </div>
                      {t.email && invoiceByEmail[t.email] ? (
                        <div className="text-xs text-gray-600 mt-1.5 bg-gold-50 border border-gold-100 rounded-lg p-2 leading-relaxed">
                          <span className="font-semibold text-gold-900">發票：</span>
                          {invoiceByEmail[t.email].tax_id ? `統編 ${invoiceByEmail[t.email].tax_id}・` : "個人（無統編）・"}
                          {invoiceByEmail[t.email].title ? `抬頭 ${invoiceByEmail[t.email].title}・` : ""}
                          寄至 {invoiceByEmail[t.email].address || "（未填地址）"}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400 mt-1.5">未填發票資料</div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          disabled={busyId === t.id}
                          onClick={() => handleTopup(t.id, true)}
                          className="flex-1 bg-green-600 disabled:bg-gray-300 text-white text-sm py-1.5 rounded-lg"
                        >
                          已收款，加點
                        </button>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => handleTopup(t.id, false)}
                          className="px-4 border border-gray-200 text-gray-500 text-sm py-1.5 rounded-lg"
                        >
                          拒絕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 會員列表 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">
                {activeMap ? `媒合中會員（${activeMembers.length}）` : `會員列表（${members.length}）`}
              </div>
              {activeMembers.length === 0 && <p className="text-xs text-gray-400">目前沒有媒合中的會員</p>}
              <div className="space-y-3">
                {activeMembers.map((m) => (
                  <div key={m.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {m.name}
                          <span className="ml-2 text-xs text-gray-400">
                            {m.role === "sales" ? "業務" : m.role === "vendor" ? "廠商" : "業務+廠商"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{m.email || "（未綁帳號）"}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {fmtDate(m.created_at)}・{m.points} 點・被連繫 {m.unlocked_times} 次
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={busyId === m.id}
                          onClick={() => addPoints(m.id, 100, "管理員贈點")}
                          className="text-xs bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold px-3 py-1.5 rounded-lg"
                        >
                          +100（贈點）
                        </button>
                        <button
                          disabled={busyId === m.id}
                          onClick={() => customAdd(m.id)}
                          className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg"
                        >
                          自訂
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {inactiveMembers.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setShowInactive((v) => !v)}
                    className="text-xs text-gray-500 underline"
                  >
                    {showInactive ? "收起" : "展開"}已停用的檔案（{inactiveMembers.length}）
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1">
                    已停用的檔案不會出現在任何人的媒合名單裡，資料保留供對帳
                  </p>
                  {showInactive && (
                    <div className="space-y-2 mt-3">
                      {inactiveMembers.map((m) => (
                        <div key={m.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50 opacity-70">
                          <div className="text-sm text-gray-700">
                            {m.name}
                            <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">已停用</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{m.email || "（未綁帳號）"}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(m.created_at)}・{m.points} 點・被連繫 {m.unlocked_times} 次
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 會員人脈明細：每筆案件依 縣市 × 產業 × 部門 × 層級 展開 */}
            {detailsReady && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-gray-900">
                    會員人脈明細（共 {details.reduce((n, m) => n + m.seekCount + m.offerCount, 0).toLocaleString()} 筆）
                  </div>
                  {details.length > 0 && (
                    <button onClick={downloadDetails} className="text-xs text-purple-600 underline">
                      下載 CSV
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mb-3">
                  一筆明細 = 一個縣市 × 一個產業 × 一個部門 × 一個層級。填「不限」的項目以全部選項計（縣市 22、產業 9、部門 13、層級 4）
                </p>
                {details.length === 0 ? (
                  <p className="text-xs text-gray-400">還沒有任何會員登錄人脈</p>
                ) : (
                  <div className="space-y-2">
                    {details.map((m) => {
                      const isOpen = openDetail === m.profile_id;
                      const total = m.seekCount + m.offerCount;
                      const rows = isOpen ? sliceRows(m.entries, 0, detailShown) : [];
                      return (
                        <div key={m.profile_id} className="border border-gray-100 rounded-xl overflow-hidden">
                          <button
                            onClick={() => {
                              setOpenDetail(isOpen ? null : m.profile_id);
                              setDetailShown(DETAIL_PAGE);
                            }}
                            className="w-full text-left p-3 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {m.name}
                                {m.company && <span className="text-gray-400 font-normal ml-1">・{m.company}</span>}
                                {!m.is_active && (
                                  <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                                    已停用
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                <span className="text-gold-900">找人脈 {m.seekCount.toLocaleString()} 筆</span>
                                <span className="mx-1 text-gray-300">|</span>
                                <span className="text-purple-600">介紹人脈 {m.offerCount.toLocaleString()} 筆</span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{isOpen ? "收合" : "展開"}</span>
                          </button>
                          {isOpen && (
                            <div className="border-t border-gray-100 bg-gray-50">
                              {/* 會員實際建立的案件（他在表單上填的樣子） */}
                              <div className="p-3 space-y-2">
                                <div className="text-[11px] font-semibold text-gray-500">
                                  會員建立的案件（{m.entries.length} 筆）
                                </div>
                                {m.entries.map((e, i) => (
                                  <div key={i} className="bg-white border border-gray-100 rounded-lg p-2.5 text-xs">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span
                                        className={`font-semibold ${
                                          e.kind === "seek" ? "text-gold-900" : "text-purple-600"
                                        }`}
                                      >
                                        {e.kind === "seek" ? "找人脈" : "介紹人脈"}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        {fmtDate(e.created_at)} 建立・展開為 {e.count.toLocaleString()} 筆
                                      </span>
                                    </div>
                                    <div className="space-y-0.5 text-gray-700 leading-relaxed">
                                      <div>
                                        <span className="text-gray-400">縣市：</span>
                                        {e.raw.regions.length > 0 ? e.raw.regions.join("、") : "不限"}
                                      </div>
                                      <div>
                                        <span className="text-gray-400">產業：</span>
                                        {e.raw.industries.length > 0 ? e.raw.industries.join("、") : "不限"}
                                      </div>
                                      <div>
                                        <span className="text-gray-400">部門：</span>
                                        {e.raw.departments.length > 0 ? e.raw.departments.join("、") : "不限"}
                                      </div>
                                      <div>
                                        <span className="text-gray-400">層級：</span>
                                        {e.raw.level > 0 ? levelLabel(e.raw.level) : "不限"}
                                      </div>
                                      {e.note && (
                                        <div>
                                          <span className="text-gray-400">說明：</span>
                                          {e.note}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                <div className="text-[11px] font-semibold text-gray-500 pt-1">展開明細</div>
                              </div>
                              <div className="overflow-x-auto border-t border-gray-100">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-gray-500">
                                      <th className="px-3 py-2 font-medium whitespace-nowrap">類型</th>
                                      <th className="px-2 py-2 font-medium whitespace-nowrap">縣市</th>
                                      <th className="px-2 py-2 font-medium whitespace-nowrap">產業</th>
                                      <th className="px-2 py-2 font-medium whitespace-nowrap">部門</th>
                                      <th className="px-2 py-2 font-medium whitespace-nowrap">層級</th>
                                      <th className="px-2 py-2 font-medium whitespace-nowrap">說明</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((r, i) => (
                                      <tr key={i} className="border-t border-gray-100 align-top">
                                        <td
                                          className={`px-3 py-1.5 whitespace-nowrap font-medium ${
                                            r.kind === "seek" ? "text-gold-900" : "text-purple-600"
                                          }`}
                                        >
                                          {r.kind === "seek" ? "找" : "介紹"}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">{r.region}</td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">{r.industry}</td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">{r.department}</td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-gray-900">{r.level}</td>
                                        <td className="px-2 py-1.5 text-gray-500 min-w-[120px]">{r.note}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                <span>
                                  顯示前 {Math.min(detailShown, total).toLocaleString()} 筆，共 {total.toLocaleString()} 筆
                                </span>
                                {detailShown < total && (
                                  <button
                                    onClick={() => setDetailShown((n) => n + DETAIL_PAGE * 5)}
                                    className="text-purple-600 underline"
                                  >
                                    再顯示 500 筆
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 推薦紀錄 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">推薦紀錄（{referrals.length}）</div>
              {referrals.length === 0 ? (
                <p className="text-xs text-gray-400">尚無紀錄</p>
              ) : (
                <div className="space-y-2">
                  {referrals.map((r, i) => (
                    <div key={i} className="text-xs border-b border-gray-50 pb-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          <span className="font-medium text-gray-900">{r.referrer}</span> 推薦了{" "}
                          <span className="font-medium text-gray-900">{r.referred}</span>
                        </span>
                        <span className="text-gray-400">{fmtDate(r.created_at)}</span>
                      </div>
                      <div className="flex justify-between mt-0.5 text-gray-400">
                        <span className="truncate">
                          {r.referrer_email || "—"} → {r.referred_email || "—"}
                        </span>
                        <span className={r.awarded ? "text-green-600" : "text-gray-400"}>
                          {r.awarded ? "已發點" : "超過上限未發點"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 解鎖流水 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">立即連繫紀錄（近 100 筆）</div>
              {unlockLogs.length === 0 ? (
                <p className="text-xs text-gray-400">尚無紀錄</p>
              ) : (
                <div className="space-y-1.5">
                  {unlockLogs.map((u, i) => (
                    <div key={i} className="text-xs text-gray-600 flex justify-between border-b border-gray-50 pb-1.5">
                      <span>
                        <span className="font-medium">{u.unlocker_name}</span> 連繫了{" "}
                        <span className="font-medium">{u.target_name}</span>
                      </span>
                      <span className="text-gray-400">{fmtDate(u.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
