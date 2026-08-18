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

  // 1. PLANOS
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

  // 2. SERVIDORES
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

  // 3. CLIENTES
  console.log("Migrando Clientes...");
  const clients = data.clientes.map((c: any) => {
    let plano_id = c.plano_id;
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

  // 4. RENOVAÇÕES (Coletando de dentro de cada cliente se não houver na raiz)
  console.log("Migrando Renovações...");
  let allRenewals: any[] = [];
  if (data.renovacoes) {
    allRenewals = data.renovacoes;
  } else {
    data.clientes.forEach((c: any) => {
      if (c.renovacoes && Array.isArray(c.renovacoes)) {
        allRenewals.push(...c.renovacoes.map((r: any) => ({...r, cliente_id: c.id})));
      }
    });
  }

  const renewalsToInsert = allRenewals.map((r: any) => ({
    id: r.id,
    user_id: ADMIN_USER_ID,
    cliente_id: r.cliente_id,
    plano_id: r.plano_id,
    valor: r.valor,
    desconto: r.desconto || 0,
    vencimento_anterior: r.vencimento_anterior,
    novo_vencimento: r.novo_vencimento,
    data_renovacao: r.data_renovacao,
  }));
  const { error: rErr } = await supabaseAdmin.from("renovacoes").upsert(renewalsToInsert);
  if (rErr) throw rErr;

  // 5. TRANSAÇÕES (Coletando de dentro de cada cliente/servidor ou raiz)
  console.log("Migrando Transações...");
  let allTransactions: any[] = [];
  if (data.transacoes) {
    allTransactions = data.transacoes;
  } else {
    data.clientes.forEach((c: any) => {
      if (c.transacoes && Array.isArray(c.transacoes)) {
        allTransactions.push(...c.transacoes.map((t: any) => ({...t, cliente_id: c.id})));
      }
    });
    // Adicionar transações avulsas se houver
    if (data.transacoes_avulsas) allTransactions.push(...data.transacoes_avulsas);
  }

  const transactionsToInsert = allTransactions.map((t: any) => {
    let serv_id = t.serv_id;
    if (serv_id && SERV_ID_MAP[serv_id]) {
      serv_id = SERV_ID_MAP[serv_id];
    }

    let cliente_id = t.cliente_id;
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

  console.log("Migração concluída com sucesso!");
  
  // Auditoria Simples
  console.log("--- AUDITORIA ---");
  const counts = {
    plans: data.plans.length,
    servidores: data.servidores_iptv.length,
    clientes: data.clientes.length,
    renovacoes: renewalsToInsert.length,
    transacoes: transactionsToInsert.length
  };
  console.log(JSON.stringify(counts, null, 2));
}

migrate().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
