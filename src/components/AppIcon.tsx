import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import type { AppDefinition } from '@/lib/client-apps';

export function AppIcon({ app, className = 'h-12 w-12' }: { app?: AppDefinition | undefined; className?: string }) {
  const [failedSrc, setFailedSrc] = useState('');
  const image = app?.icon;
  const crop = app?.crop;
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary ${className}`}>
    {image && image !== failedSrc ? <img src={image} alt="" loading="lazy" onError={() => setFailedSrc(image)} className={crop ? 'absolute' : 'h-full w-full object-contain'} style={crop ? { width: `${crop.width / crop.size * 100}%`, maxWidth: 'none', left: `${-crop.x / crop.size * 100}%`, top: `${-crop.y / crop.size * 100}%` } : undefined} /> : <Smartphone size={23} />}
  </span>;
}
