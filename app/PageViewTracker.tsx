"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";

// 每次換頁時向伺服器記一筆瀏覽（只記路徑與時間，不記個人資料）
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const supabase = createClient();
    supabase.rpc("log_page_view", { p_path: pathname }).then(() => {});
  }, [pathname]);

  return null;
}
