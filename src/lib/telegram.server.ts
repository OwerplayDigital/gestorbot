import { supabase } from "@/integrations/supabase/client";

export const getAuthorizedUser = async (chatId: number) => {
  // Nesta fase, verificamos primeiro se o chat ID consta no Secret fixo para bypass/teste rápido,
  // mantendo a compatibilidade com a tabela do banco para o futuro.
  const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'];
  
  if (allowedId && chatId.toString() === allowedId) {
    // Busca um usuário admin ou o primeiro disponível para associar ao ID fixo, 
    // ou retorna um ID de sistema se necessário. Para manter a regra de user_id, 
    // consultamos a tabela vinculada.
    const { data } = await supabase
      .from("telegram_authorized_users")
      .select("user_id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    
    if (data?.user_id) return data.user_id;
  }

  const { data, error } = await supabase
    .from("telegram_authorized_users")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar usuário autorizado no Telegram:", error);
    return null;
  }
  return data?.user_id || null;
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
