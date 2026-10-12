import { ChevronDown } from 'lucide-react';

type ServerOption = { id: string; name: string };
type Props = { options: ServerOption[]; value: string[]; onChange: (value: string[]) => void };

export function ServerSelector({ options, value, onChange }: Props) {
  const names = value.map(id => options.find(option => option.id === id)?.name || 'Servidor indisponível');
  const summary = names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : '') : 'Selecionar';
  return <details className="group rounded-xl border bg-background">
    <summary aria-label={`Servidores: ${names.join(', ') || 'nenhum selecionado'}`} title={names.join(', ')} className="flex h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <span className="truncate">{summary}</span><ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="max-h-48 overflow-y-auto border-t p-2">
      {options.map(option => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted/50">
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary" checked={value.includes(option.id)} onChange={event => onChange(event.target.checked ? [...value, option.id] : value.filter(id => id !== option.id))} />
        <span className="break-words">{option.name}</span>
      </label>)}
      {!options.length && <p className="px-2 py-3 text-sm text-muted-foreground">Sem servidores</p>}
    </div>
  </details>;
}
