import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmColor = 'var(--red-9)',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            animation: 'fadeIn 200ms ease',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(420px, 90vw)',
            borderRadius: 12,
            border: '1px solid var(--gray-6)',
            background: 'var(--gray-2)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            animation: 'maf-slide-in 200ms ease',
            zIndex: 1001,
            outline: 'none',
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--gray-12)',
              lineHeight: 1.4,
            }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Description
            style={{
              marginTop: 8,
              fontSize: '13px',
              color: 'var(--gray-11)',
              lineHeight: 1.6,
            }}
          >
            {description}
          </Dialog.Description>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--gray-7)',
                  background: 'var(--gray-3)',
                  color: 'var(--gray-11)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                background: confirmColor,
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {confirmLabel}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'transparent',
                border: 'none',
                color: 'var(--gray-9)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Cross2Icon width={16} height={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
