/** User-facing labels for the restaurant back office (not "CMS"). */

export const BRAND_NAME = 'Saraya';

/** Main name shown on login and admin shell */
export const ADMIN_PANEL_TITLE = 'Upravljanje restoranom';

export const ADMIN_PANEL_TAGLINE = 'Poslovni panel restorana';

export const LOGIN_EMAIL_SUBTITLE =
  'Unesite email, zatim svoj trocifreni PIN';

export function venueLoginTitle(venueName: string): string {
  return `Prijava — ${venueName}`;
}

export const VENUE_LOGIN_FOOTER =
  'Osoblje kuhinje ide na ekran kuhinje, bar na bar; vlasnici i menadžeri imaju puni pristup. Platformski admini: /admin/login';

export const BTN_CONTINUE = 'Nastavi';
export const BTN_SIGN_IN = 'Prijavi se';
export const BTN_ACTIVATE = 'Aktiviraj i prijavi se';
export const BTN_DIFFERENT_EMAIL = 'Drugi email';

export const INVITE_HELP =
  'Prva prijava. Unesite šestocifreni kod od administratora, zatim postavite lozinku.';

/** Sidebar: data is stored in Supabase. */
export const DATA_STORAGE_TITLE = 'Pohrana podataka';
export const DATA_STORAGE_LINE =
  'Meni, lokali, narudžbe i korisnici → Supabase · slike → bucket sarayamenu';
