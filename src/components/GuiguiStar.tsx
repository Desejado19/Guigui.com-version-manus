import React from 'react';

/**
 * Marca oficial do Guigui.com: estrela de 6 pontas (hexagrama), como a do Davi.
 * Desenhada em viewBox 40x40 com centro em (20, 20) para escalar sem perder nitidez.
 */
interface GuiguiStarProps {
  className?: string;
  /** Cor de preenchimento do hexagrama. Use "none" para ficar só o contorno. */
  fill?: string;
  /** Cor do contorno e do ponto central. */
  stroke?: string;
  strokeWidth?: number;
  title?: string;
}

const UP_TRIANGLE = 'M20 2 L35.59 29 L4.41 29 Z';
const DOWN_TRIANGLE = 'M20 38 L4.41 11 L35.59 11 Z';

export const GuiguiStar: React.FC<GuiguiStarProps> = ({
  className = 'h-full w-full',
  fill = 'var(--color-green-900)',
  stroke = 'var(--color-gold-500)',
  strokeWidth = 1.4,
  title,
}) => (
  <svg
    viewBox="0 0 40 40"
    className={className}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title ? <title>{title}</title> : null}
    <path d={UP_TRIANGLE} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <path d={DOWN_TRIANGLE} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <circle cx="20" cy="20" r="3.6" fill={stroke} />
  </svg>
);

export default GuiguiStar;
