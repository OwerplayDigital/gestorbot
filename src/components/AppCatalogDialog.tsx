import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeAppName, type AppDefinition } from '@/lib/client-apps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AppIcon } from '@/components/AppIcon';
import { toast } from 'sonner';

export function AppCatalogDialog({ catalog }: { catalog: AppDefinition[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  useEffect(() => {
    const url = iconFile ? URL.createObjectURL(iconFile) : '';
    setIcon(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [iconFile]);
  const [panel, setPanel] = useState('');
  const [saving, setSaving] = useState(false);
  async function readIcon(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 300000) { toast.error('Escolha uma imagem PNG, JPG ou WebP de até 300 KB.'); return; }
    setIconFile(file);
  }
  async function save() {
    if (saving) return;
    const nome = name.trim().replace(/\s+/g, ' ');
    if (!nome) { toast.error('Informe o nome do aplicativo.'); return; }
    if (catalog.some(app => normalizeAppName(app.name) === normalizeAppName(nome))) { toast.error('Este aplicativo já está cadastrado.'); return; }
    if (panel.trim()) { try { if (new URL(panel.trim()).protocol !== 'https:') throw new Error(); } catch { toast.error('Informe um endereço de painel HTTPS válido.'); return; } }
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Sessão inválida.');
      let iconUrl: string | null = null;
      if (iconFile) {
        const extension = iconFile.type === 'image/webp' ? 'webp' : iconFile.type === 'image/png' ? 'png' : 'jpg';
        const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('application-icons').upload(path, iconFile, { contentType: iconFile.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPath = path;
        // Armazenamento privado: link assinado de longa duração (10 anos).
        const { data: signed, error: signError } = await supabase.storage.from('application-icons').createSignedUrl(path, 315360000);
        if (signError || !signed) throw signError || new Error('Falha ao gerar link do ícone.');
        iconUrl = signed.signedUrl;
      }
      const { error } = await (supabase as any).from('aplicativos_catalogo').insert({ user_id: auth.user.id, nome, icon_url: iconUrl, painel_url: panel.trim() || null });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['application-catalog'] });
      setOpen(false); toast.success('Aplicativo cadastrado.');
    } catch (error) { if (uploadedPath) { try { await supabase.storage.from('application-icons').remove([uploadedPath]); } catch { /* cleanup best effort */ } } console.error(error); toast.error('Não foi possível cadastrar o aplicativo.'); }
    finally { setSaving(false); }
  }
  return <><Button className="gap-2 rounded-xl" onClick={() => { setName(''); setIconFile(null); setIcon(''); setPanel(''); setOpen(true); }}><Plus size={17} />Novo aplicativo</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Cadastrar aplicativo</DialogTitle><DialogDescription className="sr-only">Novo aplicativo</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="block text-sm font-medium">Nome<Input required value={name} onChange={event => setName(event.target.value)} /></label>
        <div className="flex items-center gap-3"><AppIcon app={{ name, icon }} /><label className="flex-1 text-sm font-medium">Ícone (opcional)<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void readIcon(event.target.files?.[0])} /></label></div>
        <label className="block text-sm font-medium">Painel do aplicativo (opcional)<Input type="url" placeholder="https://..." value={panel} onChange={event => setPanel(event.target.value)} /></label>
        <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</Button></div>
      </form></DialogContent></Dialog></>;
}
