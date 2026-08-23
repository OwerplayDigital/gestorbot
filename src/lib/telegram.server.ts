import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BOT_TEMPLATES } from "./templates";

export { BOT_TEMPLATES };

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
      console.warn(`Chat ID ${chatId} bloqueado: Não consta em TELEGRAM_ALLOWED_USER_ID`);
      return null;
    }
  }

  return userId;
};

export const bindAdminIfMatching = async (chatId: number) => {
  const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
  if (!allowedId || chatId.toString() !== allowedId) return null;

  // Verificar se já existe vínculo
  const { data: existing } = await supabaseAdmin
    .from("telegram_authorized_users")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existing) return existing.user_id;

  // Buscar o primeiro usuário administrador do sistema (auth.users)
  // Como não temos acesso direto à tabela auth.users via query builder padrão em alguns contextos,
  // vamos tentar buscar da tabela profiles ou similar se existir, ou usar o service_role.
  // Em projetos Lovable, o primeiro usuário criado geralmente é o admin.
  
  // Vamos buscar o primeiro usuário que possua clientes ou transações se possível,
  // ou simplesmente o primeiro da tabela de usuários se disponível via admin.
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
  const firstUser = userData?.users?.[0];

  if (!firstUser) {
    console.error("Nenhum usuário encontrado no Auth para vincular o Admin do Telegram.");
    return null;
  }

  const { error: insertError } = await supabaseAdmin
    .from("telegram_authorized_users")
    .insert({
      telegram_chat_id: chatId,
      user_id: firstUser.id,
    });

  if (insertError) {
    console.error("Erro ao vincular admin automaticamente:", insertError);
    return null;
  }

  return firstUser.id;
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
  const vencidos = allClients.filter((c: any) => {
    if (!c.vencimento) return false;
    const isoVenc = c.vencimento.includes('/') 
      ? c.vencimento.split('/').reverse().join('-') 
      : c.vencimento;
    return isoVenc < today;
  }).length;

  return { total, ativos, vencidos };
};

