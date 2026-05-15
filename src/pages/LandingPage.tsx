import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'motion/react';
import { ArrowRight, CheckCircle2, ReceiptText, ShieldCheck, Zap, Clock, FileText, Users, TrendingUp, Star, ChevronRight, Menu, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

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

// Floating invoice card mock
function MockInvoice() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
      style={{ perspective: 1000 }}
      className="relative max-w-sm w-full"
    >
      {/* Shadow card behind */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 bg-[#111827]/10 rounded-2xl" />
      <div className="relative bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-2xl">
        {/* Header */}
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

        {/* Client */}
        <div className="bg-[#F9FAFB] rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">CLIENT</p>
          <p className="text-[13px] font-semibold text-[#111827]">Orange Côte d'Ivoire SA</p>
          <p className="text-[11px] text-[#6B7280]">NCC : 0012345 A</p>
        </div>

        {/* Lines */}
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

        {/* Totals */}
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

        {/* Wave badge */}
        <div className="mt-4 flex items-center gap-2 bg-blue-50 rounded-xl p-2.5">
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[9px] font-black">W</div>
          <p className="text-[11px] text-blue-700 font-medium">Paiement Wave accepté</p>
        </div>
      </div>

      {/* Floating badge */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="absolute -top-4 -right-4 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1"
      >
        <CheckCircle2 size={12}/> Conforme DGI
      </motion.div>
    </motion.div>
  );
}

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    { icon: FileText,   title: 'Factures & Devis',  desc: 'Créez des documents professionnels conformes DGI en 30 secondes avec génération PDF automatique.' },
    { icon: ShieldCheck, title: 'Conformité DGI-CI', desc: 'Calcul TVA 18% automatique. Export des registres mensuels obligatoires en un clic.' },
    { icon: Clock,       title: 'Relances auto',     desc: 'Plus jamais d\'impayé oublié. Relances WhatsApp automatiques J+3, J+7, J+15 après échéance.' },
    { icon: TrendingUp,  title: 'Tableau de bord',   desc: 'Visualisez votre CA, vos impayés et vos devis en temps réel depuis votre mobile.' },
    { icon: Users,       title: 'Gestion clients',   desc: 'Carnet de clients complet avec historique des factures par client et NCC intégré.' },
    { icon: Zap,         title: 'Paiement Wave',     desc: 'Vos clients paient par Wave directement depuis la facture. Encaissement en 30 secondes.' },
  ];

  const plans = [
    { id: 'starter',    name: 'Gratuit',    price: '0',       period: '/mois',  features: ['5 factures / mois', '3 devis / mois', "Jusqu'à 10 clients", "Jusqu'à 20 produits", 'PDF avec marque FACTURA', 'Paiement Wave / Orange Money / MTN', 'Historique 30 jours'], cta: 'Démarrer gratuitement', popular: false, enterprise: false },
    { id: 'pro',        name: 'Pro',        price: '5 000',   period: '/mois',  features: ['Factures & devis illimités', 'Clients & produits illimités', 'PDF sans marque + logo personnalisé', 'Export DGI mensuel automatique', 'Relances email automatiques', 'Tableau de bord avancé', 'Historique illimité', 'Support email 48h'], cta: 'Choisir Pro', popular: true, enterprise: false },
    { id: 'business',   name: 'Business',   price: '15 000',  period: '/mois',  features: ['Tout Pro inclus', "Jusqu'à 5 utilisateurs + rôles", 'Relances WhatsApp en 1 clic', 'Bons de commande & livraison', 'Factures récurrentes & avoirs', 'Acomptes & paiements partiels', 'Multi-devises (FCFA, EUR, USD)', 'API REST + webhooks'], cta: 'Choisir Business', popular: false, enterprise: false },
    { id: 'enterprise', name: 'Enterprise', price: 'Sur devis', period: '',     features: ['Tout Business inclus', 'Utilisateurs illimités + rôles personnalisés', 'Intégration via API REST', 'Journal d\'audit complet (RGPD)', 'SLA 99.9% + account manager dédié'], cta: 'Contacter le commercial', popular: false, enterprise: true },
  ];

  const testimonials = [
    { name: 'Kouamé Assi', role: 'Directeur, KA Digital', text: 'Factura m\'a fait gagner 3h par semaine. Mes factures Wave sont payées 2× plus vite.', stars: 5 },
    { name: 'Aminata Diallo', role: 'Freelance Designer', text: 'Enfin un outil en français qui comprend la DGI ivoirienne. Simple et professionnel.', stars: 5 },
    { name: 'Jean-Baptiste Koné', role: 'Gérant, JBK Construction', text: 'Le suivi des impayés m\'a permis de récupérer 2,4M FCFA en 1 mois.', stars: 5 },
  ];

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
              {label:'Fonctionnalités', id:'fonctionnalites'},
              {label:'Tarifs', id:'tarifs'},
              {label:'Témoignages', id:'temoignages'}
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

        {/* Mobile menu */}
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
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to right, #F3F4F6 1px, transparent 1px), linear-gradient(to bottom, #F3F4F6 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)'
        }} />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 bg-[#F3F4F6] border border-[#E5E7EB] px-3 py-1.5 rounded-full text-[12px] font-semibold text-[#374151] mb-6">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  N°1 de la facturation en Côte d'Ivoire
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-[52px] leading-[1.08] font-black text-[#0A0A0A] tracking-tight mb-6"
              >
                Facturez vite.<br />
                <span className="text-[#6B7280]">Soyez payé</span><br />
                encore plus vite.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="text-[16px] text-[#6B7280] leading-relaxed mb-8 max-w-md"
              >
                La solution de facturation conçue pour les PME ivoiriennes. Conformité DGI, paiement Wave intégré, relances automatiques. Tout ce qu'il faut, rien de superflu.
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
                <button onClick={onLogin}
                  className="flex items-center justify-center gap-2 border border-[#E5E7EB] text-[#374151] text-[14px] font-medium px-6 py-3.5 rounded-xl hover:bg-[#F9FAFB] transition-all">
                  Se connecter
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="flex items-center gap-4"
              >
                <div className="flex -space-x-2">
                  {['KA','AD','JK','MB','CF'].map((initials, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-[#111827] border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">{initials}</div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">{[1,2,3,4,5].map(i=><Star key={i} size={12} className="text-amber-400 fill-amber-400"/>)}</div>
                  <p className="text-[12px] text-[#6B7280]"><strong className="text-[#111827]">500+</strong> PME ivoiriennes font confiance à Factura</p>
                </div>
              </motion.div>
            </div>

            {/* Right — Invoice mockup */}
            <div className="hidden lg:flex items-center justify-center">
              <MockInvoice />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-16 border-y border-[#F3F4F6] bg-[#F9FAFB]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 500, suffix: '+', label: 'PME utilisatrices' },
              { value: 12000, suffix: '+', label: 'Factures émises' },
              { value: 98, suffix: '%', label: 'Satisfaction client' },
              { value: 3, suffix: 'h', label: 'Gagnées par semaine' },
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

      {/* FEATURES */}
      <section id="fonctionnalites" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">FONCTIONNALITÉS</p>
            <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">Tout ce qu'il vous faut,<br/>rien de superflu.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }} viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-6 hover:shadow-lg hover:border-[#111827]/20 transition-all cursor-default group"
              >
                <div className="w-10 h-10 bg-[#F3F4F6] group-hover:bg-[#111827] rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <f.icon size={18} className="text-[#6B7280] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#0A0A0A] mb-2">{f.title}</h3>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="tarifs" className="py-24 px-6 bg-[#F9FAFB]">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">TARIFS</p>
            <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">Simple et transparent.</h2>
            <p className="text-[15px] text-[#6B7280] mt-3">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan, i) => {
              const isDark = plan.popular || plan.enterprise;
              return (
                <motion.div key={plan.id}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                  className={`relative rounded-2xl p-6 flex flex-col ${
                    plan.enterprise
                      ? 'bg-gradient-to-br from-[#0A0A0A] to-[#1F2937] text-white ring-1 ring-amber-500/30'
                      : plan.popular
                        ? 'bg-[#111827] text-white ring-2 ring-[#111827]'
                        : 'bg-white border border-[#E5E7EB]'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-[#111827] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      Le plus populaire
                    </div>
                  )}
                  {plan.enterprise && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      Sur mesure
                    </div>
                  )}
                  <p className={`text-[12px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-white/50' : 'text-[#9CA3AF]'}`}>{plan.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`font-black font-mono ${plan.enterprise ? 'text-[22px]' : 'text-[36px]'}`}>{plan.price}</span>
                    {plan.period && (
                      <span className={`text-[13px] mb-1.5 ${isDark ? 'text-white/50' : 'text-[#9CA3AF]'}`}>
                        {plan.id === 'starter' ? 'FCFA' : 'FCFA'}{plan.period}
                      </span>
                    )}
                  </div>
                  {plan.enterprise && <p className="text-[11px] text-white/40 mb-1">à partir de 75 000 FCFA / mois</p>}
                  <div className={`border-t mb-5 mt-4 ${isDark ? 'border-white/10' : 'border-[#F3F4F6]'}`} />
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2.5 text-[13px]">
                        <CheckCircle2 size={14} className={`flex-shrink-0 mt-0.5 ${plan.enterprise ? 'text-amber-400' : isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span className={isDark ? 'text-white/80' : 'text-[#374151]'}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={onGetStarted}
                    className={`w-full py-3 rounded-xl text-[13px] font-semibold transition-all ${
                      plan.enterprise
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : plan.popular
                          ? 'bg-white text-[#111827] hover:bg-white/90'
                          : 'bg-[#111827] text-white hover:bg-[#1F2937]'
                    }`}>
                    {plan.cta}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="temoignages" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">TÉMOIGNAGES</p>
            <h2 className="text-[40px] font-black text-[#0A0A0A] tracking-tight">Ils nous font confiance.</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-6"
              >
                <div className="flex gap-0.5 mb-4">{[1,2,3,4,5].map(s=><Star key={s} size={13} className="text-amber-400 fill-amber-400"/>)}</div>
                <p className="text-[14px] text-[#374151] leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-[10px] text-white font-bold">
                    {t.name.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">{t.name}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-[#111827] rounded-3xl p-12 text-center text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <p className="text-[12px] font-bold text-white/40 uppercase tracking-widest mb-3">PRÊT À COMMENCER ?</p>
            <h2 className="text-[36px] font-black tracking-tight mb-4">Créez votre première<br/>facture en 2 minutes.</h2>
            <p className="text-[14px] text-white/60 mb-8">Aucune carte de crédit requise. Gratuit pendant 14 jours.</p>
            <button onClick={onGetStarted}
              className="inline-flex items-center gap-2 bg-white text-[#111827] text-[14px] font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-all shadow-xl">
              Démarrer gratuitement <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0A0A0A] text-white px-6 pt-16 pb-8">
        <div className="max-w-6xl mx-auto">

          {/* Colonnes principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">

            {/* Marque — col large */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <ReceiptText size={16} className="text-[#0A0A0A]" />
                </div>
                <span className="text-[18px] font-black tracking-tight">FACTURA</span>
                <span className="text-[11px] font-bold text-white/30 bg-white/10 px-2 py-0.5 rounded-full">.ci</span>
              </div>
              <p className="text-[13px] text-white/50 leading-relaxed max-w-xs mb-6">
                La solution de facturation conçue pour les PME et entrepreneurs de Côte d'Ivoire. Conforme DGI, simple et puissante.
              </p>
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[11px] font-medium px-3 py-1.5 rounded-full">
                  <ShieldCheck size={12} className="text-emerald-400" /> Conforme DGI-CI
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-[11px] font-medium px-3 py-1.5 rounded-full">
                  <Zap size={12} className="text-amber-400" /> Wave intégré
                </span>
              </div>
            </div>

            {/* Produit */}
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Produit</p>
              <ul className="space-y-3">
                {[
                  { label: 'Fonctionnalités', id: 'fonctionnalites' },
                  { label: 'Tarifs',          id: 'tarifs' },
                  { label: 'Témoignages',     id: 'temoignages' },
                  { label: 'Tableau de bord', id: null },
                  { label: 'Export DGI',      id: null },
                ].map(item => (
                  <li key={item.label}>
                    <button
                      onClick={() => item.id
                        ? document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                        : onGetStarted()
                      }
                      className="text-[13px] text-white/50 hover:text-white transition-colors"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ressources */}
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Ressources</p>
              <ul className="space-y-3">
                <li><button onClick={() => setActiveModal('documentation')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Documentation</button></li>
                <li><button onClick={() => setActiveModal('dgi')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Guide DGI Côte d'Ivoire</button></li>
                <li><button onClick={() => toast.info('Blog bientôt disponible — restez connecté !')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Blog</button></li>
                <li><button onClick={() => setActiveModal('faq')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">FAQ</button></li>
                <li><button onClick={() => setActiveModal('statut')} className="text-[13px] text-white/50 hover:text-white transition-colors text-left">Statut du service</button></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Contact</p>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:support@factura.ci" className="text-[13px] text-white/50 hover:text-white transition-colors">
                    support@factura.ci
                  </a>
                </li>
                <li>
                  <a href="tel:+2250700000000" className="text-[13px] text-white/50 hover:text-white transition-colors">
                    +225 07 00 00 00 00
                  </a>
                </li>
                <li>
                  <p className="text-[13px] text-white/50">Abidjan, Cocody<br/>Côte d'Ivoire</p>
                </li>
              </ul>
              <div className="mt-6">
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">Nous suivre</p>
                <div className="flex gap-3">
                  {[
                    { label: 'LI', href: 'https://www.linkedin.com/company/factura-ci', title: 'LinkedIn' },
                    { label: 'TW', href: 'https://x.com/factura_ci', title: 'Twitter / X' },
                    { label: 'WA', href: 'https://wa.me/2250700000000', title: 'WhatsApp' },
                  ].map(s => (
                    <a key={s.label} href={s.href} title={s.title} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-[10px] font-black text-white/60 hover:text-white transition-all">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Barre de bas */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-white/30">
              © 2026 Factura.ci — Fait avec ❤️ pour les entrepreneurs ivoiriens.
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
        <DialogContent className="top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:max-w-none rounded-none p-6 sm:p-12 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full pt-6">
          {activeModal === 'documentation' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Documentation</h2>

              <ModalSection title="1. Créer votre compte">
                <p>Cliquez sur « Démarrer gratuitement », renseignez vos informations d'entreprise (nom, NCC, adresse) et accédez immédiatement à votre tableau de bord. Aucune carte de crédit requise.</p>
              </ModalSection>

              <ModalSection title="2. Créer votre première facture">
                <p>Allez dans <strong>Factures → Nouvelle facture</strong>. Sélectionnez un client (ou créez-en un nouveau), ajoutez vos lignes de produits ou services. La TVA à 18% est calculée automatiquement. Téléchargez le PDF ou envoyez-le directement.</p>
              </ModalSection>

              <ModalSection title="3. Gérer vos clients">
                <p>Dans la section <strong>Clients</strong>, ajoutez le NCC de chaque client entreprise. L'historique complet des factures par client est automatiquement disponible.</p>
              </ModalSection>

              <ModalSection title="4. Suivre vos paiements">
                <p>La section <strong>Paiements</strong> centralise toutes vos encaissements. Vous pouvez enregistrer les paiements reçus par Wave, Orange Money, MTN Money, virement ou espèces.</p>
              </ModalSection>

              <ModalSection title="5. Export DGI">
                <p>Allez dans <strong>Export DGI</strong>, sélectionnez le mois concerné et téléchargez votre registre mensuel conforme à la DGI-CI. À effectuer avant le 15 du mois suivant.</p>
              </ModalSection>

              <ModalSection title="6. Relances automatiques (plans Pro & Business)">
                <p>FACTURA envoie des relances email automatiques (J+3, J+7, J+15) pour vos factures impayées. Le plan Business ajoute les relances par WhatsApp pour un meilleur taux de recouvrement.</p>
              </ModalSection>

              <div className="pt-2 border-t border-[#F3F4F6]">
                <p className="text-[12px] text-[#9CA3AF]">Pour toute question : <a href="mailto:support@factura.ci" className="text-[#111827] underline">support@factura.ci</a></p>
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
                { q: 'Le plan Gratuit est-il vraiment sans limite de temps ?', a: 'Oui, le plan Gratuit est à vie. Vous pouvez créer jusqu\'à 5 factures et 3 devis par mois sans jamais payer.' },
                { q: 'Puis-je passer au plan Pro ou Business à tout moment ?', a: 'Oui, la mise à niveau est instantanée depuis la page Tarifs. Vous payez au mois, sans engagement. En cas de retour au plan Gratuit, vos données sont conservées.' },
                { q: 'Mes données sont-elles sécurisées ?', a: 'Vos données sont hébergées sur Supabase (infrastructure AWS Paris) avec chiffrement TLS et sauvegardes quotidiennes. Nous ne partageons jamais vos données avec des tiers.' },
                { q: 'Le PDF généré est-il accepté par la DGI-CI ?', a: 'Oui. Nos factures incluent tous les éléments requis : NCC vendeur et acheteur, TVA 18% détaillée, numérotation séquentielle, date d\'émission et d\'échéance.' },
                { q: 'Quels moyens de paiement pour l\'abonnement ?', a: 'Wave, Orange Money et MTN Money. Aucune carte bancaire requise. Paiement mensuel sans engagement.' },
                { q: 'Comment fonctionnent les relances automatiques ?', a: 'À partir du plan Pro, FACTURA envoie automatiquement des emails de relance à J+3, J+7 et J+15 après la date d\'échéance. Le plan Business ajoute les relances WhatsApp pour multiplier vos chances de paiement.' },
                { q: 'Puis-je annuler mon abonnement ?', a: 'Oui, à tout moment depuis la page Paramètres. Aucun frais d\'annulation. Vous conservez l\'accès jusqu\'à la fin de la période payée.' },
                { q: 'Plusieurs utilisateurs peuvent-ils accéder au même compte ?', a: 'La gestion multi-utilisateurs est disponible sur le plan Business (jusqu\'à 5 utilisateurs). Les plans Gratuit et Pro sont mono-utilisateur.' },
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
                {[
                  'API Factura',
                  'Base de données',
                  'Génération PDF',
                  'Authentification',
                  'Relances automatiques',
                  'Paiements mobile money',
                  'Export DGI',
                ].map(service => (
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
                <p>Vos données sont utilisées exclusivement pour fournir les services FACTURA : génération de documents, calcul de statistiques financières, assistance IA, et amélioration du service.</p>
              </ModalSection>

              <ModalSection title="3. Stockage et sécurité">
                <p>Données hébergées sur Supabase (AWS eu-west-1, Paris). Chiffrement TLS en transit, AES-256 au repos. Sauvegardes quotidiennes. Accès restreint aux seuls employés autorisés.</p>
              </ModalSection>

              <ModalSection title="4. Partage de données">
                <p>Nous ne vendons ni ne partageons vos données avec des tiers, sauf obligation légale (requête judiciaire) ou prestataires techniques (Supabase, Vercel) dans le cadre strict du service.</p>
              </ModalSection>

              <ModalSection title="5. Vos droits">
                <p>Vous pouvez à tout moment demander l'accès, la rectification ou la suppression de vos données en contactant <a href="mailto:support@factura.ci" className="text-[#111827] underline">support@factura.ci</a>. Délai de traitement : 72h.</p>
              </ModalSection>

              <ModalSection title="6. Cookies">
                <p>FACTURA utilise uniquement des cookies techniques nécessaires au fonctionnement du service (session d'authentification). Aucun cookie publicitaire ni de tracking tiers.</p>
              </ModalSection>
            </div>
          )}

          {activeModal === 'cgu' && (
            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-[#111827]">Conditions Générales d'Utilisation</h2>
              <p className="text-[12px] text-[#9CA3AF]">En vigueur au 1er mai 2026</p>

              <ModalSection title="1. Objet">
                <p>Les présentes CGU régissent l'utilisation de la plateforme FACTURA accessible sur factura-zwrz.vercel.app, éditée par FACTURA CI SARL, entreprise de droit ivoirien.</p>
              </ModalSection>

              <ModalSection title="2. Accès au service">
                <p>L'accès requiert la création d'un compte avec une adresse email valide. Vous êtes responsable de la confidentialité de vos identifiants et de toutes les actions effectuées depuis votre compte.</p>
              </ModalSection>

              <ModalSection title="3. Plans et facturation">
                <ul className="space-y-1 text-[13px] text-[#6B7280] mt-1">
                  <li>• Plan Gratuit : accès limité, sans engagement, sans expiration</li>
                  <li>• Plans payants : facturation mensuelle, sans engagement, résiliation à tout moment</li>
                  <li>• En cas de non-renouvellement, le compte est rétrogradé au plan Gratuit</li>
                  <li>• Aucun remboursement pour la période déjà entamée</li>
                </ul>
              </ModalSection>

              <ModalSection title="4. Utilisation acceptable">
                <p>Vous vous engagez à utiliser FACTURA uniquement pour des activités légales. Toute tentative de fraude, d'accès non autorisé ou d'utilisation abusive entraîne la résiliation immédiate du compte.</p>
              </ModalSection>

              <ModalSection title="5. Propriété intellectuelle">
                <p>La plateforme FACTURA, sa marque et ses contenus sont la propriété exclusive de FACTURA CI SARL. Toute reproduction ou utilisation sans autorisation écrite préalable est interdite.</p>
              </ModalSection>

              <ModalSection title="6. Limitation de responsabilité">
                <p>FACTURA s'engage à maintenir une disponibilité maximale du service mais ne peut garantir une disponibilité de 100%. Notre responsabilité est limitée au montant des abonnements payés sur les 3 derniers mois.</p>
              </ModalSection>

              <ModalSection title="7. Droit applicable">
                <p>Les présentes CGU sont soumises au droit ivoirien. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, les tribunaux d'Abidjan sont seuls compétents.</p>
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
                  <p>Téléphone : +225 07 00 00 00 00</p>
                </div>
              </ModalSection>

              <ModalSection title="Hébergement">
                <div className="space-y-1 text-[13px] text-[#6B7280]">
                  <p><strong className="text-[#374151]">Site web :</strong> Vercel Inc., 340 Pine Street Suite 700, San Francisco, CA 94104, USA</p>
                  <p><strong className="text-[#374151]">Base de données :</strong> Supabase Inc., hébergée sur AWS eu-west-1 (Paris, France)</p>
                </div>
              </ModalSection>

              <ModalSection title="Propriété intellectuelle">
                <p>L'ensemble du contenu de ce site (textes, images, code source, marque FACTURA) est protégé par le droit ivoirien de la propriété intellectuelle. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.</p>
              </ModalSection>

              <ModalSection title="Données personnelles">
                <p>Conformément à la réglementation en vigueur sur la protection des données personnelles en Côte d'Ivoire, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles. Pour exercer ces droits : <a href="mailto:support@factura.ci" className="text-[#111827] underline">support@factura.ci</a></p>
              </ModalSection>

              <ModalSection title="Crédits techniques">
                <p className="text-[13px] text-[#6B7280]">Développé avec React, TypeScript, Vite, Supabase, Tailwind CSS et déployé sur Vercel.</p>
              </ModalSection>
            </div>
          )}
          </div>
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
