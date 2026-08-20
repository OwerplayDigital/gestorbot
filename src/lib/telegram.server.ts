import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const BOT_TEMPLATES = {
  COBRANCA: (nome: string, data: string, url: string = ""): string => 
    `Olá ${nome}, bom dia!\n\n` +
    `Seu plano de TV vence hoje: *(${data})*\n\n` +
    `⚠️ *Atenção:* na data do vencimento, o sistema poderá bloquear automaticamente a qualquer momento. Renove assim que possível.\n\n` +
    `🔗 *Acesse o link seguro para copiar o PIX e renovar:*\n` +
    `${url}`,

  RENOVACAO_LINK: (nome: string, url: string = ""): string =>
    `Olá ${nome}!\n\n` +
    `Aqui está o seu link para renovação da assinatura:\n\n` +
    `🔗 ${url}\n\n` +
    `Após o pagamento, sua assinatura será renovada automaticamente.`,

  CONFIRMACAO: (nome: string, data: string): string =>
    `📌 Obrigado pela confiança, ${nome}!\n\n` +
    `✅ Sua assinatura foi renovada com sucesso!\n\n` +
    `🗓️ *PRÓXIMO VENCIMENTO:* (${data})`
};

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
    .select("id, name, price, active");

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
    .select("id, name, valor, active");

  if (error) {
    console.error("Erro Supabase (servidores select):", error);
    throw new Error("Erro ao listar servidores.");
  }
  return data;
};

export const getClientsSummary = async () => {
  const { data: allClients, error } = await supabaseAdmin
    .from("clientes")
    .select("status, vencimento");

  if (error) {
    console.error("Erro Supabase (summary select):", error);
    throw new Error("Erro ao buscar resumo de clientes.");
  }

  const total = allClients.length;
  const ativos = allClients.filter((c: any) => c.status === 'ativo').length;
  
  const { toZonedTime, format: formatTz } = await import('date-fns-tz');
  const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
  const today = formatTz(nowBr, 'yyyy-MM-dd');
  const vencidos = allClients.filter((c: any) => c.vencimento && c.vencimento < today).length;

  return { total, ativos, vencidos };
};

