import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ClientResult = {
  id: string;
  nome: string;
  whatsapp: string | null;
  vencimento: string | null;
};

export function GlobalClientSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setResults([]);
      setLoading(false);
      return;
    }

    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, whatsapp, vencimento")
        .ilike("nome", `%${query}%`)
        .order("nome")
        .limit(8);
      setResults((data || []) as ClientResult[]);
      setLoading(false);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [term, open]);

  async function selectClient(client: ClientResult) {
    setOpen(false);
    await navigate({ to: "/clientes" });

    window.setTimeout(() => {
      const input = document.querySelector('input[placeholder="Buscar por nome..."]') as HTMLInputElement | null;
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, client.nome);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }, 100);
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="rounded-xl border border-border bg-card/50" aria-label="Buscar cliente" title="Buscar cliente">
        <Search className="h-[1.2rem] w-[1.2rem]" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Buscar cliente</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Digite o nome do cliente" className="pl-9" />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading && <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>}
            {!loading && term.trim().length >= 2 && results.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>}
            {!loading && results.map((client) => (
              <button key={client.id} type="button" onClick={() => void selectClient(client)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{client.nome}</div>
                  {client.whatsapp && <div className="truncate text-xs text-muted-foreground">{client.whatsapp}</div>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
