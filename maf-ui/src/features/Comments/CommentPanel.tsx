import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getOrCreateUser } from '../../utils/user';
import type { Comment } from '../../types';

/* ─── Slide animation ─────────────────────────────────────────────── */

const COMMENT_ANIM_CSS = `
@keyframes comment-fade-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
`;
if (typeof document !== 'undefined' && !document.getElementById('comment-anim')) {
  const s = document.createElement('style');
  s.id = 'comment-anim';
  s.textContent = COMMENT_ANIM_CSS;
  document.head.appendChild(s);
}

/* ─── helpers ──────────────────────────────────────────────────────── */

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── CommentBubble ────────────────────────────────────────────────── */

function CommentBubble({
  comment,
  canDelete,
  onDelete,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        background: 'var(--gray-3)',
        animation: 'comment-fade-in 0.15s ease',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: comment.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-12)' }}>
          {comment.nickname}
        </span>
        <span
          style={{ fontSize: '10px', color: 'var(--gray-9)', marginLeft: 'auto' }}
          title={formatTime(comment.timestamp)}
        >
          {relativeTime(comment.timestamp)}
        </span>
        {canDelete && hovered && (
          <button
            onClick={onDelete}
            title="Delete comment"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 4,
              border: 'none',
              background: 'var(--red-4)',
              color: 'var(--red-11)',
              cursor: 'pointer',
              fontSize: 10,
              padding: 0,
              marginLeft: 2,
            }}
          >
            x
          </button>
        )}
      </div>
      {/* Content */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--gray-11)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          paddingLeft: 12,
        }}
      >
        {comment.content}
      </div>
    </div>
  );
}

/* ─── CommentPanel ─────────────────────────────────────────────────── */

export default function CommentPanel({ taskId }: { taskId: string }) {
  const comments = useAppStore(
    (s) => s.tasks.find((t) => t.id === taskId)?.comments || []
  );
  const addComment = useAppStore((s) => s.addComment);
  const deleteComment = useAppStore((s) => s.deleteComment);

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const user = getOrCreateUser();

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    addComment(taskId, trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--gray-10)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        <span>Comments</span>
        {comments.length > 0 && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--gray-8)',
              background: 'var(--gray-4)',
              padding: '1px 6px',
              borderRadius: 999,
              fontWeight: 500,
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      {comments.length > 0 ? (
        <div
          ref={listRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 240,
            overflowY: 'auto',
            marginBottom: 8,
            paddingRight: 2,
          }}
        >
          {comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              canDelete={c.userId === user.id}
              onDelete={() => deleteComment(taskId, c.id)}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '12px 0',
            textAlign: 'center',
            color: 'var(--gray-9)',
            fontSize: '11px',
            marginBottom: 8,
          }}
        >
          No comments yet. Be the first to comment.
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: user.color,
            flexShrink: 0,
            marginTop: 8,
          }}
        />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid var(--gray-5)',
            background: 'var(--gray-1)',
            color: 'var(--gray-12)',
            fontSize: '12px',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-8)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-5)';
          }}
        />
      </div>
      <div style={{ fontSize: '10px', color: 'var(--gray-8)', marginTop: 2, paddingLeft: 12 }}>
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