export const listExpiredClients = async () => {
  const { toZonedTime, format: formatTz } = await import('date-fns-tz');
  const today = formatTz(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');
  
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select("id, nome, vencimento, whatsapp")
    .lt("vencimento", today)
    .order('vencimento', { ascending: true });

  if (error) {
    console.error("Erro Supabase (expired select):", error);
    throw error;
  }
  
  return data;
};

export const listClientsExpiringToday = async () => {
  const { toZonedTime, format: formatTz } = await import('date-fns-tz');
  const today = formatTz(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');
  
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select("id, nome, vencimento, whatsapp")
    .eq("vencimento", today as string);

  if (error) {
    console.error("Erro Supabase (today select):", error);
    throw new Error("Erro ao listar clientes vencendo hoje.");
  }
  return data;
};

export const findClientByName = async (name: string) => {
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select(`
      id, 
      nome, 
      whatsapp, 
      vencimento, 
      status, 
      desconto,
      plano_id,
      servidores_ids,
      plans:plans(id, name, price)
    `)
    .ilike("nome", `%${name}%`)
    .limit(10);


  if (error) {
    console.error("Erro Supabase (findClientByName):", error);
    throw error;
  }
  
  // Buscar nomes dos servidores separadamente se houver IDs
  const result = await Promise.all(data.map(async (c) => {
    let servidores: any[] = [];
    if (c.servidores_ids && c.servidores_ids.length > 0) {
      const { data: sData } = await supabaseAdmin
        .from('servidores_iptv')
        .select('id, name')
        .in('id', c.servidores_ids);
      servidores = sData || [];
    }
    return { ...c, servidores };
  }));

  return result;
};

export const updateClient = async (id: string, updates: any) => {
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro Supabase (updateClient):", error);
    throw error;
  }
  return data;
};

export const createClientWithDetails = async (clientData: { 
  user_id: string;
  nome: string; 
  whatsapp: string; 
  plano_id: string; 
  servidores_ids: string[]; 
  desconto: number; 
  vencimento: string 
}) => {
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .insert({
      user_id: clientData.user_id,
      nome: clientData.nome,
      whatsapp: clientData.whatsapp,
      plano_id: clientData.plano_id,
      servidores_ids: clientData.servidores_ids,
      desconto: clientData.desconto,
      vencimento: clientData.vencimento,
      status: 'ativo',
    })
    .select()
    .single();

  if (error) {
    console.error("Erro Supabase (createClientWithDetails):", error);
    throw error;
  }
  return data;
};

export const getFinancialSummary = async () => {
  const { data: transacoes, error } = await supabaseAdmin
    .from("transacoes")
    .select("tipo, valor");

  if (error) {
    console.error("Erro Supabase (financial summary):", error);
    throw error;
  }

  const entradas = transacoes
    .filter(t => t.tipo === 'entrada')
    .reduce((sum, t) => sum + Number(t.valor), 0);
  
  const saidas = transacoes
    .filter(t => t.tipo === 'saida')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  return { entradas, saidas, lucro: entradas - saidas };
};

export const renewClient = async (
  clientId: string,
  newVencimento: string,
  userId: string
) => {
  // 1. Buscar dados atuais do cliente
  const { data: client, error: fetchError } = await supabaseAdmin
    .from("clientes")
    .select("vencimento, plano_id, desconto, servidores_ids")
    .eq("id", clientId)
    .single();

  if (fetchError || !client) {
    console.error("Erro ao buscar cliente para renovação:", fetchError);
    throw new Error("Cliente não encontrado.");
  }

  // 2. Buscar valor do plano
  const { data: plan, error: planError } = await supabaseAdmin
    .from("plans")
    .select("price")
    .eq("id", client.plano_id || "")
    .single();

  if (planError || !plan) {
    console.error("Erro ao buscar plano para renovação:", planError);
    throw new Error("Plano não encontrado.");
  }

  // 3. Buscar custo dos servidores
  let totalCusto = 0;
  if (client.servidores_ids && client.servidores_ids.length > 0) {
    const { data: servers, error: serverError } = await supabaseAdmin
      .from("servidores_iptv")
      .select("valor")
      .in("id", client.servidores_ids);
    
    if (!serverError && servers) {
      totalCusto = servers.reduce((sum, s) => sum + Number(s.valor), 0);
    }
  }

  const { toZonedTime, format: formatTz } = await import('date-fns-tz');
  const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
  
  const today = new Date(nowBr);
  today.setHours(0, 0, 0, 0);
  
  // O banco armazena apenas data (YYYY-MM-DD), ao ler transformamos em um objeto Date de meio-dia 
  // para evitar problemas de timezone na conversão da string
  const currentVenc = client.vencimento ? new Date(client.vencimento + 'T12:00:00') : today;
  
  // Regra de data: Se vencido, Hoje + 30 dias. Se em dia, Vencimento + 30 dias.
  const baseDate = currentVenc < today ? today : currentVenc;
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + 30);
  const calculatedNewVencimento = nextDate.toISOString().split('T')[0];

  const valorEntrada = Number(plan.price) - Number(client.desconto || 0);
  const vencimentoAnterior = client.vencimento;

  // 4. Executar transação de renovação
  // Nota: Idealmente isso seria uma RPC/Database Function para atomicidade, 
  // mas faremos via chamadas sequenciais com supabaseAdmin.

  // a) Registrar a renovação
  const { error: renewRecordError } = await supabaseAdmin
    .from("renovacoes")
    .insert({
      user_id: userId,
      cliente_id: clientId,
      plano_id: client.plano_id,
      valor: valorEntrada,
      desconto: client.desconto,
      vencimento_anterior: vencimentoAnterior,
      novo_vencimento: calculatedNewVencimento || newVencimento,
      data_renovacao: nowBr.toISOString(),
    });

  if (renewRecordError) {
    console.error("Erro ao registrar renovação:", renewRecordError);
    throw renewRecordError;
  }

  // b) Registrar transação ÚNICA (Entrada, Custo e Lucro)
  const { error: transError } = await supabaseAdmin
    .from("transacoes")
    .insert({
      user_id: userId,
      cliente_id: clientId,
      tipo: 'entrada', // Mantemos tipo para compatibilidade se necessário, mas o foco é o registro único
      entrada: valorEntrada,
      custo: totalCusto,
      valor: valorEntrada - totalCusto, // 'valor' agora representa o lucro líquido para compatibilidade legada
      data: formatTz(nowBr, 'yyyy-MM-dd'),
      descricao: `Renovação cliente ${clientId}`,
    });

  if (transError) {
    console.error("Erro ao registrar transação unificada:", transError);
  }

  // d) Atualizar vencimento e status do cliente
  const { data: updatedClient, error: updateError } = await supabaseAdmin
    .from("clientes")
    .update({
      vencimento: calculatedNewVencimento || newVencimento,
      status: 'ativo'
    })
    .eq("id", clientId)
    .select()
    .single();

  if (updateError) {
    console.error("Erro ao atualizar cliente após renovação:", updateError);
    throw updateError;
  }

  return updatedClient;
};

export const resetFinancialHistory = async (clientId: string, userId: string) => {
  // Deletar transações associadas ao cliente
  const { error: transError } = await supabaseAdmin
    .from("transacoes")
    .delete()
    .eq("cliente_id", clientId)
    .eq("user_id", userId);

  if (transError) {
    console.error("Erro ao resetar transações:", transError);
    throw transError;
  }

  // Deletar renovações associadas ao cliente
  const { error: renewError } = await supabaseAdmin
    .from("renovacoes")
    .delete()
    .eq("cliente_id", clientId)
    .eq("user_id", userId);

  if (renewError) {
    console.error("Erro ao resetar renovações:", renewError);
    throw renewError;
  }

  return { success: true };
};

export const resetGlobalFinancialHistory = async (userId: string) => {
  // Deletar transações associadas ao usuário
  const { error: transError } = await supabaseAdmin
    .from("transacoes")
    .delete()
    .eq("user_id", userId);

  if (transError) {
    console.error("Erro ao resetar transações globais:", transError);
    throw transError;
  }

  // Deletar renovações associadas ao usuário
  const { error: renewError } = await supabaseAdmin
    .from("renovacoes")
    .delete()
    .eq("user_id", userId);

  if (renewError) {
    console.error("Erro ao resetar renovações globais:", renewError);
    throw renewError;
  }

  return { success: true };
};