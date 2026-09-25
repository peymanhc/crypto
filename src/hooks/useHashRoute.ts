import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'strategies' | 'builder' | 'backtest';

const ROUTES: Route[] = ['dashboard', 'strategies', 'builder', 'backtest'];

// GitHub Pages serves a single index.html, so pages live behind the hash:
//   https://.../crypto/            -> dashboard
//   https://.../crypto/#/backtest  -> backtest (also #/strategies and #/builder)
const parse = (hash: string): Route => {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES.includes(name as Route) ? (name as Route) : 'dashboard';
};

export const routeHref = (route: Route): string => (route === 'dashboard' ? '#/' : `#/${route}`);

export const useHashRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
};
