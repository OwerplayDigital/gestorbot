/* Local-first compatibility layer.
 * Keeps the existing Supabase-shaped API so the original screens can run
 * without a hosted database. Data stays in this browser profile.
 */
import type { Database } from './types';
import { getLocal, putLocal, deleteLocal, getAllLocal, clearLocalStore, putManyLocal } from '@/lib/local-db';

type Row = Record<string, any>;
type Result<T = any> = { data: T; error: null | { message: string; code?: string }; count?: number };
const DB_KEY = 'owerplay.gestor.local.v1';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'local@gestor.local', app_metadata: { provider: 'local' }, user_metadata: { name: 'Administrador' }, created_at: new Date().toISOString() };
const TABLES = ['aplicativos_catalogo','client_payment_links','client_notes','clientes','controle_creditos','dispositivos','message_templates','movimentacoes_creditos','pendencias','plans','push_tokens','renovacoes','reseller_credits','revendedores','servidores_iptv','templates_whatsapp','transacoes'];
const now = () => new Date().toISOString();
const uid = () => globalThis.crypto?.randomUUID?.() ?? 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const emptyDb = (): Record<string, Row[]> => Object.fromEntries(TABLES.map(t => [t, []]));
function readDb(): Record<string, Row[]> {
  if (typeof window === 'undefined') return emptyDb();
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    return { ...emptyDb(), ...parsed };
  } catch { return emptyDb(); }
}
function writeDb(db: Record<string, Row[]>) {
  if (typeof window !== 'undefined') localStorage.setItem(DB_KEY, JSON.stringify(db));
}
function normalize(table: string, row: Row): Row {
  const item = { ...row };
  item.id ??= uid();
  if ('user_id' in item || ['clientes','plans','servidores_iptv','transacoes','renovacoes','revendedores','reseller_credits','aplicativos_catalogo','message_templates','controle_creditos','movimentacoes_creditos'].includes(table)) item.user_id ??= USER_ID;
  if ('created_at' in item || ['clientes','plans','servidores_iptv','transacoes','renovacoes','revendedores','reseller_credits','dispositivos','aplicativos_catalogo','message_templates','templates_whatsapp','push_tokens'].includes(table)) item.created_at ??= now();
  if ('updated_at' in item || ['clientes','plans','servidores_iptv','revendedores','push_tokens','message_templates'].includes(table)) item.updated_at ??= now();
  if (table === 'revendedores') item.public_token ??= uid();
  return item;
}
function parseSelect(s: string) {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth = Math.max(0, depth - 1);
    else if (s[i] === ',' && depth === 0) { parts.push(s.slice(start, i).trim()); start = i + 1; }
  }
  const tail = s.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}
