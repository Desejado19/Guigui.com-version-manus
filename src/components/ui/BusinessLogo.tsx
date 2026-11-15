import React, { useState } from 'react';

interface BusinessLogoProps {
  name: string;
  src?: string | null;
  className?: string;
}

/** Iniciais usadas quando a empresa ainda nao tem logotipo. */
export function businessInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/**
 * Logotipo de empresa com recurso a iniciais.
 *
 * Existe porque varias empresas chegam sem `logo`, e um `<img src="">` faz o
 * browser voltar a descarregar a pagina inteira. Aqui a imagem so e renderizada
 * quando ha mesmo um URL utilizavel; caso contrario mostram-se as iniciais.
 */
export const BusinessLogo: React.FC<BusinessLogoProps> = ({ name, src, className = '' }) => {
  const [failedSrc, setFailedSource] = useState<string | null>(null);
  const usable = typeof src === 'string' && src.trim().length > 0 && failedSrc !== src;

  if (!usable) {
    return (
      <div
        role="img"
        aria-label={`Logótipo de ${name}`}
        className={`flex items-center justify-center overflow-hidden bg-emerald-800 text-[10px] font-black text-white ${className}`}
      >
        {businessInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src as string}
      alt={`Logótipo de ${name}`}
      onError={() => setFailedSource(src as string)}
      className={`object-cover ${className}`}
    />
  );
};
