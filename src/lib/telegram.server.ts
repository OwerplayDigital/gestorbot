import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAuthorizedUser = async (chatId: number) => {
  const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'];
  
  // A tabela telegram_authorized_users possui RLS restrito ao user_id.
  // Como o webhook é um serviço de backend sem sessão de usuário, precisamos
  // usar o supabaseAdmin para consultar o vínculo do Chat ID.
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

export const createPlan = async (userId: string, name: string, price: number) => {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .insert({
      user_id: userId,
      name: name,
      price: price,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro Supabase (plans insert):", error);
    throw new Error("Erro ao salvar plano no banco de dados.");
  }
  return data;
};

export const listPlans = async () => {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("name, price, active");

  if (error) {
    console.error("Erro Supabase (plans select):", error);
    throw new Error("Erro ao listar planos.");
  }
  return data;
};

export const createServer = async (userId: string, name: string, cost: number) => {
  const { data, error } = await supabaseAdmin
    .from("servidores_iptv")
    .insert({
      user_id: userId,
      name: name,
      valor: cost,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro Supabase (servidores insert):", error);
    throw new Error("Erro ao salvar servidor no banco de dados.");
  }
  return data;
};

export const listServers = async () => {
  const { data, error } = await supabaseAdmin
    .from("servidores_iptv")
    .select("name, valor, active");

  if (error) {
    console.error("Erro Supabase (servidores select):", error);
    throw new Error("Erro ao listar servidores.");
  }
  return data;
};

export const getClientsSummary = async () => {
  const { data: allClients, error } = await supabaseAdmin
    .from("clientes")
    .select("status");

  if (error) {
    console.error("Erro Supabase (summary select):", error);
    throw new Error("Erro ao buscar resumo de clientes.");
  }

  const total = allClients.length;
  const ativos = allClients.filter(c => c.status === 'ativo').length;
  const vencidos = allClients.filter(c => c.status === 'vencido').length;

  return { total, ativos, vencidos };
};

export const listExpiredClients = async () => {
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select(`
      nome,
      vencimento,
      servidores_iptv:servidores_ids (
        name
      )
    `)
    .eq("status", "vencido");

  if (error) {
    console.error("Erro Supabase (expired select):", error);
    throw new Error("Erro ao listar clientes vencidos.");
  }
  
  // Como servidores_ids é um UUID[], o relacionamento pode precisar de tratamento dependendo do PostgREST
  // Mas para o retorno textual, podemos simplificar se a query acima falhar ou retornar nulo
  return data;
};

export const listClientsExpiringToday = async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select("nome, vencimento")
    .eq("vencimento", today);

  if (error) {
    console.error("Erro Supabase (today select):", error);
    throw new Error("Erro ao listar clientes vencendo hoje.");
  }
  return data;
};