import React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  style,
  className,
}: SeparatorProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={className}
      style={{
        backgroundColor: 'var(--gray-6)',
        flexShrink: 0,
        ...(isHorizontal
          ? { height: '1px', width: '100%' }
          : { width: '1px', height: '100%' }),
        ...style,
      }}
    />
  );
}
