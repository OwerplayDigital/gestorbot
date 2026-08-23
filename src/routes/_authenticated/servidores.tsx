import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/servidores")({
  component: ServidoresPage,
});

function ServidoresPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 pb-12 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Revendedores</h1>
        </div>
        <Button className="rounded-xl font-bold gap-2">
          <Plus size={18} />
          Cadastrar Revendedor
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center py-20 bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl shadow-sm text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-black tracking-tight text-foreground uppercase mb-2">Nenhum revendedor encontrado</h3>
      </div>
    </div>
  );
}
