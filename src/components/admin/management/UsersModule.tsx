import React, { useEffect, useState } from 'react';
import { Activity, Building2, ShieldCheck, UserRound, UserX, Users } from 'lucide-react';
import { ManagementPage, ModuleNav, type ModuleNavItem } from './ManagementUi';

export type UsersSection = 'all' | 'citizens' | 'business' | 'admins' | 'suspended' | 'activity';

interface UsersModuleProps {
  onOpenSection: (section: UsersSection) => void;
}

interface Counts {
  total: number | null;
  citizens: number | null;
  businesses: number | null;
  admins: number | null;
  suspended: number | null;
}

const emptyCounts: Counts = { total: null, citizens: null, businesses: null, admins: null, suspended: null };

/**
 * Página principal do módulo Utilizadores. Cada submódulo abre directamente na
 * sua página de gestão; aqui existem apenas os botões de acesso.
 */
export const UsersModule: React.FC<UsersModuleProps> = ({ onOpenSection }) => {
  const [counts, setCounts] = useState<Counts>(emptyCounts);

  useEffect(() => {
    let cancelled = false;
    const loadCount = async (query: string) => {
      const response = await fetch(`/api/admin/users?limit=1&offset=0&${query}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao contar contas.');
      return Number(data.total || 0);
    };
    void (async () => {
      try {
        const [total, citizens, businesses, admins, suspended] = await Promise.all([
          loadCount(''),
          loadCount('role=user'),
          loadCount('role=business'),
          loadCount('role=admin'),
          loadCount('status=deactivated'),
        ]);
        if (!cancelled) setCounts({ total, citizens, businesses, admins, suspended });
      } catch {
        if (!cancelled) setCounts(emptyCounts);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items: ModuleNavItem[] = [
    { key: 'all', label: 'Todas as contas', icon: <Users className="h-4 w-4" />, count: counts.total ?? '—' },
    { key: 'citizens', label: 'Cidadãos', icon: <UserRound className="h-4 w-4" />, count: counts.citizens ?? '—' },
    { key: 'business', label: 'Empresas', icon: <Building2 className="h-4 w-4" />, count: counts.businesses ?? '—' },
    { key: 'admins', label: 'Administradores', icon: <ShieldCheck className="h-4 w-4" />, count: counts.admins ?? '—' },
    { key: 'suspended', label: 'Contas suspensas', icon: <UserX className="h-4 w-4" />, count: counts.suspended ?? '—' },
    { key: 'activity', label: 'Histórico de atividades', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <ManagementPage
      title="Utilizadores"
      description="Contas reais da plataforma."
      moduleLabel="Utilizadores"
      breadcrumbTail="Módulo"
    >
      <ModuleNav items={items} onSelect={(key) => onOpenSection(key as UsersSection)} ariaLabel="Submódulos de utilizadores" />
    </ManagementPage>
  );
};
