import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAuthorizedUser = async (chatId: number) => {
  const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'];
  const { data, error } = await supabaseAdmin
    .from("telegram_authorized_users")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar usuário autorizado no Telegram:", error);
    return null;
  }

  const userId = data?.user_id || null;

  if (allowedId && userId) {
    if (chatId.toString() !== allowedId) {
      console.warn(`Chat ID ${chatId} vinculado a ${userId} mas não consta em TELEGRAM_ALLOWED_USER_ID`);
      return null;
    }
  }

  return userId;
};

export const setUserStep = async (chatId: number, step: string | null) => {
  const { error } = await supabaseAdmin
    .from("telegram_authorized_users")
    .update({ current_step: step })
    .eq("telegram_chat_id", chatId);

  if (error) {
    console.error("Erro ao definir step do usuário:", error);
    throw error;
  }
};

export const getUserStep = async (chatId: number) => {
  const { data, error } = await supabaseAdmin
    .from("telegram_authorized_users")
    .select("current_step")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar step do usuário:", error);
    return null;
  }
  return data?.current_step || null;
};

export const listUserTemplates = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("message_templates")
    .select("id, name, content, type")
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao buscar templates:", error);
    return [];
  }
  return (data || []).map(t => ({
    ...t,
    type: (t.type as 'cobrança' | 'renovação' | 'personalizado') || 'personalizado'
  }));
};

export const getTemplateByType = async (userId: string, type: 'cobrança' | 'renovação') => {
  const { data, error } = await supabaseAdmin
    .from("message_templates")
    .select("content")
    .eq("user_id", userId)
    .eq("type", type)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao buscar template de ${type}:`, error);
    return null;
  }
  return data?.content || null;
};

export const fillTemplate = (content: string, data: { 
  nome?: string; 
  vencimento?: string; 
  valor?: string; 
  chave_pix?: string; 
  servidor?: string; 
  plano?: string;
}) => {
  let filled = content;
  filled = filled.replace(/{nome}/g, data.nome || "");
  filled = filled.replace(/{vencimento}/g, data.vencimento || "");
  filled = filled.replace(/{valor}/g, data.valor || "");
  filled = filled.replace(/{chave_pix}/g, data.chave_pix || "PIX no link");
  filled = filled.replace(/{servidor}/g, data.servidor || "");
  filled = filled.replace(/{plano}/g, data.plano || "");
  return filled;
};

export const createPlan = async (userId: string, name: string, price: number) => {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .insert({ user_id: userId, name: name, price: price, active: true })
    .select().single();
  if (error) throw new Error("Erro ao salvar plano.");
  return data;
};

export const listPlans = async () => {
  const { data, error } = await supabaseAdmin.from("plans").select("id, name, price, active");
  if (error) throw new Error("Erro ao listar planos.");
  return data;
};

export const createServer = async (userId: string, name: string, cost: number) => {
  const { data, error } = await supabaseAdmin
    .from("servidores_iptv")
    .insert({ user_id: userId, name: name, valor: cost, active: true })
    .select().single();
  if (error) throw new Error("Erro ao salvar servidor.");
  return data;
};

export const listServers = async () => {
  const { data, error } = await supabaseAdmin.from("servidores_iptv").select("id, name, valor, active");
  if (error) throw new Error("Erro ao listar servidores.");
  return data;
};

export const getClientsSummary = async () => {
  const { data: allClients, error } = await supabaseAdmin.from("clientes").select("status");
  if (error) throw new Error("Erro ao buscar resumo de clientes.");
  const total = allClients.length;
  const ativos = allClients.filter(c => c.status === 'ativo').length;
  const vencidos = allClients.filter(c => c.status === 'vencido').length;
  return { total, ativos, vencidos };
};

export const findClientByName = async (name: string) => {
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select(`id, nome, whatsapp, vencimento, status, desconto, plano_id, servidores_ids, plans:plans(id, name, price)`)
    .ilike("nome", `%${name}%`)
    .limit(10);
  if (error) throw error;
  return await Promise.all(data.map(async (c) => {
    let servidores: any[] = [];
    if (c.servidores_ids && c.servidores_ids.length > 0) {
      const { data: sData } = await supabaseAdmin.from('servidores_iptv').select('id, name').in('id', c.servidores_ids);
      servidores = sData || [];
    }
    return { ...c, servidores };
  }));
};

export const updateClient = async (id: string, updates: any) => {
  const { data, error } = await supabaseAdmin.from("clientes").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
};

export const renewClient = async (clientId: string, newVencimento: string, userId: string) => {
  const { data: client, error: fetchError } = await supabaseAdmin.from("clientes").select("*").eq("id", clientId).single();
  if (fetchError || !client) throw new Error("Cliente não encontrado.");
  const { data: plan } = await supabaseAdmin.from("plans").select("price").eq("id", client.plano_id || "").single();
  if (!plan) throw new Error("Plano não encontrado.");
  let totalCusto = 0;
  if (client.servidores_ids && client.servidores_ids.length > 0) {
    const { data: servers } = await supabaseAdmin.from("servidores_iptv").select("valor").in("id", client.servidores_ids);
    totalCusto = servers?.reduce((sum, s) => sum + Number(s.valor), 0) || 0;
  }
  const valorEntrada = Number(plan.price) - Number(client.desconto || 0);
  await supabaseAdmin.from("renovacoes").insert({ user_id: userId, cliente_id: clientId, plano_id: client.plano_id, valor: valorEntrada, desconto: client.desconto, vencimento_anterior: client.vencimento, novo_vencimento: newVencimento, data_renovacao: new Date().toISOString() });
  await supabaseAdmin.from("transacoes").insert({ user_id: userId, cliente_id: clientId, tipo: 'entrada', entrada: valorEntrada, custo: totalCusto, valor: valorEntrada - totalCusto, data: (new Date().toISOString().split('T')[0] ?? null), descricao: `Renovação cliente ${clientId}` });
  return await supabaseAdmin.from("clientes").update({ vencimento: newVencimento, status: 'ativo' }).eq("id", clientId).select().single();
};

export const BOT_TEMPLATES = {
  COBRANCA: (nome: string, data: string) => `Olá ${nome}, seu plano vence em ${data}.`,
  RENOVACAO_LINK: (nome: string) => `Olá ${nome}, aqui está seu link de renovação.`,
  CONFIRMACAO: (nome: string, data: string) => `✅ ${nome}, renovado até ${data}!`
};

export const getFinancialSummary = async () => {
    const { data } = await supabaseAdmin.from("transacoes").select("entrada, custo");
    const totalEntrada = data?.reduce((sum, t) => sum + (t.entrada || 0), 0) || 0;
    const totalCusto = data?.reduce((sum, t) => sum + (t.custo || 0), 0) || 0;
    return { entradas: totalEntrada, saidas: totalCusto, lucro: totalEntrada - totalCusto };
};

export const listExpiredClients = async () => {
    const { data } = await supabaseAdmin.from("clientes").select("nome, status").eq("status", "vencido");
    return data || [];
};

export const listClientsExpiringToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabaseAdmin.from("clientes").select("nome, vencimento").eq("vencimento", today as string);
    return data || [];
};

export const createClientWithDetails = async (data: any) => {
    return await supabaseAdmin.from("clientes").insert(data).select().single();
};
