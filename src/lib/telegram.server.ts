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
  const { data, error } = await supabase
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

export const listPlans = async (userId: string) => {
  const { data, error } = await supabase
    .from("plans")
    .select("name, price, active")
    .eq("user_id", userId);

  if (error) {
    console.error("Erro Supabase (plans select):", error);
    throw new Error("Erro ao listar planos.");
  }
  return data;
};

export const createServer = async (userId: string, name: string, cost: number) => {
  const { data, error } = await supabase
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

export const listServers = async (userId: string) => {
  const { data, error } = await supabase
    .from("servidores_iptv")
    .select("name, valor, active")
    .eq("user_id", userId);

  if (error) {
    console.error("Erro Supabase (servidores select):", error);
    throw new Error("Erro ao listar servidores.");
  }
  return data;
};