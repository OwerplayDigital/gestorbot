import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, StickyNote, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ClientResult = {
  id: string;
  nome: string;
  whatsapp: string | null;
  vencimento: string | null;
};

function normalizeDate(value: string | null) {
  if (!value) return "";
  return value.includes("/") ? value.split("/").reverse().join("-") : value.slice(0, 10);
}

function isExpired(client: ClientResult) {
  const vencimento = normalizeDate(client.vencimento);
  if (!vencimento) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return vencimento < today;
}

function filterExpiredClientInView(name: string) {
  const normalizedName = name.trim().toLowerCase();
  let attempts = 0;
  const applyFilter = () => {
    attempts += 1;
    const rows = Array.from(document.querySelectorAll("tbody tr")) as HTMLElement[];
    const mobileCards = Array.from(document.querySelectorAll(".md\\:hidden.space-y-4 > div")) as HTMLElement[];
    const items = [...rows, ...mobileCards];
    if (!items.length && attempts < 12) { window.setTimeout(applyFilter, 100); return; }
    items.forEach((item) => { const text = (item.textContent || "").toLowerCase(); item.style.display = text.includes(normalizedName) ? "" : "none"; });
  };
  window.setTimeout(applyFilter, 100);
}

export function GlobalClientSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteClient, setNoteClient] = useState<ClientResult | null>(null);
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (!open) { setTerm(""); setResults([]); setLoading(false); return; }
    const query = term.trim();
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.from("clientes").select("id, nome, whatsapp, vencimento").ilike("nome", `%${query}%`).order("nome").limit(8);
      setResults((data || []) as ClientResult[]);
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [term, open]);

  async function selectClient(client: ClientResult) {
    (document.activeElement as HTMLElement | null)?.blur();
    setOpen(false);
    if (isExpired(client)) { await navigate({ to: "/vencidos" }); filterExpiredClientInView(client.nome); return; }
    await navigate({ to: "/clientes" });
    window.setTimeout(() => {
      const input = document.querySelector('input[placeholder="Buscar por nome..."]') as HTMLInputElement | null;
      if (!input) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, client.nome);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.blur();
    }, 100);
  }

  async function openNote(client: ClientResult) {
    setNoteClient(client);
    setNote("");
    setNoteLoading(true);
    const { data, error } = await supabase.from("client_notes" as any).select("nota").eq("cliente_id", client.id).maybeSingle();
    if (!error && data) setNote(String((data as any).nota || ""));
    setNoteLoading(false);
  }

  async function saveNote() {
    if (!noteClient || noteSaving) return;
    setNoteSaving(true);
    const text = note.trim();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) { setNoteSaving(false); return; }
    const { error } = text
      ? await supabase.from("client_notes" as any).upsert({ user_id: userId, cliente_id: noteClient.id, nota: text, updated_at: new Date().toISOString() }, { onConflict: "cliente_id" })
      : await supabase.from("client_notes" as any).delete().eq("cliente_id", noteClient.id);
    setNoteSaving(false);
    if (!error) setNoteClient(null);
  }

  return <>
    <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="rounded-xl border border-border bg-card/50" aria-label="Buscar cliente" title="Buscar cliente"><Search className="h-[1.2rem] w-[1.2rem]" /></Button>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Buscar cliente</DialogTitle></DialogHeader>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Digite o nome do cliente" className="pl-9" /></div>
      <div className="max-h-72 overflow-y-auto">
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>}
        {!loading && term.trim().length >= 2 && results.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>}
        {!loading && results.map((client) => <div key={client.id} className="flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-muted">
          <button type="button" onClick={() => void selectClient(client)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-foreground">{client.nome}</div>{client.whatsapp && <div className="truncate text-xs text-muted-foreground">{client.whatsapp}</div>}</div>
            {isExpired(client) && <span className="shrink-0 text-[10px] font-semibold uppercase text-rose-500">Vencido</span>}
          </button>
          <Button type="button" size="icon" variant="ghost" onClick={() => void openNote(client)} className="h-9 w-9 shrink-0 rounded-lg" title={`Observação de ${client.nome}`} aria-label={`Observação de ${client.nome}`}><StickyNote className="h-4 w-4" /></Button>
        </div>)}
      </div>
    </DialogContent></Dialog>

    <Dialog open={!!noteClient} onOpenChange={(value) => { if (!value) setNoteClient(null); }}><DialogContent className="sm:max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}><DialogHeader><DialogTitle>Observação</DialogTitle><DialogDescription>{noteClient?.nome}</DialogDescription></DialogHeader>
      {noteLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div> : <div className="space-y-3"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escreva uma observação sobre este cliente..." className="min-h-32 w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setNoteClient(null)}>Cancelar</Button><Button disabled={noteSaving} onClick={() => void saveNote()}>{noteSaving ? "Salvando..." : "Salvar"}</Button></div></div>}
    </DialogContent></Dialog>
  </>;
}
