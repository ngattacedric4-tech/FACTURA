import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, Smartphone, Lock, X } from 'lucide-react';

interface CheckoutPlan {
  id: 'pro' | 'business';
  name: string;
  price: string;
  priceNote: string;
  features: string[];
}

interface CheckoutData { plan: 'pro' | 'business'; planName: string; price: string; }
interface Props {
  plan: CheckoutPlan;
  onClose: () => void;
  onStartCheckout: (data: CheckoutData) => void;
}

export function CheckoutModal({ plan, onClose, onStartCheckout }: Props) {
  const handlePay = () => {
    onStartCheckout({ plan: plan.id, planName: plan.name, price: plan.price });
  };

  const topFeatures = plan.features.slice(0, 4);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl gap-0">
        {/* Header */}
        <div className="bg-[#111827] px-6 pt-6 pb-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={16} />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">
            Abonnement
          </p>
          <h2 className="text-[22px] font-bold text-white">Plan {plan.name}</h2>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[28px] font-bold text-white">{plan.price}</span>
            <span className="text-[13px] text-white/50">{plan.priceNote}</span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Features */}
          <div className="space-y-2.5">
            {topFeatures.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={10} className="text-emerald-600" strokeWidth={3} />
                </div>
                <span className="text-[13px] text-[#374151]">{f}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-[#F3F4F6]" />

          {/* Payment methods */}
          <div>
            <p className="text-[11px] text-[#9CA3AF] mb-2.5">Moyens de paiement acceptés</p>
            <div className="flex gap-2 flex-wrap">
              {['Wave', 'Orange Money', 'MTN Money'].map(m => (
                <span key={m}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md bg-[#F3F4F6] text-[#6B7280]">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handlePay}
            className="w-full h-12 bg-[#111827] hover:bg-[#1F2937] text-white rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2"
          >
            <Smartphone size={16} />
            Payer par mobile money
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#9CA3AF]">
            <Lock size={11} />
            <span>Paiement sécurisé · données chiffrées</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
