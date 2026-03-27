const PUBLIC_ROUTES = new Set(['/login', '/settings']);

export function isPublicRoute(route) {
  return PUBLIC_ROUTES.has(route);
}

export function shouldAllowRoute(route, hasSession) {
  if (isPublicRoute(route)) return true;
  return Boolean(hasSession);
}
