import React, { useCallback, useEffect, useState } from 'react';
import { Search, Users, ShieldCheck, Store, Loader2, Mail, Phone, MapPin, Building2 } from 'lucide-react';

type UserRole = 'user' | 'business' | 'admin';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  neighborhood?: string | null;
  role: UserRole;
  accountStatus: string;
  createdAt: string;
  companyId?: string | null;
  companyName?: string | null;
}

const ROLE_META: Record<UserRole, { label: string; className: string; icon: React.ReactNode }> = {
  admin: { label: 'Admin', className: 'bg-[var(--tone-info-bg)] text-[var(--tone-info-text)] border-[var(--tone-info-border)]', icon: <ShieldCheck className="w-3 h-3" /> },
  business: { label: 'Empresa', className: 'bg-[var(--tone-success-bg)] text-[var(--tone-success-text)] border-[var(--tone-success-border)]', icon: <Store className="w-3 h-3" /> },
  user: { label: 'Cidadao', className: 'bg-[var(--tone-info-bg)] text-[var(--tone-info-text)] border-[var(--tone-info-border)]', icon: <Users className="w-3 h-3" /> },
};

const ROLE_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos os papeis' },
  { value: 'user', label: 'Cidadaos' },
  { value: 'business', label: 'Empresas' },
  { value: 'admin', label: 'Administradores' },
];

export const AdminUsersHub: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (role) params.set('role', role);
      params.set('limit', '100');
      const response = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        setError(response.status === 503 ? 'Base de dados indisponivel.' : 'Nao foi possivel carregar os utilizadores.');
        setUsers([]);
        setTotal(0);
        return;
      }
      const data = await response.json();
      setUsers(data.users ?? []);
      setTotal(Number(data.total ?? 0));
    } catch {
      setError('Falha de rede ao carregar utilizadores.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, role]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Utilizadores da plataforma
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? 'A carregar...' : `${total} conta${total === 1 ? '' : 's'} registada${total === 1 ? '' : 's'} na base de dados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar nome ou email..."
              className="pl-9 pr-3 py-2 text-sm border border-[var(--color-border-default)] rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="py-2 px-3 text-sm border border-[var(--color-border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
          >
            {ROLE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--tone-danger-bg)] border border-[var(--tone-danger-border)] text-[var(--tone-danger-text)] text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="text-left font-bold px-4 py-3">Nome</th>
                <th className="text-left font-bold px-4 py-3">Contacto</th>
                <th className="text-left font-bold px-4 py-3">Papel</th>
                <th className="text-left font-bold px-4 py-3">Empresa</th>
                <th className="text-left font-bold px-4 py-3">Registado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />A carregar utilizadores...</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Nenhum utilizador encontrado para este filtro.</td></tr>
              )}
              {!loading && users.map((u) => {
                const meta = ROLE_META[u.role] ?? ROLE_META.user;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      {u.neighborhood && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><MapPin className="w-3 h-3" />{u.neighborhood}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{u.email}</div>
                      {u.phone && <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><Phone className="w-3 h-3" />{u.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${meta.className}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.companyName ? (
                        <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-slate-400" />{u.companyName}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-PT') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
