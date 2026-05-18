import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Star, MessageSquareText, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const TRIGGER_DAYS = 7;
const DISMISS_KEY = 'testimonial_prompt_dismissed';

export function TestimonialPrompt() {
  const { user, company } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<any>(null);

  useEffect(() => {
    if (!company || !user) return;

    // Vérifier ancienneté du compte
    const createdAt = company.created_at ? new Date(company.created_at).getTime() : Date.now();
    const ageDays = (Date.now() - createdAt) / 86_400_000;
    if (ageDays < TRIGGER_DAYS) { setEligible(false); return; }

    // Skip si dismiss
    if (localStorage.getItem(DISMISS_KEY) === company.id) { setEligible(false); return; }

    // Vérifier si témoignage déjà soumis
    supabase
      .from('testimonials')
      .select('*')
      .eq('company_id', company.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setExisting(data); setEligible(false); return; }
        setEligible(true);
        setAuthorName(company.name || '');
      });
  }, [company, user]);

  function dismiss() {
    if (company?.id) localStorage.setItem(DISMISS_KEY, company.id);
    setEligible(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !company) return;
    if (content.trim().length < 20) { toast.error('Avis trop court (20 caractères minimum).'); return; }
    if (content.length > 500)        { toast.error('Avis trop long (500 max).'); return; }
    if (!authorName.trim())          { toast.error('Indiquez votre nom.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('testimonials').insert({
        company_id: company.id,
        user_id: user.id,
        author_name: authorName.trim(),
        author_role: authorRole.trim() || null,
        content: content.trim(),
        stars,
      });
      if (error) throw error;
      toast.success('Merci ! Votre avis sera publié après vérification.');
      setOpen(false);
      setEligible(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally { setSubmitting(false); }
  }

  if (!eligible || existing) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative">
        <button
          onClick={dismiss}
          aria-label="Ne plus afficher"
          className="absolute top-2 right-2 w-6 h-6 rounded-full hover:bg-amber-100 flex items-center justify-center text-amber-700/60 hover:text-amber-700 transition-colors"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <MessageSquareText size={18} className="text-amber-700" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-amber-800">Ça fait plus d'une semaine que vous utilisez FACTURA. Votre avis ?</p>
            <p className="text-[12px] text-amber-700 mt-0.5">Aidez d'autres entrepreneurs à découvrir l'outil. 30 secondes.</p>
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold rounded-xl shrink-0"
        >
          Laisser un avis
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star size={18} className="text-amber-500 fill-amber-500" /> Votre avis sur FACTURA
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Note</Label>
              <div className="flex items-center gap-1.5 mt-2">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n} type="button" onClick={() => setStars(n)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={n <= stars ? 'text-amber-400 fill-amber-400' : 'text-[#E5E7EB] fill-[#E5E7EB]'}
                    />
                  </button>
                ))}
                <span className="text-[12px] text-[#6B7280] ml-2">{stars}/5</span>
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Votre nom *</Label>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="Ex: Aminata Diallo"
                maxLength={80}
                className="w-full h-10 mt-1 px-3 text-[13px] border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white"
              />
            </div>

            <div>
              <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Rôle / entreprise (optionnel)</Label>
              <input
                type="text"
                value={authorRole}
                onChange={e => setAuthorRole(e.target.value)}
                placeholder="Ex: Gérante, KA Digital"
                maxLength={80}
                className="w-full h-10 mt-1 px-3 text-[13px] border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white"
              />
            </div>

            <div>
              <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-widest">Votre avis *</Label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Qu'est-ce qui vous a marqué ? Comment FACTURA vous aide au quotidien ?"
                className="w-full mt-1 px-3 py-2.5 text-[13px] border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:bg-white resize-none"
              />
              <p className="text-[11px] text-[#9CA3AF] mt-1">{content.length}/500 caractères · 20 min</p>
            </div>

            <p className="text-[11px] text-[#9CA3AF]">
              Votre avis sera publié sur la page d'accueil après vérification (24h max).
            </p>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                type="submit"
                disabled={submitting || content.trim().length < 20 || !authorName.trim()}
                className="bg-[#111827] hover:bg-[#1F2937] text-white disabled:opacity-50"
              >
                <Send size={14} className="mr-1.5" />
                {submitting ? 'Envoi…' : 'Envoyer mon avis'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
