import React from 'react';
import {
  ExternalLink,
  Calendar,
  MessageCircle,
  Building2,
  CheckCircle2,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { Business, EventItem } from '../types';

interface FacebookRightSidebarProps {
  businesses: Business[];
  events: EventItem[];
  onSelectBusiness: (biz: Business) => void;
  onTabChange: (tab: any) => void;
}

export const FacebookRightSidebar: React.FC<FacebookRightSidebarProps> = ({
  businesses,
  events,
  onSelectBusiness,
  onTabChange,
}) => {
  // Sponsored featured enterprise businesses
  const sponsoredBusinesses = businesses.filter((b) => b.featured || b.tier === 'enterprise').slice(0, 2);

  // Active upcoming events
  const upcomingEvents = events.filter((e) => e.status === 'active').slice(0, 2);

  return (
    <aside className="w-72 xl:w-80 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto no-scrollbar py-4 pl-2 space-y-6 text-slate-800 text-xs">
      {/* Sponsored Ads Column (Patrocinados) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px] uppercase tracking-wider px-1">
          <span>Patrocinado</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        </div>

        <div className="space-y-3">
          {sponsoredBusinesses.map((b) => (
            <div
              key={b.id}
              onClick={() => onSelectBusiness(b)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#E4E6EB]/60 transition cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                <img src={b.logo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-xs truncate flex items-center gap-1">
                  <span>{b.name}</span>
                  <CheckCircle2 className="w-3 h-3 text-[#1877F2] flex-shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">📍 {b.neighborhood}</p>
                <span className="text-[10px] text-[#1877F2] font-extrabold flex items-center gap-0.5 mt-1">
                  Ver Ficha <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Events Widget */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px] uppercase tracking-wider px-1">
          <span>Agenda Cultural Bissau</span>
          <button type="button"
            onClick={() => onTabChange('events')}
            className="text-[#1877F2] hover:underline text-[10px] lowercase"
          >
            ver todos
          </button>
        </div>

        <div className="space-y-3">
          {upcomingEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={() => onTabChange('events')}
              className="bg-white border border-slate-200 p-3 rounded-2xl space-y-2 shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                  <img src={ev.coverImage} alt="" className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-xs truncate">{ev.title}</h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    📅 {ev.date} • {ev.time}
                  </p>
                </div>
              </div>

              <button type="button" className="w-full py-1.5 bg-[#1877F2] hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1">
                <Ticket className="w-3.5 h-3.5" />
                <span>Comprar Bilhete QR</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Online Business WhatsApp Contacts (Facebook Contacts List) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-slate-500 font-extrabold text-[11px] uppercase tracking-wider px-1">
          <span>Empresas Online (WhatsApp)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <div className="space-y-1">
          {businesses.map((b) => (
            <a
              key={b.id}
              href={`https://wa.me/${b.whatsapp.replace(/\+/g, '')}?text=Olá ${b.name}! Vi a vossa empresa no Guigui.com.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#E4E6EB]/60 transition cursor-pointer text-xs group"
            >
              <div className="relative flex-shrink-0">
                <img src={b.logo} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-xs truncate group-hover:text-[#1877F2]">
                  {b.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  WhatsApp: {b.phone}
                </div>
              </div>

              <MessageCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
};
