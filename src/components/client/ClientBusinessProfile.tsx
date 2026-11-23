import React, { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  Clock,
  Save,
  Image as ImageIcon,
  Plus,
  Trash2,
  Wifi,
  Coffee,
  Car,
  CreditCard,
  Tv,
  CheckCircle2,
  Upload,
  Link2,
  Globe,
  Facebook,
  Instagram,
  X,
} from 'lucide-react';
import { Business, BusinessCategory, Language } from '../../types';
import { getTranslation } from '../../utils/i18n';
import {
  BUSINESS_DESCRIPTION_CARD_LIMIT,
  BUSINESS_PROFILE_DESCRIPTION_MAX_LENGTH,
  BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH,
  getBusinessProfileCompletion,
} from '../../utils/businessProfile';
import { useLocationCatalog } from '../../hooks/useLocationCatalog';
import type { BusinessProfileNotApplicableField } from '../../types';
import type { BusinessProfileRequiredField } from '../../utils/businessProfile';

interface ClientBusinessProfileProps {
  business: Business;
  categories: BusinessCategory[];
  currentLang?: Language;
  onUpdateBusiness: (updated: Business) => Promise<void>;
}

const readLocalImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    reject(new Error('Formato não suportado. Use JPG, PNG, WebP ou GIF.'));
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    reject(new Error('O ficheiro excede o limite de 25 MB da versão de demonstração.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro local.'));
  reader.readAsDataURL(file);
});

