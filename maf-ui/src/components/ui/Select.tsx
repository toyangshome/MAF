import React from 'react';
import { Select as RadixSelect } from '@radix-ui/themes';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  width?: number | string;
  size?: '1' | '2' | '3';
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = '选择...',
  disabled,
  width,
  size = '2',
}: SelectProps) {
  return (
    <RadixSelect.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      size={size}
    >
      <RadixSelect.Trigger
        placeholder={placeholder}
        style={width ? { width } : undefined}
      />
      <RadixSelect.Content position="popper">
        {options.map((opt) => (
          <RadixSelect.Item key={opt.value} value={opt.value}>
            {opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
          </RadixSelect.Item>
        ))}
      </RadixSelect.Content>
    </RadixSelect.Root>
  );
}
