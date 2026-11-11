import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, Upload, ShieldCheck, Database } from "lucide-react";
import { toast } from "sonner";
import { exportLocalBackup, importLocalBackup } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/backup")({ component: BackupPage });

function BackupPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function exportData() {
    setBusy(true);
    try {
      const json = await exportLocalBackup();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "gestorbot-backup-" + new Date().toISOString().slice(0,10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado com sucesso.");
    } catch (e:any) { toast.error(e?.message || "Não foi possível exportar."); }
    finally { setBusy(false); }
  }
  async function importData(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const result = await importLocalBackup(text);
      toast.success("Backup importado: " + result.records + " registros em " + result.tables + " tabelas.");
      setTimeout(() => window.location.reload(), 700);
    } catch (e:any) { toast.error(e?.message || "Arquivo de backup inválido."); }
    finally { setBusy(false); if(inputRef.current) inputRef.current.value=""; }
  }
  return <div className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-10 lg:p-8">
    <div><h1 className="text-2xl font-bold tracking-tight">Backup e restauração</h1><p className="mt-1 text-sm text-muted-foreground">Seus dados ficam salvos neste aparelho. Faça cópias periódicas para não perdê-los.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="rounded-2xl"><CardHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Download /></div><CardTitle>Exportar backup</CardTitle><CardDescription>Baixe clientes, planos, movimentações, configurações e demais registros em um arquivo JSON.</CardDescription></CardHeader><CardContent><Button className="w-full rounded-xl" onClick={exportData} disabled={busy}><Download className="mr-2 h-4 w-4"/>Baixar backup</Button></CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload /></div><CardTitle>Importar backup</CardTitle><CardDescription>Restaure um arquivo JSON do Gestorbot. A importação substitui os dados locais atuais.</CardDescription></CardHeader><CardContent><input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={e=>void importData(e.target.files?.[0])}/><Button variant="outline" className="w-full rounded-xl" onClick={()=>inputRef.current?.click()} disabled={busy}><Upload className="mr-2 h-4 w-4"/>Selecionar arquivo</Button></CardContent></Card>
    </div>
    <Card className="rounded-2xl border-primary/20"><CardContent className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><div><p className="font-semibold">Armazenamento neste aparelho</p><p className="mt-1 text-sm text-muted-foreground">A versão local não envia seus cadastros para o Supabase. Limpar os dados do navegador ou desinstalar o aplicativo pode apagar os registros; mantenha um backup fora do aparelho.</p></div></CardContent></Card>
  </div>;
}
