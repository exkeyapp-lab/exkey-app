import { createBrowserClient } from "@supabase/ssr";

// 建立瀏覽器端的 Supabase 連線
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
