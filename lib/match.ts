// ==================== 人脈明細與媒合（全站共用） ====================
// 一筆案件展開成明細：一筆 = 一個縣市 × 一個產業 × 一個部門 × 一個層級。
// 某一項沒選（不限）就是該項全部選項都算。
//
// 媒合規則（11/23 會議）：沒有「符合度」，只有連得上和連不上。
// 我的一筆「找人脈」明細，和對方的一筆「介紹人脈」明細，四個項目都對得上才算連上一筆。
// 層級是「以上」的意思：我找經理級，對方能介紹經理級或更高的都算。

import { REGIONS, INDUSTRIES, DEPARTMENTS, JOB_LEVELS, levelLabel, type NetworkEntry } from "./types";

export interface DetailRow {
  region: string;
  industry: string;
  department: string;
  level: string;
}

// 一組展開前的四個清單，筆數 = 四個清單長度相乘
export interface Axes {
  regions: string[];
  industries: string[];
  departments: string[];
  levels: string[];
  count: number;
}

const ALL_LEVEL_VALUES = JOB_LEVELS.map((l) => l.value).sort((a, b) => a - b); // [1,2,3,4]

function makeAxes(regions: string[], industries: string[], departments: string[], levels: string[]): Axes {
  return {
    regions,
    industries,
    departments,
    levels,
    count: regions.length * industries.length * departments.length * levels.length,
  };
}

// 一筆案件自己的明細
export function entryAxes(e: NetworkEntry): Axes {
  return makeAxes(
    e.regions && e.regions.length > 0 ? e.regions : REGIONS,
    e.industries && e.industries.length > 0 ? e.industries : INDUSTRIES,
    e.departments && e.departments.length > 0 ? e.departments : DEPARTMENTS,
    e.level && e.level > 0 ? [levelLabel(e.level)] : ALL_LEVEL_VALUES.map((v) => levelLabel(v))
  );
}

export function entryCount(e: NetworkEntry): number {
  return entryAxes(e).count;
}

// 兩邊清單對得上的項目。空清單 = 不限：不限對上什麼都算
function overlap(a: string[] | null, b: string[] | null, all: string[]): string[] {
  const x = a || [];
  const y = b || [];
  if (x.length === 0 && y.length === 0) return all;
  if (x.length === 0) return y;
  if (y.length === 0) return x;
  return x.filter((v) => y.includes(v));
}

// 層級：找的一方是門檻（該層級以上），介紹的一方是他認識的人實際在哪一層
function levelOverlap(seekLevel: number, offerLevel: number): string[] {
  const s = seekLevel || 0;
  const o = offerLevel || 0;
  if (s === 0 && o === 0) return ALL_LEVEL_VALUES.map((v) => levelLabel(v));
  if (o === 0) return [levelLabel(s)];
  if (s === 0) return [levelLabel(o)];
  return o >= s ? [levelLabel(o)] : [];
}

// 一筆「找人脈」和一筆「介紹人脈」連上的明細（count 為 0 就是沒連上）
export function matchAxes(seek: NetworkEntry, offer: NetworkEntry): Axes {
  return makeAxes(
    overlap(seek.regions, offer.regions, REGIONS),
    overlap(seek.industries, offer.industries, INDUSTRIES),
    overlap(seek.departments, offer.departments, DEPARTMENTS),
    levelOverlap(seek.level, offer.level)
  );
}

// a 的每一筆是不是都已經包含在 b 裡面
function coveredBy(a: Axes, b: Axes): boolean {
  const sub = (x: string[], y: string[]) => x.every((v) => y.includes(v));
  return (
    sub(a.regions, b.regions) &&
    sub(a.industries, b.industries) &&
    sub(a.departments, b.departments) &&
    sub(a.levels, b.levels)
  );
}

// 一方的所有找人脈 × 另一方的所有介紹人脈，回傳有連上的每一組。
// 同一批明細被兩筆案件重複連到時只算一次（例如一筆全部不限的案件，會蓋過另一筆條件較窄的）
export function matchAll(seeks: NetworkEntry[], offers: NetworkEntry[]): Axes[] {
  let out: Axes[] = [];
  for (const s of seeks) {
    for (const o of offers) {
      const ax = matchAxes(s, o);
      if (ax.count === 0) continue;
      if (out.some((x) => coveredBy(ax, x))) continue;
      out = out.filter((x) => !coveredBy(x, ax));
      out.push(ax);
    }
  }
  return out;
}

export function totalCount(list: Axes[]): number {
  return list.reduce((n, a) => n + a.count, 0);
}

// 從一串明細組裡取出第 from 筆起的 limit 筆（筆數可能上萬，不一次全部生出來）
export function sliceRows(list: Axes[], from: number, limit: number): DetailRow[] {
  const out: DetailRow[] = [];
  let skipped = 0;
  for (const a of list) {
    if (skipped + a.count <= from) {
      skipped += a.count;
      continue;
    }
    for (const region of a.regions)
      for (const industry of a.industries)
        for (const department of a.departments)
          for (const level of a.levels) {
            if (skipped < from) {
              skipped++;
              continue;
            }
            if (out.length >= limit) return out;
            out.push({ region, industry, department, level });
          }
  }
  return out;
}

// 一筆案件寫成一句話（會員專區與後台顯示用）
export function entrySummary(e: NetworkEntry): string {
  const part = (list: string[] | null, unit: string) =>
    list && list.length > 0 ? list.join("、") : `不限${unit}`;
  return [
    part(e.industries, "產業"),
    part(e.regions, "縣市"),
    part(e.departments, "部門"),
    e.level && e.level > 0 ? `${levelLabel(e.level)}` : "不限層級",
  ].join("｜");
}
