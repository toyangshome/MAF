import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Switch({ checked, onCheckedChange, label, disabled, size = 'md' }: SwitchProps) {
  const dims = size === 'sm'
    ? { width: 32, height: 18, thumb: 14, translate: 14 }
    : { width: 40, height: 22, thumb: 18, translate: 18 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        style={{
          width: dims.width,
          height: dims.height,
          borderRadius: '9999px',
          border: '1px solid var(--gray-7)',
          backgroundColor: checked ? 'var(--blue-9)' : 'var(--gray-4)',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s ease',
          flexShrink: 0,
          outline: 'none',
        }}
      >
        <SwitchPrimitive.Thumb
          style={{
            display: 'block',
            width: dims.thumb,
            height: dims.thumb,
            borderRadius: '9999px',
            backgroundColor: 'var(--gray-1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'transform 0.15s ease',
            transform: checked ? `translateX(${dims.translate}px)` : 'translateX(2px)',
          }}
        />
      </SwitchPrimitive.Root>
      {label && (
        <label
          style={{
            fontSize: '13px',
            color: disabled ? 'var(--gray-8)' : 'var(--gray-12)',
            userSelect: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={() => !disabled && onCheckedChange(!checked)}
        >
          {label}
        </label>
      )}
    </div>
  );
}
