import { Badge, BusinessLogo, Button, Card } from './ui';
import { BarChart3, Building2, Calendar, CreditCard, Download, FileText, History, KeyRound, LayoutDashboard, LifeBuoy, Megaphone, ShieldCheck, Star, Ticket, Users, Wallet } from 'lucide-react';
import { BUSINESS_MODULE_GROUPS, findBusinessModule, type BusinessModuleDefinition } from '../config/businessModules';
import type { Business } from '../types';

const MODULE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  my_business: Building2,
  content: FileText,
  events: Calendar,
  reviews: Star,
  marketing: Megaphone,
  tickets: Ticket,
  order_history: History,
  payouts: Wallet,
  clients: Users,
  billing: CreditCard,
  team: Users,
  support: LifeBuoy,
  settings: KeyRound,
  reports: BarChart3,
  security: ShieldCheck,
  export: Download,
};interface Props {
  module?: BusinessModuleDefinition;
  businessName?: string;
  tier?: string;
  action?: React.ReactNode;
}
export function ModuleHeader({ module, businessName, tier, action }: Props) {
  if (!module) return null;
  const Icon = MODULE_ICON[module.id] ?? LayoutDashboard;

  return (
    <Card className="min-w-0 border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 items-start gap-3 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] text-[var(--color-green-700)]">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 break-words text-base sm:text-lg font-black text-[var(--color-text-strong)]">
                {module.label}
              </h1>
              {businessName && module.id === 'my_business' && (
                <Badge variant="info" className="px-2 py-0.5 text-[9px] uppercase">
                  Escalão {tier ?? '—'}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {businessName && module.id === 'my_business'
                ? `${businessName} • Directório Guigui.com`
                : module.description}
            </p>
          </div>
        </div>

        {action && <div className="w-full sm:w-auto">{action}</div>}
      </div>
    </Card>
  );
}


function PlusCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}
