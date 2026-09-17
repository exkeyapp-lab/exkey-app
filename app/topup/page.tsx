"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

// ===== 匯款資訊：上線前把下面三個值換成真實資料 =====
const BANK_NAME = "（請填銀行名稱與代碼）";
const BANK_ACCOUNT = "（請填帳號）";
const BANK_HOLDER = "（請填戶名）";

const PACK_POINTS = 100;
const PACK_PRICE = 500;

interface TopupRow {
  id: string;
  amount_ntd: number;
  bank_last5: string | null;
  status: string;
  created_at: string;
}

function statusLabel(s: string): string {
  if (s === "pending") return "待確認";
  if (s === "approved") return "已入點";
  if (s === "rejected") return "未核准";
  return s;
}

export default function Topup() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [last5, setLast5] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<TopupRow[]>([]);

  async function loadHistory() {
    const { data } = await supabase.rpc("my_topup_requests");
    if (Array.isArray(data)) setHistory(data as TopupRow[]);
  }

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: wallet } = await supabase.rpc("get_my_wallet");
      if (wallet && typeof wallet.points === "number") setPoints(wallet.points);
      await loadHistory();
      setLoading(false);
    }
    init();
  }, []);

  const amount = qty * PACK_PRICE;
  const canSubmit = agreed && /^\d{5}$/.test(last5) && !busy;

  async function handleSubmit() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("request_topup", {
      p_amount_ntd: amount,
      p_bank_last5: last5,
    });
    setBusy(false);
    if (err) {
      if (err.message.includes("TOO_MANY_PENDING")) {
        setError("你已有多筆待確認的申請，請等管理員處理後再送新的");
      } else if (err.message.includes("BAD_LAST5")) {
        setError("請輸入匯款帳號的末五碼（5 位數字）");
      } else {
        setError("送出失敗：" + err.message);
      }
      return;
    }
    setDone(true);
    setLast5("");
    setAgreed(false);
    loadHistory();
  }

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
          <button onClick={() => router.push("/member")} className="text-sm text-gray-500 underline">
            回會員專區
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">加值點數</h1>
        <p className="text-sm text-gray-500 mb-6">
          {points != null ? `目前餘額 ${points} 點` : "解鎖聯絡方式需要點數"}
        </p>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}

        {!loading && (
          <div className="space-y-4">
            {/* 方案卡 */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 text-white p-5 shadow-lg">
              <div className="text-xs text-purple-100 mb-1">點數方案</div>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-bold text-gold-400">{PACK_POINTS}</div>
                <div className="text-lg mb-1">點</div>
                <div className="ml-auto text-2xl font-semibold">NT${PACK_PRICE}</div>
              </div>
              <div className="text-sm text-purple-100 mt-2">可解鎖 {PACK_POINTS / 10} 位合作對象的聯絡方式・點數無使用期限</div>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm">數量</span>
                <div className="flex items-center bg-white bg-opacity-10 rounded-lg">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-1 text-lg"
                  >
                    −
                  </button>
                  <span className="px-3 font-semibold">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(5, q + 1))}
                    className="px-3 py-1 text-lg"
                  >
                    ＋
                  </button>
                </div>
                <span className="ml-auto text-sm">
                  共 <span className="font-bold text-gold-400">{qty * PACK_POINTS}</span> 點・
                  <span className="font-bold">NT${amount}</span>
                </span>
              </div>
            </div>

            {/* 匯款資訊 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">步驟一：匯款 NT${amount}</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">銀行</span>
                  <span className="font-medium text-gray-900">{BANK_NAME}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">帳號</span>
                  <span className="font-medium text-gray-900 tracking-wide">{BANK_ACCOUNT}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">戶名</span>
                  <span className="font-medium text-gray-900">{BANK_HOLDER}</span>
                </div>
              </div>
            </div>

            {/* 回報表單 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">步驟二：回報匯款</div>
              {done ? (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-800 mb-1">已收到你的回報</p>
                  <p className="text-xs text-gray-500 mb-3">管理員確認入帳後，點數會直接加進你的帳戶</p>
                  <button onClick={() => setDone(false)} className="text-xs text-purple-600 underline">
                    再送一筆
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">你匯款帳號的末五碼</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={last5}
                      onChange={(e) => setLast5(e.target.value.replace(/\D/g, ""))}
                      placeholder="例：12345"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none tracking-widest"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      我已閱讀並同意服務條款，包含點數退費規定：購買後 7 日內且未使用可申請退費，點數一經使用即不予退費。
                    </span>
                  </label>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                    className="w-full bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold py-3 rounded-xl"
                  >
                    {busy ? "送出中..." : `我已匯款 NT$${amount}，通知管理員`}
                  </button>
                </div>
              )}
            </div>

            {/* 申請紀錄 */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 mb-3">我的加值紀錄</div>
                <div className="space-y-1.5">
                  {history.map((h) => (
                    <div key={h.id} className="flex justify-between text-xs border-b border-gray-50 pb-1.5">
                      <span className="text-gray-600">
                        NT${h.amount_ntd}・末五碼 {h.bank_last5 || "—"}・{h.created_at.slice(0, 10)}
                      </span>
                      <span
                        className={
                          h.status === "approved"
                            ? "text-green-600 font-medium"
                            : h.status === "rejected"
                            ? "text-gray-400"
                            : "text-gold-900 font-medium"
                        }
                      >
                        {statusLabel(h.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
