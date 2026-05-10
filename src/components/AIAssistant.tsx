import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePlan } from '@/hooks/usePlan';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, X, Send, User, Zap, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Résume mes finances',
  'Factures impayées ?',
  'Rédiger une relance client',
  'Explique la TVA ivoirienne',
  'Conseils pour augmenter mon CA',
];

export function AIAssistant() {
  const { user } = useAuth();
  const { plan } = usePlan();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPaid = plan !== 'starter';

  useEffect(() => {
    if (open && messages.length === 0 && isPaid) {
      setMessages([{
        role: 'assistant',
        content: "Bonjour ! Je suis FACTURAI, votre assistant intelligent.\n\nJe connais vos données en temps réel : factures, clients, paiements, finances. Posez-moi n'importe quelle question — comptabilité, fiscalité ivoirienne, rédaction d'emails, analyse de vos chiffres.",
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (content: string = input.trim()) => {
    if (!content || loading) return;
    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: newMessages },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erreur : ${e.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 z-50 ${
          open ? 'bg-[#374151]' : 'bg-[#111827] hover:bg-[#1F2937] hover:scale-105'
        }`}
      >
        {open ? <X size={20} className="text-white" /> : <Sparkles size={20} className="text-white" />}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed right-4 bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-[#E5E7EB] overflow-hidden"
            style={{
              bottom: '88px',
              width: 'min(390px, calc(100vw - 32px))',
              height: 'min(520px, calc(100vh - 112px))',
            }}
          >
            {/* Header */}
            <div className="h-14 bg-[#111827] flex items-center px-4 gap-3 shrink-0">
              <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                <Sparkles size={15} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white text-[13px] font-bold leading-tight">FACTURAI</p>
                <p className="text-[11px] leading-tight" style={{ color: isPaid ? '#6EE7B7' : '#6B7280' }}>
                  {isPaid ? '● Actif · données en temps réel' : 'Plan Pro requis'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#6B7280] hover:text-white transition-colors p-1">
                <ChevronDown size={18} />
              </button>
            </div>

            {!isPaid ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
                  <Zap size={28} className="text-amber-500" />
                </div>
                <div>
                  <p className="font-bold text-[#0A0A0A] text-[16px]">Disponible dès le plan Pro</p>
                  <p className="text-[13px] text-[#6B7280] mt-2 leading-relaxed">
                    L'assistant IA analyse vos données en temps réel et vous aide avec la comptabilité, les factures et la fiscalité ivoirienne.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 bg-[#111827] text-white text-[13px] font-semibold rounded-xl hover:bg-[#1F2937] transition-colors"
                >
                  Voir les plans
                </button>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        m.role === 'assistant' ? 'bg-[#111827]' : 'bg-[#F3F4F6]'
                      }`}>
                        {m.role === 'assistant'
                          ? <Sparkles size={12} className="text-white" />
                          : <User size={12} className="text-[#6B7280]" />}
                      </div>
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-[#111827] text-white rounded-tr-sm'
                          : 'bg-[#F9FAFB] text-[#0A0A0A] rounded-tl-sm border border-[#F3F4F6]'
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#111827] flex items-center justify-center">
                        <Sparkles size={12} className="text-white" />
                      </div>
                      <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl rounded-tl-sm px-4 py-3.5">
                        <div className="flex gap-1 items-center">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Quick prompts */}
                {messages.length <= 1 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map(p => (
                      <button key={p} onClick={() => send(p)} disabled={loading}
                        className="text-[11px] text-[#6B7280] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-2.5 py-1 rounded-full transition-colors disabled:opacity-40">
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-[#F3F4F6] shrink-0">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Posez votre question..."
                      className="flex-1 h-10 px-3.5 text-[13px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white transition-colors"
                    />
                    <button
                      onClick={() => send()}
                      disabled={!input.trim() || loading}
                      className="w-10 h-10 bg-[#111827] text-white rounded-xl flex items-center justify-center hover:bg-[#1F2937] disabled:opacity-40 transition-all"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
