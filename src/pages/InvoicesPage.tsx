import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Invoice } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  FileText, 
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Download,
  Send,
  MessageSquare,
  FileDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceCreator } from '@/components/invoices/InvoiceCreator';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/invoices/InvoicePDF';
import { InvoicePreviewModal } from '@/components/invoices/InvoicePreviewModal';
import { toast } from 'sonner';
import { usePlan } from '@/hooks/usePlan';
import { PLAN_LABEL } from '@/lib/plans';
import { DOC_TYPE_META } from '@/lib/documentTypes';
import { InvoiceType } from '@/types/database';

interface InvoicesPageProps {
  onNavigate: (page: string) => void;
}

export function InvoicesPage({ onNavigate }: InvoicesPageProps) {
  const { company } = useAuth();
  const { plan, limits, usage, canCreate, refresh: refreshPlan } = usePlan();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<InvoiceType>('invoice');
  const isBusiness = plan === 'business' || plan === 'enterprise';
  const [isCreating, setIsCreating] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'wave'|'om'|'mtn'|'cash'|'transfer'|'check'>('wave');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0,10));
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<any>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  const displayInvoices = invoices.filter(inv =>
    !search ||
    inv.number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (company) {
      fetchInvoices();
    }
  }, [company, filterType]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(*), invoice_items(*), payments(amount)')
        .eq('company_id', company?.id)
        .eq('type', filterType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const enriched = (data || []).map((inv: any) => {
        const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        return { ...inv, amount_paid: paid, amount_due: Math.max((inv.total_ttc || 0) - paid, 0) };
      });
      setInvoices(enriched);
    } catch (error: any) {
      console.log('Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateInvoiceStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Statut mis à jour !');
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function convertToInvoice(est: any) {
    try {
      const newNumber = `FAC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
      const { error } = await supabase.from('invoices').update({ type: 'invoice', number: newNumber, status: 'draft', updated_at: new Date().toISOString() }).eq('id', est.id);
      if (error) throw error;
      toast.success(`Devis converti en facture ${newNumber} !`);
      fetchInvoices();
    } catch(e:any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('invoice_items').delete().eq('invoice_id', id);
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Document supprimé.');
      fetchInvoices();
    } catch(e:any) { toast.error(e.message); }
  }

  function sendWhatsAppReminder(inv: any) {
    const phone = inv.clients?.phone?.replace(/\s/g, '') || '';
    const docType = inv.type === 'estimate' ? 'devis' : 'facture';
    const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—';
    const message = encodeURIComponent(
      `Bonjour ${inv.clients?.name || ''},\n\nVeuillez trouver ci-joint votre ${docType} N°${inv.number} d'un montant de ${(inv.total_ttc||0).toLocaleString('fr-FR')} FCFA.\nÉchéance : ${dueStr}\n\nCordialement,\n${company?.name || ''}`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }

  function openPayDialog(inv: any) {
    setPayingInvoice(inv);
    const remaining = inv.amount_due ?? inv.total_ttc ?? 0;
    setPayAmount(String(remaining || ''));
    setPayMethod('wave');
    setPayRef('');
    setPayDate(new Date().toISOString().slice(0,10));
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payingInvoice) return;
    setPaySubmitting(true);
    try {
      const amount = parseFloat(payAmount);
      if (!amount || amount <= 0) throw new Error('Montant invalide');
      const total = Number(payingInvoice.total_ttc || 0);
      const alreadyPaid = Number(payingInvoice.amount_paid || 0);
      const newPaid = alreadyPaid + amount;
      if (newPaid > total + 0.01) {
        throw new Error(`Montant dépasse le solde restant (${(total - alreadyPaid).toLocaleString('fr-FR')} FCFA)`);
      }
      const { error: pErr } = await supabase.from('payments').insert({
        invoice_id: payingInvoice.id,
        amount,
        method: payMethod,
        reference: payRef || null,
        payment_date: new Date(payDate).toISOString(),
      });
      if (pErr) throw pErr;
      // Le trigger SQL recompute_invoice_status met à jour le statut automatiquement.
      // Fallback côté client si le trigger n'est pas encore déployé :
      const newStatus = newPaid >= total ? 'paid' : 'partial';
      await supabase.from('invoices')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', payingInvoice.id);
      toast.success(newStatus === 'paid' ? 'Facture soldée !' : `Acompte enregistré (${amount.toLocaleString('fr-FR')} FCFA).`);
      setPayingInvoice(null);
      fetchInvoices();
    } catch(e:any) {
      toast.error(e.message || 'Erreur enregistrement paiement');
    } finally { setPaySubmitting(false); }
  }

  if (previewInvoice && company) {
    return (
      <InvoicePreviewModal
        onClose={() => setPreviewInvoice(null)}
        company={company}
        invoice={previewInvoice}
        showBrand={!limits.pdfBrand}
      />
    );
  }

  if (isCreating) {
    return (
      <InvoiceCreator
        type={filterType}
        existingInvoice={editingInvoice}
        onCancel={() => { setIsCreating(false); setEditingInvoice(null); }}
        onSaved={() => {
          setIsCreating(false);
          setEditingInvoice(null);
          fetchInvoices();
          refreshPlan();
        }}
      />
    );
  }

  const getStatusBadge = (status: string) => {
    let label = status;
    let icon = null;
    let cls = 'bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]';
    switch (status) {
      case 'paid': label = 'Payée'; icon = <CheckCircle2 size={12} className="mr-1" />; cls = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'; break;
      case 'partial': label = 'Acompte'; icon = <Clock size={12} className="mr-1" />; cls = 'bg-amber-50 text-amber-700 hover:bg-amber-100'; break;
      case 'overdue': label = 'En retard'; icon = <AlertCircle size={12} className="mr-1" />; cls = 'bg-red-50 text-red-700 hover:bg-red-100'; break;
      case 'sent': label = 'Envoyée'; icon = <Send size={12} className="mr-1" />; break;
      case 'draft': label = 'Brouillon'; break;
      case 'canceled': label = 'Annulée'; break;
      case 'accepted': label = 'Accepté'; icon = <CheckCircle2 size={12} className="mr-1" />; cls = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'; break;
      case 'rejected': label = 'Refusé'; break;
    }
    return (
      <Badge className={`${cls} font-bold border-none px-3 py-1 flex items-center inline-flex w-fit`}>
        {icon}
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <Tabs defaultValue="invoice" onValueChange={(v) => setFilterType(v as InvoiceType)} className={isBusiness ? 'w-full max-w-[680px]' : 'w-[400px]'}>
          <TabsList className={`grid p-1 bg-[#F8F9FA] rounded-xl h-12 border border-[#E5E7EB] ${isBusiness ? 'grid-cols-5' : 'grid-cols-2'}`}>
            <TabsTrigger value="invoice"        className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0A0A0A] data-[state=active]:shadow-sm transition-all font-medium text-[#6B7280]">Factures</TabsTrigger>
            <TabsTrigger value="estimate"       className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0A0A0A] data-[state=active]:shadow-sm transition-all font-medium text-[#6B7280]">Devis</TabsTrigger>
            {isBusiness && <>
              <TabsTrigger value="purchase_order" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0A0A0A] data-[state=active]:shadow-sm transition-all font-medium text-[#6B7280]">B. Commande</TabsTrigger>
              <TabsTrigger value="delivery_note"  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0A0A0A] data-[state=active]:shadow-sm transition-all font-medium text-[#6B7280]">B. Livraison</TabsTrigger>
              <TabsTrigger value="credit_note"    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0A0A0A] data-[state=active]:shadow-sm transition-all font-medium text-[#6B7280]">Avoirs</TabsTrigger>
            </>}
          </TabsList>
        </Tabs>
        
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15}/>
          <Input placeholder="Rechercher..." className="pl-9 h-10 rounded-xl border-[#E5E7EB] text-[13px]" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <Button
          className="rounded-xl font-medium bg-[#111827] hover:bg-[#1F2937] text-white transition-all h-11 px-6"
          onClick={() => {
            const isMetered = filterType === 'invoice' || filterType === 'estimate';
            if (isMetered && !canCreate(filterType as 'invoice' | 'estimate')) {
              toast.error(`Limite plan ${PLAN_LABEL[plan]} atteinte (${filterType==='invoice'?usage.invoicesThisMonth+'/'+limits.invoicesPerMonth+' factures':usage.estimatesThisMonth+'/'+limits.estimatesPerMonth+' devis'} ce mois). Passez à Pro.`);
              onNavigate('pricing');
              return;
            }
            setEditingInvoice(null); setIsCreating(true);
          }}
        >
          <Plus size={18} className="mr-2" />
          Nouveau {DOC_TYPE_META[filterType].numberWord.toLowerCase()}
        </Button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
              <TableHead className="w-[150px] font-bold h-12">Référence</TableHead>
              <TableHead className="font-bold">Client</TableHead>
              <TableHead className="font-bold">Date d'émission</TableHead>
              <TableHead className="font-bold">Montant TTC</TableHead>
              <TableHead className="font-bold">Statut</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-slate-500">
                  Chargement des documents...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-72 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="bg-slate-50 p-6 rounded-full text-slate-200">
                      <FileText size={64} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 text-lg">Aucun document pour le moment</p>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">
                        Créez votre premier {DOC_TYPE_META[filterType].numberWord.toLowerCase()} et envoyez-le à votre client.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayInvoices.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => setPreviewInvoice(inv)}>
                  <TableCell className="font-black text-slate-900">
                    {inv.number}
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    {inv.clients?.name || 'Client inconnu'}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(inv.issue_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-black text-slate-900 lg:text-base">
                    {inv.total_ttc.toLocaleString('fr-FR')} FCFA
                    {inv.amount_paid > 0 && inv.amount_due > 0 && (
                      <div className="text-[11px] font-medium text-amber-700 mt-0.5">
                        Reste {inv.amount_due.toLocaleString('fr-FR')} FCFA
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(inv.status)}
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-1">
                      {company && (
                        <PDFDownloadLink
                          document={
                            <InvoicePDF
                              company={company}
                              client={inv.clients || { name: 'Client' }}
                              invoice={inv}
                              items={inv.invoice_items || [{ description: 'Service', quantity: 1, unit_price: inv.total_ttc / 1.18, tva_rate: 18, amount_ht: inv.total_ttc / 1.18 }]}
                              showBrand={!limits.pdfBrand}
                            />
                          }
                          fileName={`${inv.number}.pdf`}
                        >
                          {({ loading: pdfLoading }) => (
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full group-hover:bg-primary/5 group-hover:text-primary transition-colors" disabled={pdfLoading}>
                              <FileDown size={18} />
                            </Button>
                          )}
                        </PDFDownloadLink>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl w-56 p-2 border-slate-200 shadow-2xl">
                          <DropdownMenuLabel className="px-3 py-2 text-xs uppercase tracking-widest text-slate-400 font-black">Gestion Document</DropdownMenuLabel>
                          <DropdownMenuItem className="rounded-xl px-3 py-2.5 cursor-pointer" onClick={() => { setEditingInvoice(inv); setIsCreating(true); }}>
                            <FileText size={16} className="mr-3" /> Éditer le document
                          </DropdownMenuItem>
                          
                          {inv.status === 'draft' && (
                            <DropdownMenuItem 
                              className="rounded-xl px-3 py-2.5 cursor-pointer text-blue-600 font-bold"
                              onClick={() => updateInvoiceStatus(inv.id, 'sent')}
                            >
                              <Send size={16} className="mr-3" /> Marquer comme envoyé
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem className="rounded-xl px-3 py-2.5 cursor-pointer" onClick={() => sendWhatsAppReminder(inv)}>
                            <MessageSquare size={16} className="mr-3 text-emerald-600" /> Relancer par WhatsApp
                          </DropdownMenuItem>
                          
                          {inv.status !== 'paid' && (
                            <DropdownMenuItem
                              className="rounded-xl px-3 py-2.5 cursor-pointer text-emerald-600 font-bold"
                              onClick={() => openPayDialog(inv)}
                            >
                              <CheckCircle2 size={16} className="mr-3" />
                              {inv.status === 'partial' ? 'Encaisser solde / acompte' : 'Encaisser paiement / acompte'}
                            </DropdownMenuItem>
                          )}

                          {inv.status !== 'paid' && inv.status !== 'overdue' && inv.status !== 'canceled' && (
                            <DropdownMenuItem 
                              className="rounded-xl px-3 py-2.5 cursor-pointer text-[#0A0A0A]"
                              onClick={() => updateInvoiceStatus(inv.id, 'overdue')}
                            >
                              <AlertCircle size={16} className="mr-3" /> Marquer en retard
                            </DropdownMenuItem>
                          )}

                          {inv.type === 'estimate' && inv.status !== 'rejected' && (
                            <DropdownMenuItem
                              className="rounded-xl px-3 py-2.5 cursor-pointer text-blue-600 font-bold"
                              onClick={() => convertToInvoice(inv)}
                            >
                              <ArrowRight size={16} className="mr-3" /> Convertir en facture
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="my-2 bg-slate-100" />
                          <DropdownMenuItem 
                            className="rounded-xl px-3 py-2.5 cursor-pointer text-red-600 focus:text-red-900 focus:bg-red-50"
                            onClick={() => updateInvoiceStatus(inv.id, 'canceled')}
                          >
                            Annuler ce document
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-xl px-3 py-2.5 cursor-pointer text-red-700 font-bold focus:text-red-900 focus:bg-red-50"
                            onClick={() => setDeletingInvoice(inv)}
                          >
                            Supprimer définitivement
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>


      <Dialog open={!!deletingInvoice} onOpenChange={(o)=>{ if(!o) setDeletingInvoice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Supprimer ce document ?</DialogTitle></DialogHeader>
          <p className="text-[13px] text-[#6B7280]">
            Le document <strong>{deletingInvoice?.number}</strong> et toutes ses lignes seront supprimés définitivement. Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={()=>setDeletingInvoice(null)}>Annuler</Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async()=>{ const id=deletingInvoice.id; setDeletingInvoice(null); await handleDelete(id); }}
            >Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payingInvoice} onOpenChange={(o)=>{ if(!o) setPayingInvoice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement / acompte</DialogTitle>
          </DialogHeader>
          {payingInvoice && (
            <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-[#6B7280]">Total facture</span><span className="font-mono font-bold text-[#111827]">{Number(payingInvoice.total_ttc||0).toLocaleString('fr-FR')} FCFA</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Déjà payé</span><span className="font-mono text-emerald-700">{Number(payingInvoice.amount_paid||0).toLocaleString('fr-FR')} FCFA</span></div>
              <div className="flex justify-between border-t border-[#E5E7EB] pt-1.5 mt-1.5"><span className="font-semibold text-[#111827]">Solde restant</span><span className="font-mono font-bold text-amber-700">{Number(payingInvoice.amount_due ?? payingInvoice.total_ttc ?? 0).toLocaleString('fr-FR')} FCFA</span></div>
            </div>
          )}
          <form onSubmit={handlePaySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Montant à encaisser (FCFA)</Label>
              <Input type="number" step="1" required value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="Saisissez un acompte ou le solde complet" />
              <p className="text-[11px] text-[#9CA3AF]">Pré-rempli avec le solde restant. Modifiez librement pour enregistrer un acompte.</p>
            </div>
            <div className="space-y-2">
              <Label>Méthode de paiement</Label>
              <Select value={payMethod} onValueChange={(v)=>setPayMethod(v as any)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wave">Wave</SelectItem>
                  <SelectItem value="om">Orange Money</SelectItem>
                  <SelectItem value="mtn">MTN Money</SelectItem>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Référence (optionnel)</Label>
              <Input value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="N° transaction" />
            </div>
            <div className="space-y-2">
              <Label>Date de paiement</Label>
              <Input type="date" required value={payDate} onChange={e=>setPayDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={()=>setPayingInvoice(null)}>Annuler</Button>
              <Button type="submit" disabled={paySubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">{paySubmitting?'Enregistrement...':'Confirmer le paiement'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
