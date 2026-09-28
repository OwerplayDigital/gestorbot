import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Bridge = { getToken?: () => unknown };

async function saveToken(raw: unknown) {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) return;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return;

  const { error } = await (supabase as any)
    .from("push_tokens")
    .upsert(
      { user_id: userId, token, platform: "android", updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );

  if (error) console.warn("push_tokens upsert:", error.message);
}

async function readBridge() {
  try {
    const bridge = (window as unknown as { OwerAppsNotifications?: Bridge }).OwerAppsNotifications;
    if (!bridge?.getToken) return;
    await saveToken(await bridge.getToken());
  } catch {
    /* navegador comum ou ponte indisponível */
  }
}

export function usePushToken() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onToken = (e: Event) => {
      void saveToken((e as CustomEvent).detail).catch(() => {});
    };

    window.addEventListener("owerapps-fcm-token", onToken);
    void readBridge();
    const t1 = window.setTimeout(readBridge, 3000);
    const t2 = window.setTimeout(readBridge, 10000);
    const t3 = window.setTimeout(readBridge, 30000);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") void readBridge();
    });

    return () => {
      window.removeEventListener("owerapps-fcm-token", onToken);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      sub.subscription.unsubscribe();
    };
  }, []);
}
