import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'motion/react';
import {
  ArrowRight, CheckCircle2, ReceiptText, ShieldCheck,
  FileText, Printer, MessageCircle, Star, Menu, X, CheckCircle,
  Sparkles,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const WHATSAPP_NUMBER = '2250104617601';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

// Animated counter
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, to, {
      duration: 1.8, ease: [0.16, 1, 0.3, 1],
      onUpdate(v) { if (ref.current) ref.current.textContent = Math.floor(v).toLocaleString('fr-FR') + suffix; }
    });
    return controls.stop;
  }, [inView, to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

// Mock invoice
function MockInvoice() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
      style={{ perspective: 1000 }}
      className="relative max-w-sm w-full"
    >
      <div className="absolute inset-0 translate-x-3 translate-y-3 bg-[#111827]/10 rounded-2xl" />
      <div className="relative bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="w-8 h-8 bg-[#111827] rounded-lg flex items-center justify-center mb-3">
              <ReceiptText size={16} className="text-white" />
            </div>
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">FACTURA.CI</p>
            <p className="text-[11px] text-[#9CA3AF]">Abidjan, Cocody</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">FACTURE</p>
            <p className="text-[13px] font-bold text-[#111827]">FAC-2026-042</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full mt-1">
              <CheckCircle2 size={9} /> Payée
            </span>
          </div>
        </div>

        <div className="bg-[#F9FAFB] rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">CLIENT</p>
          <p className="text-[13px] font-semibold text-[#111827]">Orange Côte d'Ivoire SA</p>
          <p className="text-[11px] text-[#6B7280]">NCC : 0012345 A</p>
        </div>

        <div className="space-y-2 mb-4">
          {[
            { desc: 'Développement application mobile', qty: 1, price: '850 000' },
            { desc: 'Maintenance mensuelle', qty: 3, price: '150 000' },
          ].map((l, i) => (
            <div key={i} className="flex justify-between items-center text-[12px]">
              <div className="flex-1 min-w-0">
                <p className="text-[#374151] truncate">{l.desc}</p>
                <p className="text-[#9CA3AF]">Qté: {l.qty}</p>
              </div>
              <p className="font-mono font-semibold text-[#111827] ml-2">{l.price} FCFA</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#F3F4F6] pt-3 space-y-1">
          <div className="flex justify-between text-[11px] text-[#6B7280]">
            <span>Sous-total HT</span><span className="font-mono">1 000 000 FCFA</span>
          </div>
          <div className="flex justify-between text-[11px] text-[#6B7280]">
            <span>TVA 18%</span><span className="font-mono">180 000 FCFA</span>
          </div>
          <div className="flex justify-between text-[14px] font-bold text-[#111827] pt-1 border-t border-[#F3F4F6]">
            <span>NET À PAYER</span><span className="font-mono">1 180 000 FCFA</span>
          </div>
        </div>
      </div>

      {/* WhatsApp delivery bubble */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="absolute -bottom-4 -right-4 bg-[#25D366] text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
      >
        <MessageCircle size={12}/> Envoyée sur WhatsApp
      </motion.div>

      {/* Conforme DGI badge */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut', delay: 0.5 }}
        className="absolute -top-4 -left-4 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5"
      >
        <ShieldCheck size={12}/> Conforme DGI
      </motion.div>
    </motion.div>
  );
}

interface LiveStats {
  companies_count: number;
  invoices_count: number;
  testimonials_avg: number;
  testimonials_count: number;
}
interface LiveTestimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  stars: number;
  created_at: string;
}

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [testimonials, setTestimonials] = useState<LiveTestimonial[]>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Live stats + témoignages approuvés
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [statsRes, testsRes] = await Promise.all([
        supabase.rpc('public_landing_stats'),
        supabase.rpc('public_testimonials'),
      ]);
      if (!mounted) return;
      const statsRow = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      if (statsRow) setStats(statsRow as LiveStats);
      if (testsRes.data) setTestimonials(testsRes.data as LiveTestimonial[]);
    })();
    return () => { mounted = false; };
  }, []);

  const steps = [
    {
      n: '1',
      icon: FileText,
      title: 'Créez la facture',
      desc: 'Client, produits, TVA 18% auto. Numérotation séquentielle conforme DGI. 30 secondes chrono.',
    },
    {
      n: '2',
      icon: Printer,
      title: 'PDF prêt instantanément',
      desc: 'Document professionnel avec votre logo, NCC, RCCM. Imprimez ou téléchargez en un clic.',
    },
    {
      n: '3',
      icon: MessageCircle,
      title: 'Envoyez sur WhatsApp',
      desc: 'Le client reçoit le PDF directement dans sa conversation WhatsApp. Pas d\'email, pas de friction.',
    },
  ];

  const features = [
    {
      icon: FileText,
      title: 'Factures & Devis pro',
      desc: 'Documents conformes DGI-CI avec numérotation séquentielle, TVA automatique et logo personnalisé.',
    },
    {
      icon: Printer,
      title: 'PDF imprimable',
      desc: 'Génération PDF haute qualité, prête à imprimer ou archiver. Format A4 standard.',
    },
    {
      icon: MessageCircle,
      title: 'Envoi WhatsApp 1-clic',
      desc: 'Partagez chaque facture à votre client directement sur WhatsApp. Lien PDF instantané.',
    },
    {
      icon: ShieldCheck,
      title: 'Conforme DGI-CI',
      desc: 'TVA 18%, NCC, registre mensuel exportable. Tout ce que la DGI exige, inclus par défaut.',
    },
  ];

  const plans = [
    {
      id: 'starter',
      name: 'Gratuit',
      price: '0',
      period: '/mois',
      features: ['5 factures / mois', '3 devis / mois', "Jusqu'à 10 clients", 'PDF avec marque FACTURA', 'Essai 30 jours sans engagement'],
      cta: 'Démarrer gratuitement',
      action: 'signup' as const,
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '5 000',
      period: 'FCFA / mois',
      features: ['Factures & devis illimités', 'Clients illimités', 'PDF sans marque + logo', 'Envoi WhatsApp 1-clic', 'Export DGI mensuel'],
      cta: 'Demander une clé',
      action: 'whatsapp' as const,
      popular: true,
    },
  ];


  function planCta(action: 'signup' | 'whatsapp', planName: string) {
    if (action === 'signup') return onGetStarted();
    const msg = encodeURIComponent(`Bonjour, je souhaite une clé d'activation FACTURA pour le plan ${planName}.`);
    window.open(`${WHATSAPP_URL}?text=${msg}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] overflow-x-hidden" style={{ fontFamily: "'Geist Variable', system-ui, sans-serif" }}>

      {/* NAV */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md border-b border-[#F3F4F6] shadow-sm' : 'bg-transparent'}`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-[#111827] rounded-lg flex items-center justify-center">
              <ReceiptText size={16} className="text-white" />
            </div>
            <span className="text-[18px] font-black tracking-tight text-[#111827]">FACTURA</span>
            <span className="text-[11px] font-bold text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">.ci</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'Comment ça marche', id: 'workflow' },
              { label: 'Fonctionnalités',  id: 'fonctionnalites' },
              { label: 'Tarifs',           id: 'tarifs' },
            ].map(item => (
              <button key={item.id}
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[13px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={onLogin} className="text-[13px] font-medium text-[#374151] hover:text-[#111827] px-4 py-2 rounded-xl hover:bg-[#F3F4F6] transition-all">
              Connexion
            </button>
            <button onClick={onGetStarted} className="flex items-center gap-2 bg-[#111827] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1F2937] transition-all">
              Démarrer gratuitement <ArrowRight size={14} />
            </button>
          </div>

          <button className="md:hidden p-2 rounded-xl hover:bg-[#F3F4F6]" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white border-t border-[#F3F4F6] px-6 py-4 space-y-3">
            <button onClick={onLogin} className="w-full text-left text-[14px] font-medium text-[#374151] py-2">Connexion</button>
            <button onClick={onGetStarted} className="w-full bg-[#111827] text-white text-[14px] font-semibold px-5 py-3 rounded-xl">Démarrer gratuitement</button>
          </motion.div>
        )}
      </motion.nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to right, #F3F4F6 1px, transparent 1px), linear-gradient(to bottom, #F3F4F6 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)'
        }} />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 bg-[#F3F4F6] border border-[#E5E7EB] px-3 py-1.5 rounded-full text-[12px] font-semibold text-[#374151] mb-6">
                  <Sparkles size={12} className="text-amber-500" />
                  Facture pro + WhatsApp en 30 secondes
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-[52px] leading-[1.05] font-black text-[#0A0A0A] tracking-tight mb-6"
              >
                Une facture.<br />
                Un PDF.<br />
                <span className="text-[#25D366]">Un WhatsApp.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="text-[16px] text-[#6B7280] leading-relaxed mb-8 max-w-md"
              >
                L'outil de facturation le plus simple de Côte d'Ivoire. Créez votre devis ou facture, générez le PDF, envoyez-le sur WhatsApp à votre client. Conforme DGI.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 mb-10"
              >
                <button onClick={onGetStarted}
                  className="flex items-center justify-center gap-2 bg-[#111827] text-white text-[14px] font-semibold px-6 py-3.5 rounded-xl hover:bg-[#1F2937] transition-all shadow-lg shadow-black/10">
                  Créer mon compte gratuit <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center justify-center gap-2 border border-[#E5E7EB] text-[#374151] text-[14px] font-medium px-6 py-3.5 rounded-xl hover:bg-[#F9FAFB] transition-all">
                  Voir la démo
                </button>
              </motion.div>

              {stats && stats.companies_count > 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-[#111827] border-2 border-white flex items-center justify-center text-[11px] text-white font-black">
                    {stats.companies_count}
                  </div>
                  <div>
                    {stats.testimonials_avg > 0 && (
                      <div className="flex gap-0.5 mb-0.5">{[1,2,3,4,5].map(i => <Star key={i} size={12} className={i <= Math.round(Number(stats.testimonials_avg)) ? 'text-amber-400 fill-amber-400' : 'text-[#E5E7EB] fill-[#E5E7EB]'} />)}</div>
                    )}
                    <p className="text-[12px] text-[#6B7280]">
                      <strong className="text-[#111827]">{stats.companies_count}</strong> entreprise{stats.companies_count > 1 ? 's' : ''} {stats.companies_count > 1 ? 'utilisent' : 'utilise'} FACTURA
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="hidden lg:flex items-center justify-center">
              <MockInvoice />
            </div>
          </div>
        </div>
      </section>

      {/* STATS — chiffres en direct depuis la DB */}
      <section className="py-16 border-y border-[#F3F4F6] bg-[#F9FAFB]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: stats?.companies_count ?? 0,   suffix: '+',  label: 'Entreprises inscrites' },
              { value: stats?.invoices_count  ?? 0,   suffix: '+',  label: 'Factures émises' },
              { value: 30,                            suffix: 's',  label: 'Pour facturer un client' },
              { value: 100,                           suffix: '%',  label: 'Conforme DGI-CI' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }}>
                <p className="text-[36px] font-black text-[#0A0A0A] font-mono">
                  <Counter to={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[13px] text-[#9CA3AF] mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW 3 STEPS */}
      <section id="workflow" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">COMMENT ÇA MARCHE</p>
            <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">3 étapes.<br/>Aucune complication.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }} viewport={{ once: true }}
                className="relative bg-white border border-[#E5E7EB] rounded-2xl p-7"
              >
                <div className="absolute -top-3 -left-3 w-9 h-9 bg-[#111827] text-white rounded-xl flex items-center justify-center font-black text-[14px] shadow-lg">
                  {s.n}
                </div>
                <div className="w-12 h-12 bg-[#F3F4F6] rounded-xl flex items-center justify-center mb-5">
                  <s.icon size={22} className="text-[#111827]" />
                </div>
                <h3 className="text-[17px] font-bold text-[#0A0A0A] mb-2">{s.title}</h3>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="fonctionnalites" className="py-24 px-6 bg-[#F9FAFB]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">FONCTIONNALITÉS</p>
            <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">Tout ce qu'il faut.<br/>Rien d'autre.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }} viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-6 hover:shadow-lg hover:border-[#111827]/20 transition-all cursor-default group"
              >
                <div className="w-10 h-10 bg-[#F3F4F6] group-hover:bg-[#111827] rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <f.icon size={18} className="text-[#111827] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-[15px] font-bold text-[#0A0A0A] mb-2">{f.title}</h3>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="tarifs" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">TARIFS</p>
            <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">Simple et transparent.</h2>
            <p className="text-[14px] text-[#6B7280] mt-3 max-w-md mx-auto">
              Activation par clé. Demandez votre clé sur WhatsApp, recevez votre code, débloquez instantanément.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className={`relative rounded-2xl p-8 border ${p.popular ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]' : 'bg-white border-[#E5E7EB]'}`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-[#0A0A0A] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    Populaire
                  </span>
                )}
                <p className={`text-[12px] font-bold uppercase tracking-widest mb-2 ${p.popular ? 'text-white/50' : 'text-[#9CA3AF]'}`}>{p.name}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-[44px] font-black tracking-tight ${p.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>{p.price}</span>
                  <span className={`text-[13px] ${p.popular ? 'text-white/50' : 'text-[#9CA3AF]'}`}>{p.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {p.features.map((feat, fi) => (
                    <li key={fi} className="flex items-start gap-2.5 text-[13px]">
                      <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${p.popular ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      <span className={p.popular ? 'text-white/80' : 'text-[#374151]'}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => planCta(p.action, p.name)}
                  className={`w-full h-12 rounded-xl font-semibold text-[14px] transition-all flex items-center justify-center gap-2 ${
                    p.popular
                      ? 'bg-white text-[#0A0A0A] hover:bg-white/90'
                      : 'bg-[#111827] text-white hover:bg-[#1F2937]'
                  }`}
                >
                  {p.action === 'whatsapp' ? <MessageCircle size={15} /> : <ArrowRight size={15} />}
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Business / Enterprise pointer */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="mt-8 text-center bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl p-6"
          >
            <p className="text-[13px] text-[#6B7280]">
              Besoin de plus ? Plans <strong className="text-[#111827]">Business</strong> (15 000 FCFA) et <strong className="text-[#111827]">Enterprise</strong> (sur devis) disponibles sur demande WhatsApp.
            </p>
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent('Bonjour, je voudrais en savoir plus sur les plans Business / Enterprise.')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-[13px] font-semibold text-[#25D366] hover:underline"
            >
              <MessageCircle size={14} /> Nous contacter
            </a>
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS — visible uniquement si avis approuvés en DB */}
      {testimonials.length > 0 && (
        <section id="temoignages" className="py-24 px-6 bg-[#F9FAFB]">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">ILS NOUS FONT CONFIANCE</p>
              <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">Des PME, des freelances,<br/>des résultats.</h2>
              {stats && stats.testimonials_avg > 0 && (
                <p className="text-[13px] text-[#6B7280] mt-3">
                  Note moyenne : <strong className="text-[#111827]">{Number(stats.testimonials_avg).toFixed(1)}/5</strong> · {stats.testimonials_count} avis vérifié{stats.testimonials_count > 1 ? 's' : ''}
                </p>
              )}
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }} viewport={{ once: true }}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-6"
                >
                  <div className="flex gap-0.5 mb-4">{[...Array(t.stars)].map((_, k) => <Star key={k} size={13} className="text-amber-400 fill-amber-400"/>)}</div>
                  <p className="text-[14px] text-[#374151] leading-relaxed mb-5">"{t.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center text-[11px] font-bold">
                      {t.author_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0A0A0A]">{t.author_name}</p>
                      {t.author_role && <p className="text-[11px] text-[#9CA3AF]">{t.author_role}</p>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-[#0A0A0A] rounded-3xl p-12 text-center text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 50% 0%, #25D366 0%, transparent 60%)',
          }} />
          <div className="relative">
            <h2 className="text-[36px] font-black tracking-tight mb-4">Votre prochaine facture<br/>en 30 secondes.</h2>
            <p className="text-[14px] text-white/60 mb-8 max-w-md mx-auto">
              Essai gratuit 30 jours. Aucune carte de crédit. Aucune obligation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={onGetStarted}
                className="flex items-center justify-center gap-2 bg-white text-[#0A0A0A] text-[14px] font-semibold px-6 py-3.5 rounded-xl hover:bg-white/90 transition-all">
                Créer mon compte gratuit <ArrowRight size={16} />
              </button>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#25D366] text-white text-[14px] font-semibold px-6 py-3.5 rounded-xl hover:bg-[#1FAD54] transition-all">
                <MessageCircle size={16} /> Demander une clé
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0A0A0A] text-white px-6 pt-16 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <ReceiptText size={16} className="text-[#0A0A0A]" />
                </div>
                <span className="text-[18px] font-black tracking-tight">FACTURA</span>
                <span className="text-[11px] font-bold text-white/30 bg-white/10 px-2 py-0.5 rounded-full">.ci</span>
              </div>
              <p className="text-[13px] text-white/50 leading-relaxed max-w-xs mb-6">
                Facture, PDF, WhatsApp. La solution la plus simple pour facturer en Côte d'Ivoire.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[11px] font-medium px-3 py-1.5 rounded-full">
                  <ShieldCheck size={12} className="text-emerald-400" /> Conforme DGI-CI
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[11px] font-medium px-3 py-1.5 rounded-full">
                  <MessageCircle size={12} className="text-[#25D366]" /> WhatsApp natif
                </span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Produit</p>
              <ul className="space-y-3">
                {[
                  { label: 'Comment ça marche', id: 'workflow' },
                  { label: 'Fonctionnalités',  id: 'fonctionnalites' },
                  { label: 'Tarifs',           id: 'tarifs' },
                  { label: 'Témoignages',      id: 'temoignages' },
                ].map(item => (
                  <li key={item.label}>
                    <button
                      onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-[13px] text-white/50 hover:text-white transition-colors"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Ressources</p>
              <ul className="space-y-3">
                <li><button onClick={() => setActiveModal('documentation')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Documentation</button></li>
                <li><button onClick={() => setActiveModal('dgi')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Guide DGI Côte d'Ivoire</button></li>
                <li><button onClick={() => setActiveModal('faq')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">FAQ</button></li>
                <li><button onClick={() => setActiveModal('statut')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Statut du service</button></li>
                <li><button onClick={() => toast.info('Blog bientôt disponible.')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Blog</button></li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Contact</p>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:support@factura.ci" className="text-[13px] text-white/50 hover:text-white transition-colors">
                    support@factura.ci
                  </a>
                </li>
                <li>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] text-white/50 hover:text-white transition-colors flex items-center gap-1.5">
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                </li>
                <li><p className="text-[13px] text-white/50">Abidjan, Cocody<br/>Côte d'Ivoire</p></li>
              </ul>
            </div>
          </div>

          {/* CONTACTEZ-MOI — collaboration / service */}
          <div className="py-10 border-b border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-[11px] font-bold text-[#25D366] uppercase tracking-widest mb-2">Contactez-moi</p>
                <h3 className="text-[20px] md:text-[22px] font-black tracking-tight text-white mb-2">
                  Une collaboration ? Un service sur mesure ?
                </h3>
                <p className="text-[13px] text-white/60 max-w-md">
                  Discutons directement sur WhatsApp. Réponse rapide, devis personnalisé.
                </p>
              </div>
              <a
                href={`${WHATSAPP_URL}?text=${encodeURIComponent('Bonjour, je souhaite vous contacter pour une collaboration / un service.')}`}
                target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 bg-[#25D366] hover:bg-[#1FAD54] text-white text-[14px] font-bold px-6 py-3.5 rounded-xl transition-colors"
              >
                <MessageCircle size={18} />
                +225 01 04 61 76 01
              </a>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-white/30">
              © 2026 Factura.ci — Fait pour les entrepreneurs ivoiriens.
            </p>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <button onClick={() => setActiveModal('confidentialite')} className="text-[12px] text-white/30 hover:text-white/70 transition-colors">Confidentialité</button>
              <button onClick={() => setActiveModal('cgu')} className="text-[12px] text-white/30 hover:text-white/70 transition-colors">CGU</button>
              <button onClick={() => setActiveModal('mentions')} className="text-[12px] text-white/30 hover:text-white/70 transition-colors">Mentions légales</button>
              <a href="mailto:support@factura.ci" className="text-[12px] text-white/30 hover:text-white/70 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── MODALS FOOTER ─────────────────────────────────────── */}
      <Dialog open={!!activeModal} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {activeModal === 'documentation' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Documentation</h2>

              <ModalSection title="1. Créer votre compte">
                <p>Cliquez sur « Démarrer gratuitement », renseignez vos informations d'entreprise (nom, NCC, adresse). Essai gratuit 30 jours, aucune carte requise.</p>
              </ModalSection>

              <ModalSection title="2. Créer votre première facture ou devis">
                <p>Allez dans <strong>Factures → Nouvelle facture</strong> (ou <strong>Devis</strong>). Sélectionnez un client, ajoutez vos lignes. La TVA 18% est calculée automatiquement. Le PDF est généré instantanément.</p>
              </ModalSection>

              <ModalSection title="3. Imprimer ou télécharger le PDF">
                <p>Depuis la fiche facture, bouton <strong>Télécharger PDF</strong> ou <strong>Imprimer</strong>. Le document inclut votre logo, NCC, RCCM et tous les éléments légaux requis par la DGI.</p>
              </ModalSection>

              <ModalSection title="4. Envoyer la facture sur WhatsApp">
                <p>Bouton <strong>Envoyer WhatsApp</strong> sur la facture. Le client reçoit le PDF directement dans sa conversation, prêt à régler.</p>
              </ModalSection>

              <ModalSection title="5. Activer un plan payant">
                <p>Demandez une clé d'activation par WhatsApp. Vous recevez un code <code className="bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[12px]">XXXX-XXXX-XXXX-XXXX</code> à coller dans l'app. Plan actif instantanément.</p>
              </ModalSection>

              <ModalSection title="6. Export DGI">
                <p>Section <strong>Export DGI</strong>, sélectionnez le mois, téléchargez votre registre mensuel. À déposer avant le 15 du mois suivant.</p>
              </ModalSection>

              <div className="pt-2 border-t border-[#F3F4F6]">
                <p className="text-[12px] text-[#9CA3AF]">Question ? <a href="mailto:support@factura.ci" className="text-[#111827] underline">support@factura.ci</a></p>
              </div>
            </div>
          )}

          {activeModal === 'dgi' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Guide DGI Côte d'Ivoire</h2>

              <ModalSection title="La TVA en Côte d'Ivoire">
                <p>Le taux standard de TVA est de <strong>18%</strong> sur le montant hors taxes (HT). Elle est obligatoire pour toute entreprise assujettie dont le chiffre d'affaires dépasse le seuil légal.</p>
              </ModalSection>

              <ModalSection title="Vos obligations légales de facturation">
                <ul className="space-y-1.5 mt-2">
                  {['Émettre des factures numérotées de façon séquentielle','Indiquer votre NCC (Numéro de Compte Contribuable)','Indiquer le NCC de votre client pour les entreprises','Calculer et afficher la TVA à 18% séparément','Conserver un registre mensuel des factures émises','Déclarer et reverser la TVA collectée avant le 15 du mois'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-[13px]">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </ModalSection>

              <ModalSection title="Comment FACTURA vous aide">
                <ul className="space-y-1.5 mt-2">
                  {['Numérotation automatique et séquentielle de toutes vos factures','TVA à 18% calculée automatiquement sur chaque ligne','Champs NCC intégrés pour vous et vos clients','Export mensuel du registre des ventes conforme à la DGI','PDF professionnel avec tous les éléments légaux requis','Archivage sécurisé illimité de tous vos documents'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-[13px]">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </ModalSection>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-[13px] text-amber-800"><strong>Important :</strong> Le registre mensuel doit être déposé auprès de la DGI avant le 15 du mois suivant. Factura génère ce document en 1 clic depuis la section Export DGI.</p>
              </div>
            </div>
          )}

          {activeModal === 'faq' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Questions fréquentes</h2>
              {[
                { q: "Que fait FACTURA exactement ?", a: "FACTURA génère des factures et devis professionnels en PDF, conformes DGI-CI, et permet de les envoyer directement à vos clients via WhatsApp. Rien de plus, rien de moins." },
                { q: "Le plan Gratuit est-il vraiment sans limite de temps ?", a: "Oui, le plan Gratuit est à vie (5 factures et 3 devis par mois). En plus, vous avez 30 jours d'essai sans restriction au démarrage." },
                { q: "Comment fonctionne l'activation par clé ?", a: "Vous demandez une clé sur WhatsApp, recevez un code XXXX-XXXX-XXXX-XXXX, le collez dans l'app. Le plan est actif instantanément." },
                { q: "Comment j'envoie une facture sur WhatsApp ?", a: "Depuis la facture créée, cliquez sur 'Envoyer WhatsApp'. Le PDF s'ouvre dans la conversation WhatsApp avec le numéro de votre client pré-rempli." },
                { q: "Mes données sont-elles sécurisées ?", a: "Vos données sont hébergées sur Supabase (AWS Paris) avec chiffrement TLS et sauvegardes quotidiennes. Nous ne partageons jamais vos données." },
                { q: "Le PDF généré est-il accepté par la DGI-CI ?", a: "Oui. Nos factures incluent tous les éléments requis : NCC vendeur et acheteur, TVA 18% détaillée, numérotation séquentielle." },
                { q: "Quels moyens de paiement pour activer mon plan ?", a: "Tous moyens — réglez directement avec moi via WhatsApp (mobile money, virement, espèces). Aucune carte bancaire requise." },
                { q: "Puis-je arrêter à tout moment ?", a: "Oui. À l'expiration de votre clé, vous repassez au plan Gratuit. Vos données sont conservées. Pas de renouvellement automatique." },
              ].map(({ q, a }) => (
                <div key={q} className="border-b border-[#F3F4F6] pb-4 last:border-0">
                  <p className="text-[14px] font-semibold text-[#111827] mb-1.5">{q}</p>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          )}

          {activeModal === 'statut' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-bold text-[#111827]">Statut des services</h2>
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[12px] font-semibold px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Tous les systèmes opérationnels
                </span>
              </div>

              <div className="space-y-2">
                {['API Factura','Base de données','Génération PDF','Authentification','Export DGI','Activation par clé'].map(service => (
                  <div key={service} className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0">
                    <span className="text-[14px] text-[#374151]">{service}</span>
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                      <CheckCircle size={14} /> Opérationnel
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-[#F9FAFB] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">Disponibilité ce mois</p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">Aucun incident signalé</p>
                </div>
                <span className="text-[22px] font-black text-emerald-600">99,9%</span>
              </div>

              <p className="text-[12px] text-[#9CA3AF]">Alertes incidents : <a href="mailto:status@factura.ci" className="text-[#111827] underline">status@factura.ci</a></p>
            </div>
          )}

          {activeModal === 'confidentialite' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Politique de confidentialité</h2>
              <p className="text-[12px] text-[#9CA3AF]">Mise à jour : 1er mai 2026</p>

              <ModalSection title="1. Données collectées">
                <ul className="space-y-1 text-[13px] text-[#6B7280] mt-1">
                  <li>• Données d'identification : nom, email, téléphone</li>
                  <li>• Données d'entreprise : nom, NCC, adresse, RCCM</li>
                  <li>• Données de facturation : clients, produits, factures, paiements</li>
                  <li>• Données de connexion : adresse IP, navigateur, horodatages</li>
                </ul>
              </ModalSection>

              <ModalSection title="2. Utilisation de vos données">
                <p>Vos données sont utilisées exclusivement pour fournir les services FACTURA : génération de documents, export DGI et amélioration du service.</p>
              </ModalSection>

              <ModalSection title="3. Stockage et sécurité">
                <p>Données hébergées sur Supabase (AWS eu-west-1, Paris). Chiffrement TLS en transit, AES-256 au repos. Sauvegardes quotidiennes.</p>
              </ModalSection>

              <ModalSection title="4. Partage de données">
                <p>Nous ne vendons ni ne partageons vos données avec des tiers, sauf obligation légale ou prestataires techniques (Supabase, Vercel) dans le cadre strict du service.</p>
              </ModalSection>

              <ModalSection title="5. Vos droits">
                <p>Accès, rectification, suppression à tout moment via <a href="mailto:support@factura.ci" className="text-[#111827] underline">support@factura.ci</a>. Délai 72h.</p>
              </ModalSection>

              <ModalSection title="6. Cookies">
                <p>FACTURA utilise uniquement des cookies techniques nécessaires au fonctionnement du service. Aucun cookie publicitaire.</p>
              </ModalSection>
            </div>
          )}

          {activeModal === 'cgu' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Conditions Générales d'Utilisation</h2>
              <p className="text-[12px] text-[#9CA3AF]">En vigueur au 1er mai 2026</p>

              <ModalSection title="1. Objet">
                <p>Les présentes CGU régissent l'utilisation de la plateforme FACTURA, éditée par FACTURA CI SARL, entreprise de droit ivoirien.</p>
              </ModalSection>

              <ModalSection title="2. Accès au service">
                <p>L'accès requiert la création d'un compte. Vous êtes responsable de la confidentialité de vos identifiants.</p>
              </ModalSection>

              <ModalSection title="3. Plans et activation">
                <ul className="space-y-1 text-[13px] text-[#6B7280] mt-1">
                  <li>• Plan Gratuit : 5 factures et 3 devis / mois, sans engagement</li>
                  <li>• Essai 30 jours sans restriction à la création du compte</li>
                  <li>• Plans payants : activation par clé prépayée, durée fixe choisie</li>
                  <li>• À expiration de la clé, le compte repasse au plan Gratuit</li>
                  <li>• Aucun remboursement pour la période déjà entamée</li>
                </ul>
              </ModalSection>

              <ModalSection title="4. Utilisation acceptable">
                <p>Vous vous engagez à utiliser FACTURA uniquement pour des activités légales. Toute fraude entraîne la résiliation immédiate du compte.</p>
              </ModalSection>

              <ModalSection title="5. Propriété intellectuelle">
                <p>La plateforme FACTURA, sa marque et ses contenus sont la propriété exclusive de FACTURA CI SARL.</p>
              </ModalSection>

              <ModalSection title="6. Limitation de responsabilité">
                <p>FACTURA s'engage à maintenir une disponibilité maximale du service. Notre responsabilité est limitée au montant des activations payées sur les 3 derniers mois.</p>
              </ModalSection>

              <ModalSection title="7. Droit applicable">
                <p>Droit ivoirien. Tribunaux d'Abidjan en cas de litige non résolu à l'amiable.</p>
              </ModalSection>
            </div>
          )}

          {activeModal === 'mentions' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Mentions légales</h2>

              <ModalSection title="Éditeur du site">
                <div className="space-y-1 text-[13px] text-[#6B7280]">
                  <p><strong className="text-[#374151]">FACTURA CI SARL</strong></p>
                  <p>Siège social : Abidjan, Cocody, Côte d'Ivoire</p>
                  <p>Email : <a href="mailto:contact@factura.ci" className="text-[#111827] underline">contact@factura.ci</a></p>
                  <p>WhatsApp : <a href={WHATSAPP_URL} className="text-[#111827] underline">+225 07 00 00 00 00</a></p>
                </div>
              </ModalSection>

              <ModalSection title="Hébergement">
                <div className="space-y-1 text-[13px] text-[#6B7280]">
                  <p><strong className="text-[#374151]">Site web :</strong> Vercel Inc., San Francisco, CA, USA</p>
                  <p><strong className="text-[#374151]">Base de données :</strong> Supabase Inc., AWS eu-west-1 (Paris, France)</p>
                </div>
              </ModalSection>

              <ModalSection title="Propriété intellectuelle">
                <p>L'ensemble du contenu de ce site est protégé par le droit ivoirien de la propriété intellectuelle.</p>
              </ModalSection>

              <ModalSection title="Données personnelles">
                <p>Conformément à la réglementation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données : <a href="mailto:support@factura.ci" className="text-[#111827] underline">support@factura.ci</a></p>
              </ModalSection>

              <ModalSection title="Crédits techniques">
                <p className="text-[13px] text-[#6B7280]">Développé avec React, TypeScript, Vite, Supabase, Tailwind CSS et déployé sur Vercel.</p>
              </ModalSection>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-bold text-[#111827] uppercase tracking-wide mb-2">{title}</h3>
      <div className="text-[13px] text-[#6B7280] leading-relaxed">{children}</div>
    </div>
  );
}
