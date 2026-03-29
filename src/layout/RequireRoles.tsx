import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function RequireRoles({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: ReactNode;
}) {
  const { session } = useSession();
  const ok = anyOf.some((r) => session?.roles?.includes(r));
  if (!ok) return <Navigate to="/app" replace />;
  return children;
}
