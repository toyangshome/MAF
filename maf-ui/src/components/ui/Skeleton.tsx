import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
  className,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className ?? ''}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        ...style,
      }}
    />
  );
}

interface SkeletonGroupProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  style?: React.CSSProperties;
}

export function SkeletonGroup({ lines = 3, lineHeight = 14, gap = 8, style }: SkeletonGroupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  style?: React.CSSProperties;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  return (
    <div
      style={{
        background: 'var(--gray-2)',
        border: '1px solid var(--gray-6)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      <Skeleton height={18} width="40%" />
      <SkeletonGroup lines={3} />
    </div>
  );
}