export const ClientBusinessProfile: React.FC<ClientBusinessProfileProps> = ({
  business,
  categories,
  currentLang = 'pt' as Language,
  onUpdateBusiness,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const { locations: bissauLocations } = useLocationCatalog();
  const [name, setName] = useState(business.name);
  const [categoryId, setCategoryId] = useState(business.categoryId || '');
  const [subcategoryId, setSubcategoryId] = useState(business.subcategoryId || '');
  const [description, setDescription] = useState(business.description);
  const [neighborhood, setNeighborhood] = useState(business.neighborhood || '');
  const [address, setAddress] = useState(business.address || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [whatsapp, setWhatsapp] = useState(business.whatsapp || '');
  const [publicEmail, setPublicEmail] = useState(business.publicEmail || '');
  const [website, setWebsite] = useState(business.website || '');
  const [facebookUrl, setFacebookUrl] = useState(business.socialLinks?.facebook || '');
  const [instagramUrl, setInstagramUrl] = useState(business.socialLinks?.instagram || '');
  const [logo, setLogo] = useState(business.logo);
  const [coverImage, setCoverImage] = useState(business.coverImage || '');
  const [gallery, setGallery] = useState<string[]>(business.gallery || []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [openingHours, setOpeningHours] = useState(business.openingHours || '');
  const [serviceLanguages, setServiceLanguages] = useState<Language[]>(business.serviceLanguages || []);
  const [notApplicableFields, setNotApplicableFields] = useState<BusinessProfileNotApplicableField[]>(business.notApplicableFields || []);
  const [services, setServices] = useState<string[]>(business.features || []);
  const [newService, setNewService] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setName(business.name);
    setCategoryId(business.categoryId || '');
    setSubcategoryId(business.subcategoryId || '');
    setDescription(business.description);
    setNeighborhood(business.neighborhood || '');
    setAddress(business.address || '');
    setPhone(business.phone || '');
    setWhatsapp(business.whatsapp || '');
    setPublicEmail(business.publicEmail || '');
    setWebsite(business.website || '');
    setFacebookUrl(business.socialLinks?.facebook || '');
    setInstagramUrl(business.socialLinks?.instagram || '');
    setLogo(business.logo);
    setCoverImage(business.coverImage || '');
    setGallery(business.gallery || []);
    setOpeningHours(business.openingHours || '');
    setServiceLanguages(business.serviceLanguages || []);
    setNotApplicableFields(business.notApplicableFields || []);
    setServices(business.features || []);
  }, [
    business.id,
    business.name,
    business.categoryId,
    business.subcategoryId,
    business.description,
    business.neighborhood,
    business.address,
    business.phone,
    business.whatsapp,
    business.publicEmail,
    business.website,
    business.socialLinks,
    business.logo,
    business.coverImage,
    business.gallery,
    business.openingHours,
    business.serviceLanguages,
    business.notApplicableFields,
    business.features,
  ]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const profileCompletion = getBusinessProfileCompletion({
    name,
    categoryId,
    subcategoryId,
    description,
    phone,
    neighborhood,
    notApplicableFields,
  });
  const profileFieldLabels: Record<BusinessProfileRequiredField, string> = {
    name: 'Nome comercial',
    categoryId: 'Categoria',
    subcategoryId: 'Subcategoria',
    description: 'Descrição',
    phone: 'Telefone público',
    neighborhood: 'Bairro',
  };
  const recommendedFields: Array<{ field: BusinessProfileNotApplicableField; label: string; provided: boolean }> = [
    { field: 'address', label: 'Morada completa', provided: Boolean(address.trim()) },
    { field: 'openingHours', label: 'Horário de funcionamento', provided: Boolean(openingHours.trim()) },
    { field: 'publicEmail', label: 'Email público', provided: Boolean(publicEmail.trim()) },
    { field: 'whatsapp', label: 'WhatsApp', provided: Boolean(whatsapp.trim()) },
    { field: 'website', label: 'Website', provided: Boolean(website.trim()) },
    { field: 'socialLinks', label: 'Redes sociais', provided: Boolean(facebookUrl.trim() || instagramUrl.trim()) },
    { field: 'serviceLanguages', label: 'Idiomas de atendimento', provided: serviceLanguages.length > 0 },
  ];
  const missingRecommendedFields = recommendedFields
    .filter(({ field, provided }) => !provided && !notApplicableFields.includes(field))
    .map(({ label }) => label);

  const toggleNotApplicable = (field: BusinessProfileNotApplicableField) => {
    const markingNotApplicable = !notApplicableFields.includes(field);
    setNotApplicableFields((previous) => markingNotApplicable
      ? [...previous, field]
      : previous.filter((item) => item !== field));
    if (!markingNotApplicable) return;
    if (field === 'address') setAddress('');
    if (field === 'openingHours') setOpeningHours('');
    if (field === 'publicEmail') setPublicEmail('');
    if (field === 'whatsapp') setWhatsapp('');
    if (field === 'website') setWebsite('');
    if (field === 'socialLinks') {
      setFacebookUrl('');
      setInstagramUrl('');
    }
    if (field === 'serviceLanguages') setServiceLanguages([]);
  };

  const renderNotApplicableToggle = (field: BusinessProfileNotApplicableField, label: string) => (
    <label className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
      <input
        type="checkbox"
        checked={notApplicableFields.includes(field)}
        onChange={() => toggleNotApplicable(field)}
        aria-label={`${label}: não aplicável`}
      />
      Não aplicável
    </label>
  );

  const handleToggleService = (service: string) => {
    setServices((previous) => previous.includes(service)
      ? previous.filter((item) => item !== service)
      : [...previous, service]);
  };

  const handleAddCustomService = () => {
    const service = newService.trim();
    if (!service || services.includes(service)) return;
    setServices((previous) => [...previous, service]);
    setNewService('');
  };

  const handleAddGalleryUrl = () => {
    const url = newGalleryUrl.trim();
    if (!url || gallery.includes(url)) return;
    setGallery((previous) => [...previous, url]);
    setNewGalleryUrl('');
  };

  const handleLocalLogo = async (file?: File) => {
    if (!file) return;
    try {
      setLogo(await readLocalImage(file));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao carregar o logotipo.');
    }
  };

  const handleLocalCover = async (file?: File) => {
    if (!file) return;
    try {
      setCoverImage(await readLocalImage(file));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao carregar a capa.');
    }
  };

  const handleLocalGallery = async (files: FileList | null) => {
    if (!files) return;
    try {
      const images = await Promise.all(Array.from(files).map(readLocalImage));
      setGallery((previous) => [...previous, ...images.filter((image) => !previous.includes(image))]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao carregar a galeria.');
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (trimmedDescription.length < BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH) {
      setSaveError(`A descrição da empresa é obrigatória e deve ter pelo menos ${BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH} caracteres.`);
      return;
    }
    const updated: Business = {
      ...business,
      name: name.trim(),
      categoryId,
      subcategoryId,
      groupGroupId: selectedCategory?.groupId || business.groupGroupId,
      description: trimmedDescription,
      neighborhood,
      address: address.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      publicEmail: publicEmail.trim() || undefined,
      website: website.trim() || undefined,
      socialLinks: {
        facebook: facebookUrl.trim() || undefined,
        instagram: instagramUrl.trim() || undefined,
      },
      logo,
      coverImage,
      gallery,
      openingHours: openingHours.trim(),
      features: services,
      serviceLanguages,
      notApplicableFields,
    };
    setIsSaving(true);
    setIsSaved(false);
    setSaveError('');
    try {
      await onUpdateBusiness(updated);
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 4000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível guardar o perfil da empresa.');
    } finally {
      setIsSaving(false);
    }
  };

  const DEFAULT_AMENITIES = [
    { label: 'Wi-Fi Gratuito', icon: Wifi },
    { label: 'Esplanada / Ar Livre', icon: Coffee },
    { label: 'Ar Condicionado', icon: Tv },
    { label: 'Estacionamento Próprio', icon: Car },
    { label: 'Pagamentos Orange Money / Telecel', icon: CreditCard },
  ];

  const mediaInputClass = 'w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const textInputClass = 'w-full rounded-xl border border-[var(--color-border-default)] dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            <Building2 className="h-3.5 w-3.5" />
            <span>{t('myBusinessArea')} · {t('officialProfile')}</span>
          </div>
          <h2 className="text-xl font-black text-[var(--color-text-strong)] sm:text-2xl">Dados públicos de {name}</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">{t('businessProfileDescription')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSaved && (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700" role="status">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Dados guardados.</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border-default)] dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            aria-expanded={showPreview}
          >
            <Globe className="h-4 w-4 text-blue-600" />
            {showPreview ? 'Fechar pré-visualização' : 'Pré-visualizar perfil'}
          </button>
        </div>
      </div>

      <section className="space-y-2 rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4" aria-labelledby="business-profile-completion-heading">
        <div className="flex items-center justify-between gap-3">
          <h3 id="business-profile-completion-heading" className="text-sm font-black text-slate-900">Completude do perfil</h3>
          <span className="text-sm font-black text-blue-700">{profileCompletion.percentage}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Completude do perfil"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={profileCompletion.percentage}
          className="h-2 overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${profileCompletion.percentage}%` }} />
        </div>
        {profileCompletion.missingFields.length > 0 ? (
          <p className="text-xs text-slate-600">
            Campos obrigatórios em falta: {profileCompletion.missingFields.map((field) => profileFieldLabels[field]).join(', ')}.
          </p>
        ) : (
          <p className="text-xs font-semibold text-emerald-700">Perfil completo.</p>
        )}
        {missingRecommendedFields.length > 0 && (
          <p className="text-xs text-slate-600">
            Informações recomendadas em falta: {missingRecommendedFields.join(', ')}.
          </p>
        )}
      </section>

      {saveError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{saveError}</p>}

      {showPreview && (
        <section className="overflow-hidden rounded-2xl border border-blue-200 bg-slate-50 dark:bg-slate-800 shadow-sm" aria-label="Pré-visualização do perfil público">
          <div className="relative h-32 bg-slate-200 sm:h-40">
            {coverImage ? <img src={coverImage} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-slate-800 via-blue-900 to-emerald-800" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
            <div className="absolute bottom-3 left-4 flex items-end gap-3 text-white sm:left-6">
              <img src={logo} alt="" className="h-14 w-14 rounded-2xl border-2 border-white/80 bg-white dark:bg-slate-900 object-cover shadow-lg" />
              <div>
                <h3 className="text-base font-black sm:text-lg">{name || 'Nome da empresa'}</h3>
                <p className="text-[11px] font-semibold text-white/85">{neighborhood || t('business.Todos')} · Perfil verificado</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-3.5 sm:p-4">
            <p className="text-sm leading-relaxed text-slate-700">{description || 'A descrição da empresa aparecerá aqui.'}</p>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
              {phone && <span className="rounded-full bg-white dark:bg-slate-900 px-3 py-1.5">{phone}</span>}
              {openingHours && <span className="rounded-full bg-white dark:bg-slate-900 px-3 py-1.5">{openingHours}</span>}
              {services.slice(0, 4).map((service) => <span key={service} className="rounded-full bg-white dark:bg-slate-900 px-3 py-1.5">{service}</span>)}
            </div>
          </div>
        </section>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <section className="space-y-4" aria-labelledby="business-basic-data">
          <div>
            <h3 id="business-basic-data" className="text-sm font-black text-slate-900">{t('mainInformation')}</h3>
            <p className="mt-1 text-[11px] text-slate-500">{t('businessBasicHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="business-name" className="mb-1 block text-xs font-bold text-slate-700">Nome comercial</label>
              <input id="business-name" type="text" aria-required="true" value={name} onChange={(e) => setName(e.target.value)} className={textInputClass} />
            </div>
            <div>
              <label htmlFor="business-neighborhood" className="mb-1 block text-xs font-bold text-slate-700"><MapPin className="mr-1 inline h-3.5 w-3.5" />Bairro</label>
              <select id="business-neighborhood" aria-required="true" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={textInputClass}>
                <option value="">Selecione o bairro</option>
                {business.neighborhood && !bissauLocations.some((entry) => entry.name === business.neighborhood || entry.aliases.includes(business.neighborhood))
                  && <option value={business.neighborhood}>{business.neighborhood}</option>}
                {bissauLocations.map((entry) => (
                  <option key={entry.id} value={entry.name}>{entry.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="business-category" className="mb-1 block text-xs font-bold text-slate-700">Categoria</label>
              <select
                id="business-category"
                aria-required="true"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setSubcategoryId('');
                }}
                className={textInputClass}
              >
                <option value="">Selecione a categoria</option>
                <option value="todos">Todos</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="business-subcategory" className="mb-1 block text-xs font-bold text-slate-700">Subcategoria</label>
              <select
                id="business-subcategory"
                aria-required="true"
                value={subcategoryId}
                onChange={(event) => setSubcategoryId(event.target.value)}
                className={textInputClass}
                disabled={!selectedCategory}
              >
                <option value="">Selecione a subcategoria</option>
                {selectedCategory?.subcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="business-description" className="mb-1 block text-xs font-bold text-slate-700">Descrição e apresentação</label>
            <textarea
              id="business-description"
              rows={5}
              required
              minLength={BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH}
              maxLength={BUSINESS_PROFILE_DESCRIPTION_MAX_LENGTH}
              aria-required="true"
              aria-describedby="business-description-hint"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${textInputClass} font-medium leading-relaxed`}
              placeholder="Descreva as especialidades, ambiente, história e diferenciais..."
            />
            <p id="business-description-hint" className="mt-1 text-[11px] text-slate-500">
              Obrigatória. Use pelo menos {BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH} caracteres; o cartão mostra os primeiros {BUSINESS_DESCRIPTION_CARD_LIMIT} com “Ler mais”.
            </p>
            <p className={`mt-1 text-[11px] font-bold ${description.trim().length < BUSINESS_PROFILE_DESCRIPTION_MIN_LENGTH ? 'text-amber-600' : 'text-emerald-700'}`}>
              {description.trim().length}/{BUSINESS_PROFILE_DESCRIPTION_MAX_LENGTH} caracteres
            </p>
          </div>
          <div>
            <label htmlFor="business-address" className="mb-1 block text-xs font-bold text-slate-700">Morada completa</label>
            <input id="business-address" type="text" disabled={notApplicableFields.includes('address')} value={address} onChange={(e) => setAddress(e.target.value)} className={textInputClass} placeholder="Rua, referência, zona e cidade" />
            {renderNotApplicableToggle('address', 'Morada completa')}
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-6" aria-labelledby="business-media-data">
          <div>
            <h3 id="business-media-data" className="text-sm font-black text-slate-900">Imagens e galeria</h3>
            <p className="mt-1 text-[11px] text-slate-500">Use um ficheiro do dispositivo ou um URL. Os ficheiros locais ficam guardados como Data URL nesta versão de demonstração.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="mb-1 block text-xs font-bold text-slate-700"><ImageIcon className="mr-1 inline h-3.5 w-3.5" />Logotipo</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-3 text-[11px] font-black text-emerald-800 hover:bg-emerald-100">
                  <Upload className="h-4 w-4" /><span>Carregar</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleLocalLogo(e.target.files?.[0])} />
                </label>
                <input type="text" value={logo.startsWith('data:') ? '' : logo} onChange={(e) => setLogo(e.target.value)} className={mediaInputClass} placeholder="URL do logotipo" />
              </div>
              {logo && <img src={logo} alt="Pré-visualização do logotipo" className="h-24 w-24 rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700 object-cover" />}
            </div>
            <div className="space-y-2">
              <label className="mb-1 block text-xs font-bold text-slate-700"><ImageIcon className="mr-1 inline h-3.5 w-3.5" />Foto de capa / fachada</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-3 text-[11px] font-black text-blue-800 hover:bg-blue-100">
                  <Upload className="h-4 w-4" /><span>Carregar</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleLocalCover(e.target.files?.[0])} />
                </label>
                <input type="text" value={coverImage.startsWith('data:') ? '' : coverImage} onChange={(e) => setCoverImage(e.target.value)} className={mediaInputClass} placeholder="URL da capa" />
              </div>
              {coverImage && <img src={coverImage} alt="Pré-visualização da capa" className="h-24 w-full rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700 object-cover" />}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-slate-900">Galeria de fotos</h4>
                <p className="mt-0.5 text-[10px] text-slate-500">Adicione várias fotos locais ou por URL.</p>
              </div>
              <span className="rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 text-[10px] font-black text-slate-600">{gallery.length} foto(s)</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto]">
              <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black text-slate-800 hover:bg-slate-100">
                <Upload className="h-4 w-4" /><span>Carregar</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => handleLocalGallery(e.target.files)} />
              </label>
              <input type="url" value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} className={`${mediaInputClass} bg-white dark:bg-slate-900`} placeholder="URL de outra foto" />
              <button type="button" onClick={handleAddGalleryUrl} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-black text-white hover:bg-slate-700"><Plus className="h-3.5 w-3.5" />Adicionar</button>
            </div>
            {gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {gallery.map((image, index) => (
                  <div key={`${image}-${index}`} className="group relative h-24 overflow-hidden rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-white dark:bg-slate-900">
                    <img src={image} alt={`Foto ${index + 1} da empresa`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setGallery((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label={`Remover foto ${index + 1}`} title="Remover foto"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-6" aria-labelledby="business-contacts-data">
          <div>
            <h3 id="business-contacts-data" className="text-sm font-black text-slate-900">Contactos e presença digital</h3>
            <p className="mt-1 text-[11px] text-slate-500">Estes dados permitem que os clientes encontrem e contactem a empresa.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="business-phone" className="mb-1 block text-xs font-bold text-slate-700"><Phone className="mr-1 inline h-3.5 w-3.5" />Telefone público</label>
              <input id="business-phone" type="text" aria-required="true" value={phone} onChange={(e) => setPhone(e.target.value)} className={textInputClass} placeholder="+245 955 000 000" />
            </div>
            <div>
              <label htmlFor="business-whatsapp" className="mb-1 block text-xs font-bold text-slate-700"><MessageCircle className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />WhatsApp</label>
              <input id="business-whatsapp" type="text" disabled={notApplicableFields.includes('whatsapp')} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={textInputClass} placeholder="+245 955 000 000" />
              {renderNotApplicableToggle('whatsapp', 'WhatsApp')}
            </div>
            <div>
              <label htmlFor="business-public-email" className="mb-1 block text-xs font-bold text-slate-700"><Mail className="mr-1 inline h-3.5 w-3.5" />Email público</label>
              <input id="business-public-email" type="email" disabled={notApplicableFields.includes('publicEmail')} value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} className={textInputClass} placeholder="contacto@empresa.gw" />
              {renderNotApplicableToggle('publicEmail', 'Email público')}
            </div>
            <div>
              <label htmlFor="business-opening-hours" className="mb-1 block text-xs font-bold text-slate-700"><Clock className="mr-1 inline h-3.5 w-3.5" />Horário</label>
              <input id="business-opening-hours" type="text" disabled={notApplicableFields.includes('openingHours')} value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className={textInputClass} placeholder="Seg-Sáb: 08:00 - 22:00" />
              {renderNotApplicableToggle('openingHours', 'Horário')}
            </div>
            <div>
              <label htmlFor="business-website" className="mb-1 block text-xs font-bold text-slate-700"><Globe className="mr-1 inline h-3.5 w-3.5" />Website</label>
              <input id="business-website" type="url" disabled={notApplicableFields.includes('website')} value={website} onChange={(e) => setWebsite(e.target.value)} className={textInputClass} placeholder="https://empresa.gw" />
              {renderNotApplicableToggle('website', 'Website')}
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold text-slate-700">Redes sociais</span>
              <div className="space-y-2">
                <label htmlFor="business-facebook" className="sr-only">Facebook</label>
                <input id="business-facebook" type="url" disabled={notApplicableFields.includes('socialLinks')} value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={textInputClass} placeholder="URL do Facebook" />
                <label htmlFor="business-instagram" className="sr-only">Instagram</label>
                <input id="business-instagram" type="url" disabled={notApplicableFields.includes('socialLinks')} value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={textInputClass} placeholder="URL do Instagram" />
                {renderNotApplicableToggle('socialLinks', 'Redes sociais')}
              </div>
            </div>
          </div>
          <fieldset className="rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 p-3" disabled={notApplicableFields.includes('serviceLanguages')}>
            <legend className="px-1 text-xs font-bold text-slate-700">Idiomas de atendimento</legend>
            <div className="flex flex-wrap gap-3">
              {(['pt', 'fr', 'en', 'es'] as Language[]).map((language) => (
                <label key={language} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={serviceLanguages.includes(language)}
                    onChange={() => setServiceLanguages((previous) => previous.includes(language)
                      ? previous.filter((item) => item !== language)
                      : [...previous, language])}
                  />
                  {language.toUpperCase()}
                </label>
              ))}
            </div>
            {renderNotApplicableToggle('serviceLanguages', 'Idiomas de atendimento')}
          </fieldset>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-6" aria-labelledby="business-services-data">
          <div>
            <h3 id="business-services-data" className="text-sm font-black text-slate-900">Serviços e comodidades</h3>
            <p className="mt-1 text-[11px] text-slate-500">Seleccione opções existentes ou adicione características específicas do seu negócio.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_AMENITIES.map((amenity) => {
              const Icon = amenity.icon;
              const selected = services.includes(amenity.label);
              return <button key={amenity.label} type="button" onClick={() => handleToggleService(amenity.label)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 hover:bg-slate-200'}`}><Icon className="mr-1.5 inline h-3.5 w-3.5" />{amenity.label}</button>;
            })}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input type="text" value={newService} onChange={(e) => setNewService(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomService(); } }} placeholder="Adicionar outro serviço personalizado" className={textInputClass} />
            <button type="button" onClick={handleAddCustomService} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700"><Plus className="h-4 w-4" />Adicionar</button>
          </div>
          {services.filter((service) => !DEFAULT_AMENITIES.some((amenity) => amenity.label === service)).length > 0 && <div className="flex flex-wrap gap-2">{services.filter((service) => !DEFAULT_AMENITIES.some((amenity) => amenity.label === service)).map((service) => <span key={service} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-700">{service}<button type="button" onClick={() => handleToggleService(service)} aria-label={`Remover ${service}`} title="Remover"><Trash2 className="h-3 w-3 text-red-500" /></button></span>)}</div>}
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-semibold text-slate-500">O perfil só será confirmado depois de ser guardado no servidor.</span>
          <button type="submit" disabled={isSaving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[.98] disabled:cursor-wait disabled:opacity-60">
            <Save className="h-4 w-4" />{isSaving ? 'A guardar…' : 'Actualizar dados da empresa'}
          </button>
        </div>
      </form>
    </div>
  );
};
