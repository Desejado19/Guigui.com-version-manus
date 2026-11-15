import React, { useMemo } from 'react';
import { Building2, Copy, Megaphone, Star, Tag } from 'lucide-react';
import type { Business } from '../../../types';
import { ManagementKpiGrid, ManagementPage, ModuleNav, type ModuleNavItem } from './ManagementUi';

interface BusinessesModuleProps {
  businesses: Business[];
  onOpenList: (review?: 'all' | 'duplicates' | 'test') => void;
  onOpenFeatured: () => void;
  onOpenPromotions: () => void;
  onOpenCampaigns: () => void;
}

/**
 * Página principal do módulo Empresas & Negócios. Mostra os indicadores e os
 * botões que abrem directamente cada área de gestão.
 */
export const BusinessesModule: React.FC<BusinessesModuleProps> = ({
  businesses,
  onOpenList,
  onOpenFeatured,
  onOpenPromotions,
  onOpenCampaigns,
}) => {
  const counts = useMemo(() => ({
    total: businesses.length,
    active: businesses.filter((business) => business.status === 'active').length,
    pending: businesses.filter((business) => business.status === 'pending').length,
    suspended: businesses.filter((business) => business.status === 'suspended').length,
    rejected: businesses.filter((business) => business.status === 'rejected').length,
    featured: businesses.filter((business) => typeof business.homepageFeaturedOrder === 'number' && business.homepageFeaturedOrder >= 0).length,
  }), [businesses]);

  const items: ModuleNavItem[] = [
    { key: 'all', label: 'Lista de empresas', icon: <Building2 className="h-4 w-4" />, count: counts.total },
    { key: 'duplicates', label: 'Rever duplicações', icon: <Copy className="h-4 w-4" /> },
    { key: 'featured', label: 'Empresas em destaque', icon: <Star className="h-4 w-4" />, count: counts.featured },
    { key: 'promotions', label: 'Promoções', icon: <Tag className="h-4 w-4" /> },
    { key: 'campaigns', label: 'Campanhas publicitárias', icon: <Megaphone className="h-4 w-4" /> },
  ];

  const onSelect = (key: string) => {
    if (key === 'all' || key === 'duplicates') onOpenList(key);
    else if (key === 'featured') onOpenFeatured();
    else if (key === 'promotions') onOpenPromotions();
    else if (key === 'campaigns') onOpenCampaigns();
  };

  return (
    <ManagementPage
      title="Empresas & Negócios"
      description="Diretório empresarial da plataforma."
      moduleLabel="Empresas & Negócios"
      breadcrumbTail="Módulo"
    >
      <ManagementKpiGrid
        items={[
          { label: 'Total de empresas', value: counts.total, tone: 'info' },
          { label: 'Ativas', value: counts.active, tone: 'success' },
          { label: 'Pendentes', value: counts.pending, tone: 'warning' },
          { label: 'Suspensas', value: counts.suspended, tone: 'danger' },
          { label: 'Rejeitadas', value: counts.rejected, tone: 'neutral' },
        ]}
      />

      <ModuleNav items={items} onSelect={onSelect} ariaLabel="Submódulos de empresas" />
    </ManagementPage>
  );
};
