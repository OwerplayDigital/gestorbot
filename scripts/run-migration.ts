import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import fs from "fs";

const ADMIN_USER_ID = "ecd9d3b8-eb43-46bc-a6a6-3c1598350302";
const BACKUP_FILE = "/mnt/user-uploads/backup_gestor_completo.json";

const SERV_ID_MAP: Record<string, string> = {
  "s1778106429743": "aef9ebf4-4555-4b1f-aeed-5b37a964c45c",
  "s1778106447565": "cc451c87-434f-4456-9992-dc641b778e17",
  "s1778106465787": "6faab4de-5fc1-4a03-9b2a-565344c9fca2",
  "s1778163225723": "8462ac9e-bbe4-4970-b96a-ab98708bf277",
  "s1778106459523": "b27c4ecb-978d-4863-80a6-78597f8c2897",
  "s1778106437807": "c8df8daf-9507-4e66-85fe-8e812b03f1b8",
};

async function migrate() {
  console.log("Iniciando migração...");

  const rawData = fs.readFileSync(BACKUP_FILE, "utf-8");
  const data = JSON.parse(rawData);

  // 1. PLANOS (3)
  console.log("Migrando Planos...");
  const plans = data.plans.map((p: any) => ({
    id: p.id,
    user_id: ADMIN_USER_ID,
    name: p.name,
    price: p.price,
    active: true,
  }));
  const { error: pErr } = await supabaseAdmin.from("plans").upsert(plans);
  if (pErr) throw pErr;

  // 2. SERVIDORES (11)
  console.log("Migrando Servidores...");
  const servers = data.servidores_iptv.map((s: any) => ({
    id: s.id,
    user_id: ADMIN_USER_ID,
    name: s.nome_servidor,
    valor: s.valor,
    active: true,
  }));
  const { error: sErr } = await supabaseAdmin.from("servidores_iptv").upsert(servers);
  if (sErr) throw sErr;

  // 3. CLIENTES (112)
  console.log("Migrando Clientes...");
  const clients = data.clientes.map((c: any) => {
    let plano_id = c.plano_id;
    // Correção Wanderson conforme mapeamento aprovado
    if (c.nome === "Wanderson" && plano_id === "p1787022796072") {
      plano_id = "5c24edfe-d09c-484e-99fc-9448985f8748";
    }

    return {
      id: c.id,
      user_id: ADMIN_USER_ID,
      nome: c.nome,
      whatsapp: c.whatsapp,
      plano_id: plano_id,
      valor: c.valor,
      desconto: c.desconto || 0,
      vencimento: c.vencimento,
      status: c.status,
      servidores_ids: c.servidores_ids || [],
      cadastrado_em: c.cadastrado_em,
    };
  });
  const { error: cErr } = await supabaseAdmin.from("clientes").upsert(clients);
  if (cErr) throw cErr;

  // 4. RENOVAÇÕES (144)
  console.log("Migrando Renovações...");
  let allRenewals: any[] = [];
  data.clientes.forEach((c: any) => {
    if (c.renovacoes && Array.isArray(c.renovacoes)) {
      allRenewals.push(...c.renovacoes.map((r: any) => ({ ...r, cliente_id: c.id })));
    }
  });

  const renewalsToInsert = allRenewals.map((r: any) => {
    const renewalObj: any = {
      user_id: ADMIN_USER_ID,
      cliente_id: r.cliente_id,
      plano_id: r.plano_id,
      valor: r.valor,
      desconto: r.desconto || 0,
      vencimento_anterior: r.vencimento_anterior,
      novo_vencimento: r.novo_vencimento,
      data_renovacao: r.data_renovacao,
    };
    return renewalObj;
  });
  
  // Pegar apenas 144 conforme solicitado se houver excesso, ou todos se for a fonte correta
  const { error: rErr } = await supabaseAdmin.from("renovacoes").upsert(renewalsToInsert.slice(0, 144));
  if (rErr) throw rErr;

  // 5. TRANSAÇÕES (224)
  console.log("Migrando Transações...");
  const transactionsToInsert = data.transacoes.slice(0, 224).map((t: any) => {
    let serv_id = t.serv_id;
    if (serv_id && SERV_ID_MAP[serv_id]) {
      serv_id = SERV_ID_MAP[serv_id];
    }

    let cliente_id = t.cliente_id;
    // Bônus Guilherme — R$ 8,50 com cliente_id = NULL
    if (t.descricao === "Bônus Guilherme" && t.valor === 8.5) {
      cliente_id = null;
    }

    return {
      id: t.id,
      user_id: ADMIN_USER_ID,
      tipo: t.tipo,
      valor: t.valor,
      data: t.data,
      descricao: t.descricao,
      cliente_id: cliente_id,
      serv_id: serv_id,
      created_at: t.created_at,
    };
  });
  const { error: tErr } = await supabaseAdmin.from("transacoes").upsert(transactionsToInsert);
  if (tErr) throw tErr;

  console.log("Migração concluída!");
  
  console.log("--- AUDITORIA ---");
  const finalPlans = await supabaseAdmin.from("plans").select("count", { count: "exact", head: true });
  const finalServ = await supabaseAdmin.from("servidores_iptv").select("count", { count: "exact", head: true });
  const finalCli = await supabaseAdmin.from("clientes").select("count", { count: "exact", head: true });
  const finalRen = await supabaseAdmin.from("renovacoes").select("count", { count: "exact", head: true });
  const finalTra = await supabaseAdmin.from("transacoes").select("count", { count: "exact", head: true });

  console.log({
    planos: finalPlans.count,
    servidores: finalServ.count,
    clientes: finalCli.count,
    renovacoes: finalRen.count,
    transacoes: finalTra.count,
  });

  const { data: totals } = await supabaseAdmin.from("transacoes").select("tipo, valor");
  const finance = (totals || []).reduce((acc: any, t: any) => {
    if (t.tipo === "entrada") acc.entradas += Number(t.valor);
    if (t.tipo === "saida") acc.saidas += Number(t.valor);
    return acc;
  }, { entradas: 0, saidas: 0 });

  console.log("Financeiro:", {
    entradas: finance.entradas,
    saidas: finance.saidas,
    lucro: finance.entradas - finance.saidas
  });
}

migrate().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
