/** Match an actual route boundary, never part of a location's slug. */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
