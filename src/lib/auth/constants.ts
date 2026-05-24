export const SESSION_COOKIE_NAME = 'sarayamenu_session';
export const SESSION_HEADER_NAME = 'x-sarayamenu-session';
export const SESSION_MAX_AGE_DAYS = 7;

/** Columns safe to return to the browser (never includes password_hash). */
export const USER_PUBLIC_COLUMNS =
  'id, name, email, avatar, platform_role, created_at' as const;
