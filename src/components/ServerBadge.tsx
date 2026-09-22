import { cn } from "@/lib/utils";

const STYLES: { match: RegExp; cls: string }[] = [
  { match: /uniplay/i, cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  { match: /goat/i, cls: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  { match: /p2braz/i, cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
];

const SERVER_PANELS: { match: RegExp; url: string }[] = [
  { match: /uniplay/i, url: "https://searchdefense.top/#/login" },
  { match: /goat/i, url: "https://goatnt.com/" },
  { match: /p2\s*bra[sz]/i, url: "https://painel.fun/lock?redirect=%2Fusers" },
];

const DEFAULT_CLS = "bg-muted text-muted-foreground border-border";

function classFor(name: string): string {
  const found = STYLES.find((s) => s.match.test(name));
  return found ? found.cls : DEFAULT_CLS;
}

function panelFor(name: string): string | undefined {
  return SERVER_PANELS.find((server) => server.match.test(name))?.url;
}

/**
 * Renderiza um badge pílula colorido para o nome de um servidor.
 * Os servidores com painel conhecido funcionam também como atalhos.
 * Aceita uma string única ou múltiplos nomes separados por vírgula.
 */
export function ServerBadge({ name, className }: { name: string; className?: string }) {
  if (!name || name === "N/A" || name === "Painel") {
    return (
      <span
        className={cn(
          "px-2 py-0.5 text-[11px] rounded-full font-semibold inline-block border",
          DEFAULT_CLS,
          className
        )}
      >
        {name || "N/A"}
      </span>
    );
  }

  const names = name.split(",").map((n) => n.trim()).filter(Boolean);

  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {names.map((n, i) => {
        const panelUrl = panelFor(n);
        const badgeClass = cn(
          "px-2 py-0.5 text-[11px] rounded-full font-semibold inline-block border",
          classFor(n),
          panelUrl && "cursor-pointer hover:brightness-110 active:scale-[0.98] transition"
        );

        return panelUrl ? (
          <a
            key={i}
            href={panelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={badgeClass}
            title={`Abrir painel ${n}`}
            onClick={(event) => event.stopPropagation()}
          >
            {n}
          </a>
        ) : (
          <span key={i} className={badgeClass}>{n}</span>
        );
      })}
    </span>
  );
}
