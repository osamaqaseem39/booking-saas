import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function RequireSelfOrRoles({
  anyOf,
  selfRole,
  paramName,
  children,
}: {
  anyOf: string[];
  selfRole: string;
  paramName: string;
  children: ReactNode;
}) {
  const { session } = useSession();
  const params = useParams();
  const targetId = (params[paramName] ?? '').trim();
  const sessionId = (session?.id ?? '').trim();
  const roles = session?.roles ?? [];

  const hasRoleAccess = anyOf.some((r) => roles.includes(r));
  const hasSelfAccess =
    roles.includes(selfRole) && Boolean(targetId) && targetId === sessionId;

  if (!hasRoleAccess && !hasSelfAccess) return <Navigate to="/app" replace />;
  return children;
}
