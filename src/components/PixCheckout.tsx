import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Info, LoaderCircle } from 'lucide-react';
import { copyPixKey, pixAmount, pixDueDate, PIX_BANK, PIX_RECIPIENT, type PixCheckoutInfo } from '@/lib/pix-payment';
import '../styles/pix-checkout.css';

function OwerplayBrand() {
  return <div className="pix-brand" aria-label="Owerplay">
    <svg viewBox="0 0 40 44" fill="none" aria-hidden="true">
      <defs><linearGradient id="pix-brand-blue" x1="0" y1="0" x2="40" y2="44" gradientUnits="userSpaceOnUse"><stop stopColor="#318bff"/><stop offset="1" stopColor="#0755ff"/></linearGradient></defs>
      <path d="M5 3.5C5-0.1 9.3-1 12 0.7L35 15.5c5.3 3.4 5.3 9.6 0 13L12 43.3C9.3 45 5 43.1 5 39.5Z" fill="url(#pix-brand-blue)"/>
      <path d="M15 14.5c0-1.2 1.3-2 2.4-1.3l10 6.4c1 .6 1 2.1 0 2.8l-10 6.3c-1.1.7-2.4-.1-2.4-1.3Z" fill="white"/>
    </svg><span>OWERPLAY</span>
  </div>;
}

function PixSymbol() {
  return <svg className="pix-symbol" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="m24 6 8-4 8 4 8 8-8 8a11 11 0 0 1-16 0l-8-8ZM6 24l8-8 8 8a14 14 0 0 0 20 0l8-8 8 8c5 5 5 11 0 16l-8 8-8-8a14 14 0 0 0-20 0l-8 8-8-8c-5-5-5-11 0-16ZM24 42a11 11 0 0 1 16 0l8 8-8 8-8 4-8-4-8-8Z" fill="#05b8ba"/>
  </svg>;
}

export function PixCheckout({ info, loading = false, error, onRetry }: {
  info?: PixCheckoutInfo | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setCopyState('idle');
    return () => clearTimeout(resetTimer.current);
  }, [info]);
  async function handleCopy() {
    if (copyState === 'copying') return;
    clearTimeout(resetTimer.current);
    setCopyState('copying');
    try {
      await copyPixKey();
      setCopyState('copied');
      resetTimer.current = setTimeout(() => setCopyState('idle'), 3000);
    } catch {
      setCopyState('failed');
    }
  }
  const firstName = info?.nome?.trim().split(/\s+/)[0] || 'Cliente';
  const amount = info ? pixAmount(info).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  return <div className="pix-checkout">
    <div className="pix-checkout-inner">
      <OwerplayBrand />
      {loading || error || !info ? <section className="pix-state" aria-live="polite" aria-busy={loading}>
        {loading ? <><LoaderCircle className="pix-spinner" size={30} /><h1>Carregando pagamento…</h1></> : <><h1>Pagamento indisponível</h1><p>{error || 'Não foi possível encontrar esta cobrança.'}</p>{onRetry && <button className="pix-copy-button" onClick={onRetry}>Tentar novamente</button>}</>}
      </section> : <>
        <header className="pix-heading">
          <p className="pix-eyebrow">PAGAMENTO VIA PIX</p>
          <h1>Renove seu acesso</h1>
          <p className="pix-greeting">Olá, {firstName}</p>
        </header>
        <section className="pix-card pix-summary" aria-label="Resumo da renovação">
          <p className="pix-amount-label">Valor da renovação</p>
          <p className="pix-amount"><span>R$</span><strong>{amount}</strong></p>
          <div className="pix-due-row"><span>Vencimento</span><strong>{pixDueDate(info.vencimento)}</strong></div>
        </section>
        <section className="pix-card pix-payment" aria-labelledby="pix-payment-heading">
          <h2 id="pix-payment-heading"><PixSymbol />Pague com Pix</h2>
          <dl className="pix-recipient">
            <div><dt>Recebedor</dt><dd>{PIX_RECIPIENT}</dd></div>
            <div><dt>Banco</dt><dd>{PIX_BANK}</dd></div>
          </dl>
          <button type="button" className="pix-copy-button" data-copied={copyState === 'copied'} onClick={handleCopy} disabled={copyState === 'copying'}>
            {copyState === 'copying' ? <LoaderCircle className="pix-spinner" /> : copyState === 'copied' ? <Check /> : <Copy />}
            <span aria-live="polite">{copyState === 'copied' ? 'Chave copiada' : copyState === 'copying' ? 'Copiando…' : 'Copiar chave Pix'}</span>
          </button>
          {copyState === 'failed' && <p className="pix-copy-error" role="alert">Não foi possível copiar. Toque no botão para tentar novamente.</p>}
          <div className="pix-instructions"><Info aria-hidden="true" /><p>Depois de copiar, abra o app do seu banco e escolha Pix → Pagar com chave.</p></div>
          <p className="pix-receipt">Após pagar, envie o comprovante pelo WhatsApp.</p>
        </section>
      </>}
    </div>
  </div>;
}