function compare(a: any, op: string, b: any): boolean {
  if (op === 'eq') return a === b;
  if (op === 'neq') return a !== b;
  if (op === 'gt') return a > b;
  if (op === 'gte') return a >= b;
  if (op === 'lt') return a < b;
  if (op === 'lte') return a <= b;
  if (op === 'is') return b === 'null' ? a == null : a === b;
  if (op === 'in') return Array.isArray(b) && b.includes(a);
  if (op === 'ilike' || op === 'like') {
    const pattern = String(b).replaceAll('%','.*').replaceAll('_','.');
    return new RegExp('^' + pattern + '$', op === 'ilike' ? 'i' : '').test(String(a ?? ''));
  }
  return true;
}
function relation(table: string, row: Row, name: string, db: Record<string, Row[]>): any {
  const maps: Record<string, [string,string,string]> = {
    plans: ['plans','id','plano_id'],
    clientes: ['clientes','id','cliente_id'],
    servidores_iptv: ['servidores_iptv','id','serv_id'],
    dispositivos: ['dispositivos','cliente_id','id'],
  };
  const map = maps[name];
  if (!map) return null;
  const [target, targetKey, sourceKey] = map;
  if (table === 'clientes' && name === 'plans') return db.plans.find(x => x.id === row.plano_id) ?? null;
  if (table === 'transacoes' && name === 'clientes') return db.clientes.find(x => x.id === row.cliente_id) ?? null;
  if (table === 'transacoes' && name === 'servidores_iptv') return db.servidores_iptv.find(x => x.id === row.serv_id) ?? null;
  if (table === 'renovacoes' && name === 'clientes') return db.clientes.find(x => x.id === row.cliente_id) ?? null;
  if (table === 'renovacoes' && name === 'plans') return db.plans.find(x => x.id === row.plano_id) ?? null;
  if (table === 'dispositivos' && name === 'clientes') return db.clientes.find(x => x.id === row.cliente_id) ?? null;
  if (table === 'reseller_credits' && name === 'servidores_iptv') return db.servidores_iptv.find(x => x.id === row.servidor_id) ?? null;
  if (table === 'reseller_credits' && name === 'revendedores') return db.revendedores.find(x => x.id === row.reseller_id) ?? null;
  if (table === 'revendedores' && name === 'servidores_iptv') return db.servidores_iptv.find(x => x.id === row.servidor_principal_id) ?? null;
  return null;
}
class LocalQuery implements PromiseLike<Result<any>> {
  private filters: Array<(r: Row) => boolean> = [];
  private orders: Array<{key:string;asc:boolean}> = [];
  private action: 'select'|'insert'|'update'|'delete'|'upsert' = 'select';
  private payload: any;
  private returning = false;
  private singleMode: 'single'|'maybe'|null = null;
  private offset = 0; private take = Infinity;
  constructor(private table: string, private db: Record<string, Row[]>) {}
  select(columns = '*'): this { if (this.action !== 'select') this.returning = true; (this as any).columns = columns; return this; }
  insert(values: Row|Row[]): this { this.action='insert'; this.payload=values; return this; }
  update(values: Row): this { this.action='update'; this.payload=values; return this; }
  upsert(values: Row|Row[], _opts?: any): this { this.action='upsert'; this.payload=values; return this; }
  delete(): this { this.action='delete'; return this; }
  eq(k:string,v:any):this { this.filters.push(r=>compare(r[k],'eq',v)); return this; }
  neq(k:string,v:any):this { this.filters.push(r=>compare(r[k],'neq',v)); return this; }
  gt(k:string,v:any):this { this.filters.push(r=>compare(r[k],'gt',v)); return this; }
  gte(k:string,v:any):this { this.filters.push(r=>compare(r[k],'gte',v)); return this; }
  lt(k:string,v:any):this { this.filters.push(r=>compare(r[k],'lt',v)); return this; }
  lte(k:string,v:any):this { this.filters.push(r=>compare(r[k],'lte',v)); return this; }
  in(k:string,v:any[]):this { this.filters.push(r=>compare(r[k],'in',v)); return this; }
  is(k:string,v:any):this { this.filters.push(r=>compare(r[k],'is',v)); return this; }
  like(k:string,v:any):this { this.filters.push(r=>compare(r[k],'like',v)); return this; }
  ilike(k:string,v:any):this { this.filters.push(r=>compare(r[k],'ilike',v)); return this; }
  not(k:string,op:string,v:any):this { this.filters.push(r=>!compare(r[k],op,v)); return this; }
  or(expr:string):this { const tests=expr.split(',').map(part=>{const m=part.match(/^([\w.]+)\.(eq|neq|gt|gte|lt|lte|ilike|like)\.(.*)$/);return m?(r:Row)=>compare(r[m[1]],m[2],m[3]):()=>false});this.filters.push(r=>tests.some(t=>t(r)));return this; }
  order(key:string,opts:any={}):this { this.orders.push({key,asc:opts.ascending!==false});return this; }
  range(a:number,b:number):this { this.offset=a;this.take=Math.max(0,b-a+1);return this; }
  limit(n:number):this { this.take=n;return this; }
  single():this { this.singleMode='single';return this; }
  maybeSingle():this { this.singleMode='maybe';return this; }
  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2> { return this.run().then(onfulfilled,onrejected); }
  private async run():Promise<Result<any>> {
    try {
      const rows=this.db[this.table] ?? (this.db[this.table]=[]);
      let selected=rows.filter(r=>this.filters.every(f=>f(r)));
      if(this.action==='insert'||this.action==='upsert'){
        const values=(Array.isArray(this.payload)?this.payload:[this.payload]).map((v:Row)=>normalize(this.table,v));
        if(this.action==='upsert'){
          for(const v of values){const i=rows.findIndex(r=>r.id===v.id || (v.token && r.token===v.token) || (v.user_id && r.user_id===v.user_id && this.table==='controle_creditos'));if(i>=0)rows[i]={...rows[i],...v};else rows.push(v);}
        } else rows.push(...values);
        selected=values;
      } else if(this.action==='update'){
        selected=selected.map(r=>{Object.assign(r,this.payload,{updated_at:r.updated_at!==undefined?now():r.updated_at});return r;});
      } else if(this.action==='delete'){
        const gone=new Set(selected);this.db[this.table]=rows.filter(r=>!gone.has(r));selected=[...gone];
      }
      for(const item of selected) if(item.lucro_liquido===undefined && this.table==='transacoes') item.lucro_liquido=Number(item.entrada ?? item.valor ?? 0)-Number(item.custo ?? 0);
      writeDb(this.db);
      for(const o of this.orders) selected.sort((a,b)=>{const av=a[o.key],bv=b[o.key];return (av>bv?1:av<bv?-1:0)*(o.asc?1:-1);});
      const count=selected.length;
      selected=selected.slice(this.offset,this.offset+this.take);
      let output=selected.map(row=>{
        const cols=(this as any).columns || '*';
        const result:Row = cols==='*' || parseSelect(cols).includes('*') ? {...row} : {};
        for(const part of parseSelect(cols)) {
          const m=part.match(/^(\\w+)\\s*\\((.*)\\)$/);
          if(m) {
            const rel=relation(this.table,row,m[1],this.db);
            result[m[1]]=rel ? Object.fromEntries(parseSelect(m[2]).map(k=>[k,rel[k]])) : rel;
          } else if(part!=='*' && part in row) result[part]=row[part];
        }
        return result;
      });
      if(this.singleMode==='single')return {data:output[0]??null,error:output.length?null:{message:'No rows found',code:'PGRST116'},count};
      if(this.singleMode==='maybe')return {data:output[0]??null,error:null,count};
      return {data:output,error:null,count};
    }catch(e:any){return {data:null,error:{message:e?.message||'Erro no banco local',code:'LOCAL_ERROR'}};}
  }
}
class LocalStorageBucket {
  constructor(private bucket:string){}
  async upload(path:string,file:Blob|File,opts:any={}){
    const key='owerplay.file.'+this.bucket+'.'+path;
    const reader=new FileReader();
    const data=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
    await putLocal('local_files',{id:key,dataUrl:data,bucket:this.bucket,path,contentType:file.type||'application/octet-stream',updated_at:now()});
    return {data:{path},error:null};
  }
  async remove(paths:string[]){
    for(const path of paths) await deleteLocal('local_files','owerplay.file.'+this.bucket+'.'+path);
    return {data:paths.map(name=>({name})),error:null};
  }
  async createSignedUrl(path:string,_expiresIn:number){
    const file=await getLocal('local_files','owerplay.file.'+this.bucket+'.'+path);
    return file?{data:{signedUrl:String(file.dataUrl||'')},error:null}:{data:null,error:{message:'Arquivo local não encontrado.'}};
  }
  getPublicUrl(_path:string){return {data:{publicUrl:''}};}
}
const listeners=new Set<(event:string,session:any)=>void>();
let session:any=null;
function getSession(){if(!session)session={access_token:'local.'+USER_ID+'.session',token_type:'bearer',expires_in:315360000,user:USER};return session;}
const auth={
  getSession:async()=>({data:{session:getSession()},error:null}),
  getUser:async()=>({data:{user:USER},error:null}),
  signInWithPassword:async({email,password}:{email:string;password?:string})=>{session=getSession();for(const fn of listeners)fn('SIGNED_IN',session);return {data:{user:USER,session},error:null};},
  signOut:async(_options?:any)=>{session=getSession();for(const fn of listeners)fn('SIGNED_OUT',null);return {error:null}},
  onAuthStateChange:(fn:(event:string,session:any)=>void)=>{listeners.add(fn);queueMicrotask(()=>fn('INITIAL_SESSION',getSession()));return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
  refreshSession:async()=>({data:{session:getSession(),user:USER},error:null}),
};
const client:any={
  auth,
  from:(table:string)=>new LocalQuery(table,readDb()),
  rpc:async(name:string,args:any={})=>{
    const db=readDb();
    if(name==='get_or_create_pix_link'){let link=db.client_payment_links.find(x=>x.cliente_id===args.p_client_id);if(!link){link={cliente_id:args.p_client_id,code:uid().replaceAll('-','').slice(0,10),created_at:now()};db.client_payment_links.push(link);writeDb(db);}return {data:link.code,error:null};}
    if(name==='get_pix_checkout'){const l=db.client_payment_links.find(x=>x.code===args.p_code);const c=db.clientes.find(x=>x.id===l?.cliente_id);const p=db.plans.find(x=>x.id===c?.plano_id);return {data:c?[{nome:c.nome?.split(' ')[0],vencimento:c.vencimento,plan_price:p?.price??c.valor??0,desconto:c.desconto??0}]:[],error:null};}
    if(name==='get_checkout_info'){const c=db.clientes.find(x=>x.id===args.p_ref);const p=db.plans.find(x=>x.id===c?.plano_id);return {data:c?{nome:c.nome,vencimento:c.vencimento,plan_price:p?.price??c.valor??0,desconto:c.desconto??0}:null,error:null};}
    if(name==='get_reseller_statement'){const r=db.revendedores.find(x=>x.public_token===args.p_token);return {data:r?{nome:r.nome,movimentacoes:db.reseller_credits.filter(x=>x.reseller_id===r.id)}:null,error:null};}
    return {data:null,error:{message:'Função não disponível no modo local: '+name,code:'LOCAL_RPC_UNAVAILABLE'}};
  },
  storage:{from:(bucket:string)=>new LocalStorageBucket(bucket)},
};
export const supabase = new Proxy(client,{get(target,prop){return target[prop as keyof typeof target];}}) as any;
export async function exportLocalBackup():Promise<string>{
  const localFiles=await getAllLocal('local_files');
  const files:Record<string,string>={};
  for(const file of localFiles) files[file.id]=String(file.dataUrl||'');
  if(typeof window!=='undefined') for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('owerplay.file.')&&!files[key])files[key]=localStorage.getItem(key)||'';}
  return JSON.stringify({app:'Owerplay Gestor',format:'gestorbot-local-backup',version:1,exported_at:now(),data:readDb(),files},null,2);
}
export async function importLocalBackup(input:string|object){
  const parsed=typeof input==='string'?JSON.parse(input):input as any;
  const source=parsed?.data??parsed;
  if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Arquivo de backup inválido.');
  const db={...emptyDb(),...source};
  for(const t of TABLES)if(!Array.isArray(db[t]))db[t]=[];
  writeDb(db);
  if(parsed?.files&&typeof parsed.files==='object'){
    await clearLocalStore('local_files');
    const fileRows=Object.entries(parsed.files).filter(([key,value])=>key.startsWith('owerplay.file.')&&typeof value==='string').map(([key,value])=>({id:key,dataUrl:value}));
    if(fileRows.length)await putManyLocal('local_files',fileRows);
  }
  return {tables:TABLES.filter(t=>db[t].length).length,records:TABLES.reduce((n,t)=>n+db[t].length,0)};
}
export async function clearLocalData(){if(typeof window!=='undefined'){localStorage.removeItem(DB_KEY);for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith('owerplay.file.'))localStorage.removeItem(k);}}await clearLocalStore('local_files');}
