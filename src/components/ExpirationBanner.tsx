import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useActivation } from '@/hooks/useActivation';

interface Props {
  onNavigate: (page: string) => void;
}

const WARN_DAYS = 7;       // bandeau amber si <= 7 jours
const URGENT_HOURS = 24;   // bandeau rouge si <= 24h

export function ExpirationBanner({ onNavigate }: Props) {
  const { active, daysLeft, minutesLeft, expiresAt, loading } = useActivation();

  if (loading || !active || !expiresAt) return null;

  const hoursLeft = Math.ceil(minutesLeft / 60);
  const isUrgent  = hoursLeft <= URGENT_HOURS;
  const isWarn    = !isUrgent && daysLeft <= WARN_DAYS;

  if (!isUrgent && !isWarn) return null;

  const colors = isUrgent
    ? { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'text-red-500',    btn: 'bg-red-600 hover:bg-red-700' }
    : { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'text-amber-500',  btn: 'bg-amber-600 hover:bg-amber-700' };

  const Icon = isUrgent ? AlertTriangle : Clock;

  const label = (() => {
    if (minutesLeft < 60)        return `dans ${minutesLeft} min`;
    if (minutesLeft < 1440)      return `dans ${hoursLeft} h`;
    return `dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${new Date(expiresAt).toLocaleDateString('fr-FR')})`;
  })();

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-2xl px-4 py-3 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${colors.icon} mt-0.5 shrink-0`} />
        <div>
          <p className={`text-[13px] font-semibold ${colors.text}`}>
            {isUrgent ? 'Votre abonnement expire bientôt' : 'Votre abonnement va expirer'}
          </p>
          <p className={`text-[12px] mt-0.5 ${colors.text} opacity-80`}>
            Expire {label}. Renouvelez maintenant pour éviter une interruption de service.
          </p>
        </div>
      </div>
      <button
        onClick={() => onNavigate('pricing')}
        className={`shrink-0 h-9 px-4 ${colors.btn} text-white text-[12px] font-semibold rounded-xl flex items-center gap-1.5 transition-colors`}
      >
        Renouveler <ArrowRight size={13} />
      </button>
    </div>
  );
}
