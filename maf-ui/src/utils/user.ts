/**
 * 用户标识系统
 * 使用 localStorage 存储用户信息，首次访问随机分配昵称和颜色
 */

const STORAGE_KEY = 'maf-user-identity';

const PALETTE = [
  '#e06c75', // red
  '#61afef', // blue
  '#98c379', // green
  '#e5c07b', // yellow
  '#c678dd', // purple
  '#56b6c2', // cyan
  '#d19a66', // orange
  '#be5046', // dark red
  '#7ec699', // light green
  '#f78c6c', // light orange
];

export interface UserIdentity {
  id: string;
  nickname: string;
  color: string;
  createdAt: string;
}

function generateId(): string {
  return 'u-' + Math.random().toString(36).slice(2, 10);
}

function generateNickname(): string {
  const chars = '0123456789ABCDEF';
  const suffix = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `User-${suffix}`;
}

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export function getOrCreateUser(): UserIdentity {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = JSON.parse(stored) as UserIdentity;
      if (user.id && user.nickname && user.color) return user;
    }
  } catch {
    // corrupted data, regenerate
  }

  const user: UserIdentity = {
    id: generateId(),
    nickname: generateNickname(),
    color: randomColor(),
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function updateUserNickname(nickname: string): void {
  const user = getOrCreateUser();
  user.nickname = nickname;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}
