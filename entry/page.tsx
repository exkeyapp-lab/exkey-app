"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  INDUSTRIES,
  REGIONS,
  DEPARTMENTS,
  JOB_LEVELS,
  ENTRY_COLUMNS,
  type EntryKind,
  type NetworkEntry,
  type NetworkSide,
  emptyNetworkSide,
  entryToSide,
  sideToPayload,
  kindLabel,
} from "@/lib/types";

// 一頁式的人脈案件編輯：新增或修改一筆「找人脈」或「介紹人脈」
// 網址：/entry?kind=seek（新增找人脈）、/entry?kind=offer（新增介紹人脈）、/entry?id=xxx（修改）

function ChipGroup({
  title,
  hint,
  options,
  selected,
  onChange,
  extra,
}: {
  title: string;
  hint: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  extra?: React.ReactNode;
}) {
  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm font-bold text-gray-900">{title}</div>
        <div className="text-[11px] text-gray-400">{selected.length === 0 ? "不限" : `已選 ${selected.length} 項`}</div>
      </div>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange([])}
          className={`px-3.5 py-1.5 rounded-full text-sm transition ${
            selected.length === 0 ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"
          }`}
        >
          不限
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-3.5 py-1.5 rounded-full text-sm transition ${
              selected.includes(opt) ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {extra}
    </div>
  );
}

export default function EntryEditor() {
  const router = useRouter();
  const supabase = createClient();
  const [kind, setKind] = useState<EntryKind>("seek");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [side, setSide] = useState<NetworkSide>(emptyNetworkSide());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const k = params.get("kind");
      if (k === "seek" || k === "offer") setKind(k);

      if (id) {
        const { data, error: err } = await supabase
          .from("network_entries")
          .select(ENTRY_COLUMNS)
          .eq("id", id)
          .limit(1);
        if (err || !data || data.length === 0) {
          setError("找不到這筆案件，可能已被刪除");
          setLoading(false);
          return;
        }
        const e = data[0] as unknown as NetworkEntry;
        setEntryId(e.id);
        setKind(e.kind);
        setSide(entryToSide(e));
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.rpc("save_entry", { p: sideToPayload(kind, side, entryId) });
    setSaving(false);
    if (err) {
      if (err.message.includes("NO_PROFILE")) setError("請先完成基本資料建檔");
      else if (err.message.includes("TOO_MANY")) setError("案件數已達上限（20 筆），請先刪除不用的");
      else if (err.message.includes("NOT_FOUND")) setError("找不到這筆案件，可能已被刪除");
      else setError("儲存失敗：" + err.message);
      return;
    }
    router.push("/member");
  }

  async function handleDelete() {
    if (!entryId) return;
    if (!window.confirm("確定刪除這筆案件？刪除後就不會再依這筆條件媒合。")) return;
    setSaving(true);
    const { error: err } = await supabase.rpc("delete_entry", { p_id: entryId });
    setSaving(false);
    if (err) {
      setError("刪除失敗：" + err.message);
      return;
    }
    router.push("/member");
  }

  const isSeek = kind === "seek";
  const tone = isSeek ? "text-gold-900" : "text-purple-600";
  const bar = isSeek ? "bg-gold-600" : "bg-purple-600";

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
            取消
          </button>
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className={`w-1.5 h-7 rounded-full ${bar}`} />
          <h1 className="text-2xl font-bold text-gray-900">
            {entryId ? "修改" : "新增"}
            <span className={`ml-1 ${tone}`}>{kindLabel(kind)}</span>
          </h1>
        </div>
        <p className="text-sm text-gray-500 mb-5 pl-[18px]">
          {isSeek
            ? "描述你想認識的關鍵人脈。每個條件都可以選「不限」，不限會配到所有人"
            : "描述你能介紹的關鍵人脈。不用寫對方的名字，只要說明是哪一類的人"}
        </p>

        {loading && <div className="text-center py-12 text-gray-400">載入中...</div>}

        {!loading && (
          <div className="space-y-4">
            {!entryId && (
              <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm flex gap-2">
                <button
                  onClick={() => setKind("seek")}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                    isSeek ? "bg-gold-600 text-purple-900" : "text-gray-500"
                  }`}
                >
                  找人脈
                </button>
                <button
                  onClick={() => setKind("offer")}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                    !isSeek ? "bg-purple-600 text-white" : "text-gray-500"
                  }`}
                >
                  介紹人脈
                </button>
              </div>
            )}

            <ChipGroup
              title="產業"
              hint={isSeek ? "想認識哪些產業的人脈？" : "你認識的人脈屬於哪些產業？"}
              options={INDUSTRIES}
              selected={side.industries}
              onChange={(v) => setSide((s) => ({ ...s, industries: v }))}
            />
            <ChipGroup
              title="地區"
              hint={isSeek ? "想認識哪些地區的人脈？" : "你認識的人脈在哪些地區？"}
              options={REGIONS}
              selected={side.regions}
              onChange={(v) => setSide((s) => ({ ...s, regions: v }))}
            />
            <ChipGroup
              title="部門"
              hint={isSeek ? "想認識對方公司裡的哪個部門？" : "你認識的人脈在對方公司的哪個部門？"}
              options={DEPARTMENTS}
              selected={side.departments}
              onChange={(v) => setSide((s) => ({ ...s, departments: v }))}
              extra={
                <input
                  type="text"
                  value={side.customDepartment}
                  onChange={(e) => setSide((s) => ({ ...s, customDepartment: e.target.value }))}
                  placeholder="其他部門（選填，自行輸入）"
                  className="w-full mt-3 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-600 outline-none text-sm"
                />
              }
            />

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-bold text-gray-900 mb-1">層級</div>
              <p className="text-xs text-gray-400 mb-3">
                {isSeek ? "想認識哪個層級的人脈？選了之後，該層級以上都算符合" : "你認識的人脈層級大概到哪？"}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setSide((s) => ({ ...s, level: 0 }))}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    side.level === 0 ? "border-purple-600 bg-purple-100" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-sm">不限</div>
                  <div className="text-xs text-gray-500">不確定或不設門檻</div>
                </button>
                {JOB_LEVELS.map((lv) => (
                  <button
                    key={lv.value}
                    onClick={() => setSide((s) => ({ ...s, level: lv.value }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      side.level === lv.value ? "border-purple-600 bg-purple-100" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-gray-900 text-sm">{lv.label}</div>
                    <div className="text-xs text-gray-500">{lv.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-sm font-bold text-gray-900 mb-1">補充說明（選填）</div>
              <p className="text-xs text-gray-400 mb-2">上面的選項不夠用時，這裡可以自由寫，其他會員看得到。不要寫第三人的姓名或聯絡方式</p>
              <textarea
                value={side.note}
                onChange={(e) => setSide((s) => ({ ...s, note: e.target.value }))}
                placeholder={
                  isSeek
                    ? "例：想找竹科半導體廠的設備採購決策者"
                    : "例：認識幾位化工廠的廠務主管，可介紹純水、廢水設備需求"
                }
                rows={3}
                maxLength={200}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-600 outline-none text-sm resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{side.note.length} / 200</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              disabled={saving}
              onClick={handleSave}
              className="w-full bg-gold-600 disabled:bg-gray-300 text-purple-900 font-semibold py-3.5 rounded-xl shadow-sm"
            >
              {saving ? "儲存中..." : entryId ? "儲存變更" : `新增這筆${kindLabel(kind)}`}
            </button>

            {entryId && (
              <button
                disabled={saving}
                onClick={handleDelete}
                className="w-full text-sm text-red-500 underline py-2 disabled:opacity-50"
              >
                刪除這筆案件
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
