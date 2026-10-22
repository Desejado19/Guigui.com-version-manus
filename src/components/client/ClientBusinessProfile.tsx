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
import { Business, Language } from '../../types';
import { getTranslation } from '../../utils/i18n';

interface ClientBusinessProfileProps {
  business: Business;
  currentLang?: Language;
  onUpdateBusiness: (updated: Business) => void;
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
  currentLang = 'pt' as Language,
  onUpdateBusiness,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description);
  const [neighborhood, setNeighborhood] = useState(business.neighborhood || 'Praça Centro (Bissau)');
  const [address, setAddress] = useState(business.address || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [whatsapp, setWhatsapp] = useState(business.whatsapp || '');
  const [email, setEmail] = useState(business.email || '');
  const [website, setWebsite] = useState(business.website || '');
  const [facebookUrl, setFacebookUrl] = useState(business.socialLinks?.facebook || '');
  const [instagramUrl, setInstagramUrl] = useState(business.socialLinks?.instagram || '');
  const [logo, setLogo] = useState(business.logo);
  const [coverImage, setCoverImage] = useState(business.coverImage || '');
  const [gallery, setGallery] = useState<string[]>(business.gallery || []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [openingHours, setOpeningHours] = useState(business.openingHours || 'Segunda a Sábado: 08:00 - 22:00');
  const [services, setServices] = useState<string[]>(
    business.features || ['Wi-Fi Gratuito', 'Esplanada', 'Ar Condicionado', 'Orange Money / Telecel']
  );
  const [newService, setNewService] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setName(business.name);
    setDescription(business.description);
    setNeighborhood(business.neighborhood || 'Praça Centro (Bissau)');
    setAddress(business.address || '');
    setPhone(business.phone || '');
    setWhatsapp(business.whatsapp || '');
    setEmail(business.email || '');
    setWebsite(business.website || '');
    setFacebookUrl(business.socialLinks?.facebook || '');
    setInstagramUrl(business.socialLinks?.instagram || '');
    setLogo(business.logo);
    setCoverImage(business.coverImage || '');
    setGallery(business.gallery || []);
    setOpeningHours(business.openingHours || 'Segunda a Sábado: 08:00 - 22:00');
    setServices(business.features || ['Wi-Fi Gratuito', 'Esplanada', 'Ar Condicionado', 'Orange Money / Telecel']);
  }, [business.id]);

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

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const updated: Business = {
      ...business,
      name: name.trim(),
      description: description.trim(),
      neighborhood,
      address: address.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim() || undefined,
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
    };
    onUpdateBusiness(updated);
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 4000);
  };

  const DEFAULT_AMENITIES = [
    { label: 'Wi-Fi Gratuito', icon: Wifi },
    { label: 'Esplanada / Ar Livre', icon: Coffee },
    { label: 'Ar Condicionado', icon: Tv },
    { label: 'Estacionamento Próprio', icon: Car },
    { label: 'Pagamentos Orange Money / Telecel', icon: CreditCard },
  ];

  const mediaInputClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const textInputClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
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
              <span>{t('businessDataUpdated')}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            aria-expanded={showPreview}
          >
            <Globe className="h-4 w-4 text-blue-600" />
            {showPreview ? 'Fechar pré-visualização' : 'Pré-visualizar perfil'}
          </button>
        </div>
      </div>

      {showPreview && (
        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-slate-50 shadow-sm" aria-label="Pré-visualização do perfil público">
          <div className="relative h-32 bg-slate-200 sm:h-40">
            {coverImage ? <img src={coverImage} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-slate-800 via-blue-900 to-emerald-800" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
            <div className="absolute bottom-3 left-4 flex items-end gap-3 text-white sm:left-6">
              <img src={logo} alt="" className="h-14 w-14 rounded-2xl border-2 border-white/80 bg-white object-cover shadow-lg" />
              <div>
                <h3 className="text-base font-black sm:text-lg">{name || 'Nome da empresa'}</h3>
                <p className="text-[11px] font-semibold text-white/85">{neighborhood || 'Bissau'} · Perfil verificado</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-slate-700">{description || 'A descrição da empresa aparecerá aqui.'}</p>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
              {phone && <span className="rounded-full bg-white px-3 py-1.5">{phone}</span>}
              {openingHours && <span className="rounded-full bg-white px-3 py-1.5">{openingHours}</span>}
              {services.slice(0, 4).map((service) => <span key={service} className="rounded-full bg-white px-3 py-1.5">{service}</span>)}
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
              <label className="mb-1 block text-xs font-bold text-slate-700">Nome comercial</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={textInputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700"><MapPin className="mr-1 inline h-3.5 w-3.5" />Localização</label>
              <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={textInputClass}>
                <option value="Praça Centro (Bissau)">Praça Centro (Bissau)</option>
                <option value="Bandim">Bandim (Mercado / Comercial)</option>
                <option value="Santa Luzia">Santa Luzia</option>
                <option value="Bairro Militar">Bairro Militar / Aeroporto</option>
                <option value="Bissau Velho">Bissau Velho (Porto / Histórico)</option>
                <option value="Ajuda">Ajuda / Alto Bandim</option>
                <option value="Antula">Antula</option>
                <option value="Cuntum">Cuntum</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Descrição e apresentação</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`${textInputClass} font-medium leading-relaxed`} placeholder="Descreva as especialidades, ambiente, história e diferenciais..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Morada completa</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={textInputClass} placeholder="Rua, referência, zona e cidade" />
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
                <input type="url" value={logo.startsWith('data:') ? '' : logo} onChange={(e) => setLogo(e.target.value)} className={mediaInputClass} placeholder="URL do logotipo" />
              </div>
              {logo && <img src={logo} alt="Pré-visualização do logotipo" className="h-24 w-24 rounded-2xl border border-slate-200 object-cover" />}
            </div>
            <div className="space-y-2">
              <label className="mb-1 block text-xs font-bold text-slate-700"><ImageIcon className="mr-1 inline h-3.5 w-3.5" />Foto de capa / fachada</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-3 text-[11px] font-black text-blue-800 hover:bg-blue-100">
                  <Upload className="h-4 w-4" /><span>Carregar</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleLocalCover(e.target.files?.[0])} />
                </label>
                <input type="url" value={coverImage.startsWith('data:') ? '' : coverImage} onChange={(e) => setCoverImage(e.target.value)} className={mediaInputClass} placeholder="URL da capa" />
              </div>
              {coverImage && <img src={coverImage} alt="Pré-visualização da capa" className="h-24 w-full rounded-2xl border border-slate-200 object-cover" />}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-slate-900">Galeria de fotos</h4>
                <p className="mt-0.5 text-[10px] text-slate-500">Adicione várias fotos locais ou por URL.</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">{gallery.length} foto(s)</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto]">
              <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white px-3 py-2 text-[11px] font-black text-slate-800 hover:bg-slate-100">
                <Upload className="h-4 w-4" /><span>Carregar</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => handleLocalGallery(e.target.files)} />
              </label>
              <input type="url" value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} className={`${mediaInputClass} bg-white`} placeholder="URL de outra foto" />
              <button type="button" onClick={handleAddGalleryUrl} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-[11px] font-black text-white hover:bg-slate-700"><Plus className="h-3.5 w-3.5" />Adicionar</button>
            </div>
            {gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {gallery.map((image, index) => (
                  <div key={`${image}-${index}`} className="group relative h-24 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><Phone className="mr-1 inline h-3.5 w-3.5" />Telefone</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={textInputClass} placeholder="+245 955 000 000" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><MessageCircle className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />WhatsApp</label><input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={textInputClass} placeholder="+245 955 000 000" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><Mail className="mr-1 inline h-3.5 w-3.5" />E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={textInputClass} placeholder="contacto@empresa.gw" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><Clock className="mr-1 inline h-3.5 w-3.5" />Horário</label><input type="text" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className={textInputClass} placeholder="Seg-Sáb: 08:00 - 22:00" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><Globe className="mr-1 inline h-3.5 w-3.5" />Website</label><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={textInputClass} placeholder="https://empresa.gw" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><Link2 className="mr-1 inline h-3.5 w-3.5" />Facebook</label><input type="url" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={textInputClass} placeholder="URL da página" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-700"><Instagram className="mr-1 inline h-3.5 w-3.5" />Instagram</label><input type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={textInputClass} placeholder="URL do perfil" /></div>
          </div>
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
              return <button key={amenity.label} type="button" onClick={() => handleToggleService(amenity.label)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}><Icon className="mr-1.5 inline h-3.5 w-3.5" />{amenity.label}</button>;
            })}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input type="text" value={newService} onChange={(e) => setNewService(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomService(); } }} placeholder="Adicionar outro serviço personalizado" className={textInputClass} />
            <button type="button" onClick={handleAddCustomService} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700"><Plus className="h-4 w-4" />Adicionar</button>
          </div>
          {services.filter((service) => !DEFAULT_AMENITIES.some((amenity) => amenity.label === service)).length > 0 && <div className="flex flex-wrap gap-2">{services.filter((service) => !DEFAULT_AMENITIES.some((amenity) => amenity.label === service)).map((service) => <span key={service} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700">{service}<button type="button" onClick={() => handleToggleService(service)} aria-label={`Remover ${service}`} title="Remover"><Trash2 className="h-3 w-3 text-red-500" /></button></span>)}</div>}
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-semibold text-slate-500">As alterações ficam guardadas na conta da empresa nesta demonstração.</span>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[.98]"><Save className="h-4 w-4" />Actualizar dados da empresa</button>
        </div>
      </form>
    </div>
  );
};
