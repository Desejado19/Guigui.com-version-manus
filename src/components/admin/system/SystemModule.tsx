import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  Database,
  FileSearch,
  Gauge,
  Layers,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { ManagementPage, ModuleNav, type ModuleNavItem } from '../management/ManagementUi';
import type { SystemSection } from './systemApi';
import { SystemOverviewPage } from './SystemOverview';
import {
  SystemApisPage,
  SystemDatabasePage,
  SystemInfrastructurePage,
  SystemResourcesPage,
} from './SystemTechnicalSections';
import {
  SystemAvailabilityPage,
  SystemIncidentsPage,
  SystemLogsPage,
  SystemSecurityPage,
  SystemSettingsPage,
} from './SystemOperationsSections';

const SECTIONS: ModuleNavItem[] = [
  { key: 'overview', label: 'Visão Geral', icon: <Activity className="h-4 w-4" /> },
  { key: 'infrastructure', label: 'Infraestrutura', icon: <Server className="h-4 w-4" /> },
  { key: 'resources', label: 'Recursos & Capacidade', icon: <Gauge className="h-4 w-4" /> },
  { key: 'database', label: 'Base de Dados', icon: <Database className="h-4 w-4" /> },
  { key: 'apis', label: 'APIs & Integrações', icon: <Layers className="h-4 w-4" /> },
  { key: 'incidents', label: 'Incidentes & Alertas', icon: <AlertTriangle className="h-4 w-4" /> },
  { key: 'logs', label: 'Logs & Diagnóstico', icon: <FileSearch className="h-4 w-4" /> },
  { key: 'availability', label: 'Disponibilidade', icon: <CalendarCheck className="h-4 w-4" /> },
  { key: 'security', label: 'Segurança & Auditoria', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'settings', label: 'Configurações', icon: <Settings2 className="h-4 w-4" /> },
];

const DESCRIPTIONS: Record<SystemSection, string> = {
  overview: 'Saúde global do Guigui.com com indicadores medidos em tempo real.',
  infrastructure: 'Componentes reais da plataforma, estado e fontes de verificação.',
  resources: 'CPU, memória, disco, armazenamento e capacidade medida.',
  database: 'PostgreSQL: ligações, latência, tabelas, locks, backups e desempenho.',
  apis: 'Volume, erros e latência das rotas reais e das integrações configuradas.',
  incidents: 'Deteção automática, reconhecimento, resolução e histórico.',
  logs: 'Pesquisa e correlação de logs técnicos persistidos pela aplicação.',
  availability: 'Disponibilidade calculada a partir de amostras e incidentes.',
  security: 'Eventos de autenticação, autorização e administração da auditoria.',
  settings: 'Intervalos, limites, retenção, SLO e alertas com efeito real.',
};

export const SystemModule: React.FC = () => {
  const [section, setSection] = useState<SystemSection>('overview');
  const [refreshToken, setRefreshToken] = useState(0);

  const openSection = (next: SystemSection) => {
    setSection(next);
    setRefreshToken((value) => value + 1);
  };

  const renderSection = () => {
    switch (section) {
      case 'infrastructure':
        return <SystemInfrastructurePage refreshToken={refreshToken} />;
      case 'resources':
        return <SystemResourcesPage refreshToken={refreshToken} />;
      case 'database':
        return <SystemDatabasePage refreshToken={refreshToken} />;
      case 'apis':
        return <SystemApisPage refreshToken={refreshToken} />;
      case 'incidents':
        return <SystemIncidentsPage refreshToken={refreshToken} />;
      case 'logs':
        return <SystemLogsPage refreshToken={refreshToken} />;
      case 'availability':
        return <SystemAvailabilityPage refreshToken={refreshToken} />;
      case 'security':
        return <SystemSecurityPage refreshToken={refreshToken} />;
      case 'settings':
        return <SystemSettingsPage refreshToken={refreshToken} />;
      default:
        return <SystemOverviewPage refreshToken={refreshToken} onOpenSection={openSection} />;
    }
  };

  return (
    <ManagementPage
      title="Sistema"
      description={DESCRIPTIONS[section]}
      moduleLabel="Sistema"
      breadcrumbTail={SECTIONS.find((item) => item.key === section)?.label || 'Visão Geral'}
    >
      <ModuleNav items={SECTIONS} onSelect={(key) => openSection(key as SystemSection)} ariaLabel="Submódulos do Sistema" />
      <div>{renderSection()}</div>
    </ManagementPage>
  );
};
