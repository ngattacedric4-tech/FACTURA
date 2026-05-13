import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { InvoiceType, Client, Product } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  FileText,
  MessageCircle,
  ChevronDown,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { SelectField } from '@/components/ui/SelectField';
import { PAYMENT_TERMS_OPTIONS, TVA_OPTIONS, PRODUCT_UNIT_OPTIONS, PAYMENT_METHOD_OPTIONS } from '@/lib/selectOptions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/invoices/InvoicePDF';
import { usePlan } from '@/hooks/usePlan';
import { toast } from 'sonner';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tva_rate: number;
  unit: string;
}

interface InvoiceCreatorProps {
  type: InvoiceType;
  onCancel: () => void;
  onSaved: () => void;
  existingInvoice?: any;
}

export function InvoiceCreator({ type, onCancel, onSaved, existingInvoice }: InvoiceCreatorProps) {
  const { company } = useAuth();
  const { limits } = usePlan();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<string>('15');
  const [customDueDate, setCustomDueDate] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [savedInvoice, setSavedInvoice] = useState<any>(null);

  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0, tva_rate: 18, unit: 'forfait' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    if (company) {
      fetchData();
      if (existingInvoice) {
        setInvoiceNumber(existingInvoice.number || '');
        setSelectedClientId(existingInvoice.client_id || '');
        setIssueDate(existingInvoice.issue_date || new Date().toISOString().split('T')[0]);
        setStatus(existingInvoice.status || 'draft');
        setNotes(existingInvoice.notes || '');
        if (existingInvoice.invoice_items?.length) {
          setLines(existingInvoice.invoice_items.map((item: any) => ({
            id: item.id || Math.random().toString(),
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            tva_rate: item.tva_rate || 18,
            unit: item.unit || 'forfait',
          })));
        }
      } else {
        generateTempNumber();
      }
    }
  }, [company]);

  async function fetchData() {
    const [clientsRes, productsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('company_id', company?.id),
      supabase.from('products').select('*').eq('company_id', company?.id)
    ]);
    setClients(clientsRes.data || []);
    setProducts(productsRes.data || []);
  }

  function generateTempNumber() {
    const year = new Date().getFullYear();
    const prefix = type === 'invoice' ? 'FAC' : 'DEV';
    setInvoiceNumber(`${prefix}-${year}-${Math.floor(1000 + Math.random() * 9000)}`);
  }

  const addLine = () => {
    setLines([...lines, { id: Math.random().toString(), description: '', quantity: 1, unit_price: 0, tva_rate: 18, unit: 'forfait' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter(l => l.id !== id));
    } else {
      setLines([{ id: lines[0].id, description: '', quantity: 1, unit_price: 0, tva_rate: 18, unit: 'forfait' }]);
    }
  };

  const updateLine = (id: string, field: keyof InvoiceLine | '', value: any) => {
    if (field === '') {
      setLines(lines.map(l => l.id === id ? {
        ...l,
        description: value.name,
        unit_price: value.unit_price,
        tva_rate: value.tva_rate,
        unit: value.unit || 'forfait'
      } : l));
    } else {
      setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
    }
  };

  const calculateSubtotal = () => lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0);
  const calculateTVA = () => lines.reduce((acc, l) => acc + (l.quantity * l.unit_price * (l.tva_rate / 100)), 0);
  const calculateTotal = () => calculateSubtotal() + calculateTVA();

  const getCalculatedDueDate = () => {
    if (paymentTerms === 'custom') return customDueDate;
    const issueDateObj = new Date(issueDate);
    const days = parseInt(paymentTerms, 10) || 0;
    issueDateObj.setDate(issueDateObj.getDate() + days);
    return issueDateObj.toISOString().split('T')[0];
  };

  function handleWhatsApp() {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) { toast.error('Veuillez sélectionner un client'); return; }
    const phone = client.phone?.replace(/[\s\-\(\)]/g, '') || '';
    if (!phone) { toast.error("Ce client n'a pas de numéro de téléphone enregistré"); return; }
    const docType = type === 'estimate' ? 'devis' : 'facture';
    const dueDate = getCalculatedDueDate();
    const dueStr = dueDate ? new Date(dueDate).toLocaleDateString('fr-FR') : '—';
    const message = encodeURIComponent(
      `Bonjour ${client.name},\n\nVeuillez trouver ci-joint votre ${docType} N°${invoiceNumber} d'un montant de ${calculateTotal().toLocaleString('fr-FR')} FCFA.\nÉchéance : ${dueStr}\n\nCordialement,\n${company?.name || ''}`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  const handleSave = async () => {
    if (!selectedClientId) {
       toast.error('Veuillez sélectionner un client');
       return;
    }

    const dueDateToSave = getCalculatedDueDate();
    if (paymentTerms === 'custom' && !dueDateToSave) {
      toast.error("Veuillez spécifier la date d'échéance personnalisée");
      return;
    }

    setIsSaving(true);

    try {
      const finalNotes = subject ? `Objet: ${subject}\n\n${notes}` : notes;
      const finalTerms = paymentMethod ? `Mode de paiement: ${paymentMethod}` : '';

      let invoice: any;
      if (existingInvoice) {
        const { data, error: updErr } = await supabase.from('invoices').update({
          client_id: selectedClientId,
          status,
          issue_date: issueDate,
          due_date: dueDateToSave || null,
          notes: finalNotes,
          terms: finalTerms || PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms)?.label,
          subtotal_ht: calculateSubtotal(),
          total_tva: calculateTVA(),
          total_ttc: calculateTotal(),
          updated_at: new Date().toISOString(),
        }).eq('id', existingInvoice.id).select().single();
        if (updErr) throw updErr;
        invoice = data;
        await supabase.from('invoice_items').delete().eq('invoice_id', existingInvoice.id);
      } else {
        const { data, error: invError } = await supabase.from('invoices').insert({
          company_id: company?.id,
          client_id: selectedClientId,
          type,
          number: invoiceNumber,
          status: status,
          issue_date: issueDate,
          due_date: dueDateToSave || null,
          notes: finalNotes,
          terms: finalTerms || PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms)?.label,
          subtotal_ht: calculateSubtotal(),
          total_tva: calculateTVA(),
          total_ttc: calculateTotal(),
        }).select().single();
        if (invError) throw invError;
        invoice = data;
      }

      const itemsToInsert = lines.map(l => ({
        invoice_id: invoice.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        unit: l.unit,
        tva_rate: l.tva_rate,
        // amount_ht est une colonne GENERATED — la DB la calcule automatiquement
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Stocker le document sauvegardé pour le PDF + WhatsApp
      const selectedClient = clients.find(c => c.id === selectedClientId);
      setSavedInvoice({
        ...invoice,
        clients: selectedClient,
        invoice_items: lines.map(l => ({
          ...l,
          amount_ht: l.quantity * l.unit_price,
        })),
      });

      toast.success(`${type === 'invoice' ? 'Facture' : 'Devis'} enregistré avec succès !`);
      // Ne pas appeler onSaved() immédiatement — laisser l'utilisateur télécharger le PDF
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#F8F9FA] rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-8rem)] font-sans border border-[#E5E7EB]">
      {/* HEADER */}
      <div className="h-16 bg-[#FFFFFF] border-b border-[#E5E7EB] flex items-center justify-between px-6 shrink-0">
        <Button variant="ghost" className="text-[#6B7280] hover:text-[#0A0A0A] px-2 h-10 rounded-xl" onClick={savedInvoice ? onSaved : onCancel}>
          <ChevronLeft size={20} className="mr-1" /> {savedInvoice ? 'Retour à la liste' : 'Retour'}
        </Button>
        <h2 className="text-[20px] font-semibold text-[#0A0A0A]">
          {existingInvoice
            ? `Modifier ${type === 'invoice' ? 'la facture' : 'le devis'} ${existingInvoice.number}`
            : type === 'invoice' ? 'Nouvelle Facture' : 'Nouveau Devis'
          }
        </h2>
        <div className="flex items-center space-x-3">
          {!savedInvoice && (
            <Button variant="outline" className="border-[#E5E7EB] rounded-xl h-10 px-4 text-[#0A0A0A] hover:bg-[#F9FAFB] font-medium" onClick={onCancel}>
              Annuler
            </Button>
          )}
          {savedInvoice ? (
            <Button className="bg-emerald-600 text-white rounded-xl h-10 px-6 font-medium hover:bg-emerald-700 transition-all" onClick={onSaved}>
              <CheckCircle2 size={16} className="mr-2" /> Voir la liste
            </Button>
          ) : (
            <Button className="bg-[#111827] text-white rounded-xl h-10 px-6 font-medium hover:bg-[#1F2937] transition-all" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto p-6 text-[#0A0A0A]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-[1400px] mx-auto">

          {/* LEFT COL */}
          <div className="lg:col-span-8 flex flex-col space-y-6">

            {/* CARD 1 - Info */}
            <div className="bg-[#FFFFFF] rounded-2xl p-8 shadow-sm border border-[#F3F4F6]">
              <div className="grid grid-cols-2 gap-6 items-end mb-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Client <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <CustomSelect
                      size="lg"
                      value={selectedClientId}
                      onChange={setSelectedClientId}
                      disabled={!!savedInvoice}
                      placeholder="Sélectionner un client"
                      options={clients.map(c => ({ value: c.id, label: c.name }))}
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" size={16} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">N° {type === 'invoice' ? 'Facture' : 'Devis'} (Auto)</Label>
                  <Input
                    disabled
                    value={invoiceNumber}
                    className="h-[44px] bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280] font-mono rounded-xl cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">Date d'émission</Label>
                  <Input
                    type="date"
                    className="h-[44px] bg-[#FFFFFF] border-[#E5E7EB] rounded-xl focus:border-[#111827] focus:ring-1 focus:ring-[#111827]"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    disabled={!!savedInvoice}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">Date échéance</Label>
                  <Input
                    type="date"
                    disabled
                    className="h-[44px] bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280] rounded-xl cursor-not-allowed"
                    value={getCalculatedDueDate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">Délai</Label>
                  <div className="relative">
                    <CustomSelect
                      size="lg"
                      value={paymentTerms}
                      onChange={setPaymentTerms}
                      disabled={!!savedInvoice}
                      options={PAYMENT_TERMS_OPTIONS}
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" size={16} />
                  </div>
                </div>
              </div>

              {paymentTerms === 'custom' && !savedInvoice && (
                <div className="mb-6 grid grid-cols-3 gap-6">
                  <div className="col-start-3 space-y-2 mt-[-10px]">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">Échéance perso.</Label>
                    <Input
                      type="date"
                      className="h-[44px] bg-[#FFFFFF] border-[#E5E7EB] rounded-xl focus:border-[#111827] focus:ring-1 focus:ring-[#111827]"
                      value={customDueDate}
                      onChange={(e) => setCustomDueDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">Objet / Référence (Optionnel)</Label>
                <Input
                  placeholder="Ex: Développement site e-commerce Phase 1"
                  className="h-[44px] bg-[#FFFFFF] border-[#E5E7EB] rounded-xl focus:border-[#111827] focus:ring-1 focus:ring-[#111827] placeholder:text-[#D1D5DB]"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!!savedInvoice}
                />
              </div>
            </div>

            {/* CARD 2 - Items */}
            <div className="bg-[#FFFFFF] rounded-2xl p-8 shadow-sm border border-[#F3F4F6]">
              <div className="overflow-x-auto pb-4">
                <div className="hidden md:flex text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-4 px-2 min-w-[950px]">
                  <div className="w-[30%] min-w-[280px]">Description</div>
                  <div className="w-[8%] min-w-[80px] text-center">Qté</div>
                  <div className="w-[12%] min-w-[130px] pl-4">Unité</div>
                  <div className="w-[18%] min-w-[150px] text-right">Prix HT</div>
                  <div className="w-[12%] min-w-[110px] pl-4">TVA</div>
                  <div className="w-[15%] min-w-[150px] text-right">Montant</div>
                  <div className="w-[5%] min-w-[50px]"></div>
                </div>

                <div className="space-y-0 min-w-[950px]">
                  {lines.map((line) => (
                    <div key={line.id} className="relative flex flex-col md:flex-row items-center gap-3 py-4 border-b border-[#F3F4F6] group">
                      <div className="w-full md:w-[30%] md:min-w-[280px]">
                        <Input
                          placeholder="Description..."
                          className="h-[44px] border-[#E5E7EB] rounded-xl focus:border-[#111827] focus:ring-1 focus:ring-[#111827] placeholder:text-[#D1D5DB]"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                          disabled={!!savedInvoice}
                        />
                      </div>

                      <div className="w-full md:w-[8%] md:min-w-[80px]">
                        <Input
                          type="number"
                          min="1"
                          className="h-[44px] border-[#E5E7EB] text-center rounded-xl focus:border-[#111827] focus:ring-1 focus:ring-[#111827]"
                          value={line.quantity || ''}
                          onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                          disabled={!!savedInvoice}
                        />
                      </div>

                      <div className="w-full md:w-[12%] md:min-w-[130px]">
                        <div className="relative">
                          <CustomSelect
                            value={line.unit}
                            onChange={v => updateLine(line.id, 'unit', v)}
                            disabled={!!savedInvoice}
                            options={[
                              { value: 'forfait', label: 'Forfait' },
                              { value: 'heure',   label: 'Heure' },
                              { value: 'jour',    label: 'Jour' },
                              { value: 'mois',    label: 'Mois' },
                              { value: 'unite',   label: 'Unité' },
                              { value: 'kg',      label: 'Kg' },
                              { value: 'litre',   label: 'Litre' },
                              { value: 'metre',   label: 'Mètre' },
                            ]}
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" size={16} />
                        </div>
                      </div>

                      <div className="w-full md:w-[18%] md:min-w-[150px] relative">
                        <Input
                          type="number"
                          className="h-[44px] border-[#E5E7EB] text-right rounded-xl pr-12 focus:border-[#111827] focus:ring-1 focus:ring-[#111827]"
                          value={line.unit_price || ''}
                          onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          disabled={!!savedInvoice}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF] pointer-events-none">FCFA</span>
                      </div>

                      <div className="w-full md:w-[12%] md:min-w-[110px]">
                        <div className="relative">
                          <CustomSelect
                            value={line.tva_rate.toString()}
                            onChange={v => updateLine(line.id, 'tva_rate', parseInt(v))}
                            disabled={!!savedInvoice}
                            options={TVA_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))}
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" size={16} />
                        </div>
                      </div>

                      <div className="w-full md:w-[15%] md:min-w-[150px] text-right shrink-0">
                        <div className="h-[44px] px-3 bg-[#F9FAFB] border border-transparent rounded-xl flex items-center justify-end font-mono font-semibold text-[#0A0A0A] text-[14px]">
                          {((line.quantity || 0) * (line.unit_price || 0)).toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>

                      <div className="w-full md:w-[5%] md:min-w-[50px] flex justify-end">
                        {!savedInvoice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-[#9CA3AF] hover:bg-red-50 hover:text-[#EF4444] rounded-xl"
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>

                      {/* Catalogue Dropdown Shortcut */}
                      {!savedInvoice && products.length > 0 && (
                        <div className="w-full -mt-1 mb-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]">
                                <Plus size={13} className="mr-1.5" />
                                Choisir du catalogue
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64 rounded-xl">
                              <DropdownMenuLabel>Catalogue</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <div className="max-h-56 overflow-y-auto p-1">
                                {products.map(p => (
                                  <DropdownMenuItem key={p.id} onClick={() => updateLine(line.id, '', p)}>
                                    <div className="flex flex-col w-full">
                                      <span className="font-semibold">{p.name}</span>
                                      <span className="text-xs text-gray-500">{p.unit_price.toLocaleString()} FCFA</span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {!savedInvoice && (
                <button
                  className="w-full h-12 mt-4 rounded-xl border border-dashed border-[#D1D5DB] text-[#6B7280] hover:border-[#111827] hover:text-[#111827] transition-all flex items-center justify-center text-sm font-medium"
                  onClick={addLine}
                >
                  <Plus size={16} className="mr-2" /> Ajouter un service ou produit
                </button>
              )}
            </div>

            {/* CARD 3 - Notes & Payment */}
            <div className="bg-[#FFFFFF] rounded-2xl p-8 shadow-sm border border-[#F3F4F6]">
              <div className="space-y-6">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Notes</Label>
                  <textarea
                    placeholder="Ex: Facture payable à réception"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] outline-none transition-all p-4 min-h-[100px] resize-none text-[14px] placeholder:text-[#D1D5DB] disabled:bg-[#F9FAFB] disabled:cursor-not-allowed"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!!savedInvoice}
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Mode de paiement accepté</Label>
                  <div className="relative md:w-[300px]">
                    <CustomSelect
                      size="lg"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      disabled={!!savedInvoice}
                      placeholder="Sélectionner..."
                      options={[
                        { value: 'Wave',             label: 'Wave' },
                        { value: 'Orange Money',     label: 'Orange Money' },
                        { value: 'MTN Mobile Money', label: 'MTN Mobile Money' },
                        { value: 'Moov Money',       label: 'Moov Money' },
                        { value: 'Virement bancaire',label: 'Virement bancaire' },
                        { value: 'Chèque',           label: 'Chèque' },
                        { value: 'Espèces',          label: 'Espèces' },
                      ]}
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" size={16} />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COL - Sticky Recap */}
          <div className="lg:col-span-4 lg:w-[380px] sticky top-6 self-start space-y-6">

            <div className="bg-[#FFFFFF] rounded-2xl p-8 shadow-sm border border-[#F3F4F6]">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-6">RÉCAPITULATIF</h3>

              <div className="space-y-0">
                <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
                  <span className="text-sm text-[#6B7280]">Sous-total HT</span>
                  <span className="text-sm font-mono font-medium text-[#111827]">{(calculateSubtotal() || 0).toLocaleString('fr-FR')} FCFA</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-[#F3F4F6]">
                  <span className="text-sm text-[#6B7280]">TVA</span>
                  <span className="text-sm font-mono font-medium text-[#111827]">{(calculateTVA() || 0).toLocaleString('fr-FR')} FCFA</span>
                </div>

                <div className="flex justify-between items-end pt-4 border-t-2 border-[#0A0A0A] mt-3">
                  <span className="text-[14px] font-bold text-[#0A0A0A]">NET À PAYER</span>
                  <span className="text-xl font-bold font-mono text-[#0A0A0A]">
                    {(calculateTotal() || 0).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>

              {!savedInvoice && (
                <div className="mt-8 space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">STATUT</Label>
                  <CustomSelect
                    size="lg"
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: 'draft', label: 'Brouillon' },
                      { value: 'sent',  label: 'Envoyé' },
                      { value: 'paid',  label: 'Payé' },
                    ]}
                  />
                </div>
              )}

              <div className="mt-8 space-y-3">
                {savedInvoice ? (
                  <>
                    {/* Succès banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span className="text-[13px] font-semibold text-emerald-700">
                        {type === 'invoice' ? 'Facture' : 'Devis'} enregistré !
                      </span>
                    </div>

                    {/* Bouton retour liste */}
                    <Button
                      className="w-full h-12 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white font-semibold text-sm transition-all"
                      onClick={onSaved}
                    >
                      Retour à la liste
                    </Button>

                    {/* PDF Download */}
                    {company && (
                      <PDFDownloadLink
                        document={
                          <InvoicePDF
                            company={company}
                            client={savedInvoice.clients || { name: 'Client' }}
                            invoice={savedInvoice}
                            items={savedInvoice.invoice_items || []}
                            showBrand={!limits.pdfBrand}
                          />
                        }
                        fileName={`${savedInvoice.number}.pdf`}
                      >
                        {({ loading: pdfLoading }) => (
                          <Button
                            variant="outline"
                            className="w-full h-11 border-[#E5E7EB] text-[#374151] rounded-xl font-medium text-sm hover:bg-[#F9FAFB] transition-all"
                            disabled={pdfLoading}
                          >
                            <Download size={16} className="mr-2 text-[#6B7280]" />
                            {pdfLoading ? 'Génération PDF...' : 'Télécharger le PDF'}
                          </Button>
                        )}
                      </PDFDownloadLink>
                    )}

                    {/* WhatsApp */}
                    <Button
                      className="w-full h-11 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-medium text-sm transition-all"
                      onClick={handleWhatsApp}
                    >
                      <MessageCircle size={16} className="mr-2" /> Envoyer par WhatsApp
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full h-12 rounded-xl bg-[#111827] hover:bg-[#1F2937] text-white font-semibold text-sm transition-all"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      <Save size={18} className="mr-2" />
                      {isSaving ? 'Enregistrement...' : (type === 'invoice' ? 'Enregistrer la facture' : 'Enregistrer le devis')}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full h-11 border-[#E5E7EB] text-[#9CA3AF] rounded-xl font-medium text-sm cursor-not-allowed"
                      disabled
                    >
                      <FileText size={16} className="mr-2" /> PDF (après enregistrement)
                    </Button>

                    <Button
                      className={`w-full h-11 rounded-xl font-medium text-sm transition-all ${
                        selectedClientId
                          ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white'
                          : 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed'
                      }`}
                      onClick={handleWhatsApp}
                      disabled={!selectedClientId}
                    >
                      <MessageCircle size={16} className="mr-2" /> Envoyer par WhatsApp
                    </Button>
                  </>
                )}
              </div>

              <div className="text-[10px] text-[#9CA3AF] text-center mt-6 uppercase tracking-wider">
                Conforme au Code Général des Impôts<br/>DGI Côte d'Ivoire
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