export const listExpiredClients = async () => {
  const { toZonedTime, format: formatTz } = await import('date-fns-tz');
  const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
  nowBr.setHours(0, 0, 0, 0);
  const todayStr = formatTz(nowBr, 'yyyy-MM-dd');
  
  // Buscamos todos para filtrar em memória devido ao formato DD/MM/YYYY no banco
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select(`
      id, 
      nome, 
      vencimento, 
      whatsapp,
      servidores_ids
    `);

  if (error) {
    console.error("Erro Supabase (expired select):", error);
    throw error;
  }

  const parseDate = (d: any): Date | null => {
    if (!d || typeof d !== 'string') return null;
    const parts = d.split(/[/-]/);
    if (parts.length !== 3) return null;
    
    const s0 = parts[0];
    const s1 = parts[1];
    const s2 = parts[2];
    if (s0 === undefined || s1 === undefined || s2 === undefined) return null;

    const p0 = Number(s0);
    const p1 = Number(s1);
    const p2 = Number(s2);

    let resultDate: Date | null = null;
    if (d.includes('/') || (d.includes('-') && s0.length === 2)) {
      // DD/MM/YYYY
      resultDate = new Date(p2, p1 - 1, p0);
    } else if (d.includes('-') && s0.length === 4) {
      // YYYY-MM-DD
      resultDate = new Date(p0, p1 - 1, p2);
    }

    if (resultDate && !isNaN(resultDate.getTime())) {
      resultDate.setHours(0, 0, 0, 0);
      return resultDate;
    }
    return null;
  };

  console.log(`[DIAGNOSTICO] Total clientes banco: ${data?.length || 0}`);
  if (data && data.length > 0) {
    console.log(`[DIAGNOSTICO] Amostra (vencimento): ${data.slice(0, 3).map(c => c.vencimento).join(', ')}`);
  }
  console.log(`[DIAGNOSTICO] HOJE (Brasil): ${todayStr}`);

  const filteredData = (data || [])
    .filter((c: any) => {
      const vencDate = parseDate(c.vencimento);
      const isExpired = vencDate && vencDate < nowBr;
      return isExpired;
    })
    .sort((a: any, b: any) => {
      const dateA = parseDate(a.vencimento);
      const dateB = parseDate(b.vencimento);
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });
  
  console.log(`[DIAGNOSTICO] Clientes após filtro (vencidos): ${filteredData.length}`);
  
  // Buscar nomes dos servidores para os clientes filtrados
  const result = await Promise.all(filteredData.map(async (c) => {
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

export const listClientsExpiringToday = async () => {
  const { toZonedTime, format: formatTz } = await import('date-fns-tz');
  const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
  const today = formatTz(nowBr, 'yyyy-MM-dd');
  
  const { data, error } = await supabaseAdmin
    .from("clientes")
    .select(`
      id, 
      nome, 
      vencimento, 
      whatsapp,
      servidores_ids,
      servidores_ids,
      plans:plans(id, name, price)
    `)
    .eq("vencimento", today as string);

  if (error) {
    console.error("Erro Supabase (today select):", error);
    throw new Error("Erro ao listar clientes vencendo hoje.");
  }

  // Buscar nomes dos servidores
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

export const getClientById = async (id: string) => {
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
      servidores_ids,
      plans:plans(id, name, price)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro Supabase (getClientById):", error);
    throw error;
  }

  // Buscar nomes dos servidores
  let servidores: any[] = [];
  if (data.servidores_ids && data.servidores_ids.length > 0) {
    const { data: sData } = await supabaseAdmin
      .from('servidores_iptv')
      .select('id, name')
      .in('id', data.servidores_ids);
    servidores = sData || [];
  }

  return { ...data, servidores };
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
    .select("entrada, custo, valor");

  if (error) {
    console.error("Erro Supabase (financial summary):", error);
    throw error;
  }

  const entradas = transacoes.reduce((sum, t) => sum + Number(t.entrada || 0), 0);
  const saidas = transacoes.reduce((sum, t) => sum + Number(t.custo || 0), 0);
  const lucro = entradas - saidas;

  return { entradas, saidas, lucro };
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
      tipo: 'entrada',
      entrada: valorEntrada,
      custo: totalCusto,
      lucro_liquido: valorEntrada - totalCusto,
      valor: valorEntrada - totalCusto,
      data: formatTz(nowBr, 'yyyy-MM-dd HH:mm:ss'),
      descricao: `Renovação cliente ${clientId}`,
      serv_id: client.servidores_ids?.[0] || null
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
// --- Message Tracking & Cleanup ---

/**
 * Tracks a message ID sent by the bot or a command from the user for later cleanup.
 * We store this in a table to persist across serverless executions.
 */
export const trackBotMessage = async (chatId: number, messageId: number) => {
  try {
    await (supabaseAdmin as any)
      .from('telegram_message_logs')
      .insert({
        telegram_chat_id: chatId,
        message_id: messageId,
        created_at: new Date().toISOString()
      });
  } catch (err) {
    console.error("Error tracking message:", err);
  }
};

export const getBotMessages = async (chatId: number) => {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('telegram_message_logs')
      .select('message_id')
      .eq('telegram_chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data as any[])?.map(m => m.message_id) || [];
  } catch (err) {
    console.error("Error getting messages:", err);
    return [];
  }
};

export const clearBotMessages = async (chatId: number) => {
  try {
    await (supabaseAdmin as any)
      .from('telegram_message_logs')
      .delete()
      .eq('telegram_chat_id', chatId);
  } catch (err) {
    console.error("Error clearing messages:", err);
  }
};

export const createDevice = async (clientData: { 
  cliente_id: string; 
  app_nome: string; 
  mac_address: string; 
  app_key?: string | null; 
}) => {
  const { data, error } = await supabaseAdmin
    .from("dispositivos")
    .insert({
      cliente_id: clientData.cliente_id,
      app_nome: clientData.app_nome,
      mac_address: clientData.mac_address,
      app_key: clientData.app_key || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro Supabase (dispositivos insert):", error);
    throw error;
  }
  return data;
};

export const listDevicesByClient = async (clientId: string) => {
  const { data, error } = await supabaseAdmin
    .from("dispositivos")
    .select("*")
    .eq("cliente_id", clientId);

  if (error) {
    console.error("Erro Supabase (dispositivos select):", error);
    return [];
  }
  return data || [];
};


