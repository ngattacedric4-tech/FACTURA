import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State { hasError: boolean; error?: Error; }
interface Props { children: React.ReactNode; }

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  declare state: State;
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary capturé:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle size={26}/>
            </div>
            <h1 className="text-xl font-bold text-[#0A0A0A]">Une erreur est survenue</h1>
            <p className="text-[13px] text-[#6B7280]">
              L'application a rencontré un problème inattendu. Veuillez recharger la page. Si le problème persiste, contactez le support.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-[#9CA3AF] font-mono bg-[#F9FAFB] rounded-lg p-2 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#111827] text-white rounded-xl h-10 px-6 text-[13px] font-medium hover:bg-[#1F2937]"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
