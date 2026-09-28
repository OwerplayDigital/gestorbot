import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Bridge = { getToken?: () => unknown };

function showDiagnostic(message: string, ok = false) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("owerapps-push-diagnostic");
  if (!el) {
    el = document.createElement("div");
    el.id = "owerapps-push-diagnostic";
    Object.assign(el.style, {
      position: "fixed",
      left: "12px",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483647",
      padding: "10px 12px",
      borderRadius: "12px",
      fontSize: "12px",
      fontFamily: "sans-serif",
      lineHeight: "1.35",
      color: "#fff",
      boxShadow: "0 4px 18px rgba(0,0,0,.25)",
    });
    document.body.appendChild(el);
  }
  el.style.background = ok ? "#166534" : "#991b1b";
  el.textContent = "Push diagnóstico: " + message;
}

async function saveToken(raw: unknown) {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    showDiagnostic("ponte Android OK · token FCM vazio");
    return;
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    showDiagnostic("token OK · erro ao ler sessão: " + sessionError.message);
    return;
  }

  const userId = data.session?.user?.id;
  if (!userId) {
    showDiagnostic("token OK · sessão sem usuário");
    return;
  }

  const { error } = await (supabase as any)
    .from("push_tokens")
    .upsert(
      { user_id: userId, token, platform: "android", updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );

  if (error) {
    console.warn("push_tokens upsert:", error.message);
    showDiagnostic("ponte OK · token OK · sessão OK · Supabase ERRO: " + error.message);
    return;
  }

  showDiagnostic("ponte OK · token OK · sessão OK · Supabase OK", true);
}

async function readBridge() {
  try {
    const bridge = (window as unknown as { OwerAppsNotifications?: Bridge }).OwerAppsNotifications;
    if (!bridge?.getToken) return;
    showDiagnostic("ponte Android encontrada · lendo token...");
    await saveToken(await bridge.getToken());
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    showDiagnostic("erro na ponte Android: " + message);
  }
}

export function usePushToken() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const bridge = (window as unknown as { OwerAppsNotifications?: Bridge }).OwerAppsNotifications;
    if (bridge?.getToken) showDiagnostic("ponte Android encontrada · iniciando teste");

    const onToken = (e: Event) => {
      showDiagnostic("evento FCM recebido · validando...");
      void saveToken((e as CustomEvent).detail).catch((error) => {
        const message = error instanceof Error ? error.message : "erro desconhecido";
        showDiagnostic("falha inesperada: " + message);
      });
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
      document.getElementById("owerapps-push-diagnostic")?.remove();
    };
  }, []);
}
