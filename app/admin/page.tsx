"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAll() {
    const [ov, mem, ul, tp] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.rpc("admin_members"),
      supabase.rpc("admin_unlock_logs"),
      supabase.rpc("admin_topup_requests"),
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
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
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

  const recentDays = overview ? overview.daily.slice(-14) : [];
  const maxCount = Math.max(1, ...recentDays.map((d) => d.count));

  return (
    <main className="min-h-screen bg-purple-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-900 rounded-full flex items-center justify-center text-gold-400 font-bold text-sm">
              EK
            </div>
            <span className="text-lg font-bold text-purple-900">ExKey 管理後台</span>
          </div>
          <button onClick={() => router.push("/member")} className="text-sm text-gray-500 underline">
            回會員專區
          </button>
        </div>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}

        {!loading && denied && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center text-gray-600">
            此頁僅限管理員使用
          </div>
        )}

        {!loading && !denied && overview && (
          <div className="space-y-6">
            {/* 總覽 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-purple-600">{overview.total_members}</div>
                <div className="text-xs text-gray-400 mt-1">總會員數</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-gold-900">{overview.total_unlocks}</div>
                <div className="text-xs text-gray-400 mt-1">累計解鎖次數</div>
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
                      <div className="text-[10px] text-gray-500 mb-0.5">{d.count}</div>
                      <div
                        className="w-full bg-purple-600 rounded-t"
                        style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: "3px" }}
                      />
                      <div className="text-[9px] text-gray-400 mt-1">{d.day.slice(5)}</div>
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
              <div className="text-sm font-semibold text-gray-900 mb-3">會員列表（{members.length}）</div>
              <div className="space-y-3">
                {members.map((m) => (
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
                          {fmtDate(m.created_at)}・{m.points} 點・被解鎖 {m.unlocked_times} 次
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={busyId === m.id}
                          onClick={() => addPoints(m.id, 100, "儲值 NT$500")}
                          className="text-xs bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold px-3 py-1.5 rounded-lg"
                        >
                          +100（儲值）
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
            </div>

            {/* 解鎖流水 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">解鎖紀錄（近 100 筆）</div>
              {unlockLogs.length === 0 ? (
                <p className="text-xs text-gray-400">尚無紀錄</p>
              ) : (
                <div className="space-y-1.5">
                  {unlockLogs.map((u, i) => (
                    <div key={i} className="text-xs text-gray-600 flex justify-between border-b border-gray-50 pb-1.5">
                      <span>
                        <span className="font-medium">{u.unlocker_name}</span> 解鎖了{" "}
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
