import React from 'react';
import { Navigate } from 'react-router-dom';
import { getPrimaryRole, getRolesFromToken } from '@/lib/api/auth';

type Props = {
  allow: Array<'admin'|'accountant'|'editor'|'viewer'>;
  children: React.ReactNode;
};

export default function RoleGuard({ allow, children }: Props) {
  const token = localStorage.getItem('accessToken');
  const roles = getRolesFromToken();
  const allowed = roles.some(r => allow.includes(r as any));
  if (!token || !allowed) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}