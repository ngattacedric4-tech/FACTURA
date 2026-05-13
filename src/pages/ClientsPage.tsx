import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, UserPlus, Phone, Mail, Building2, User, Users, Pencil, Trash2, Receipt } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/SelectField';
import { CLIENT_TYPE_OPTIONS } from '@/lib/selectOptions';
import { toast } from 'sonner';
import { usePlan } from '@/hooks/usePlan';
import { PLAN_LABEL } from '@/lib/plans';

interface ClientsPageProps { onNavigate: (page: string) => void; }

const emptyForm = { name: '', email: '', phone: '', address: '', tax_id: '', type: 'entreprise' as 'entreprise' | 'particulier' };
const labelCls = 'text-[11px] font-bold text-[#374151] uppercase tracking-wider';

export function ClientsPage({ onNavigate }: ClientsPageProps) {
  const { company } = useAuth();
  const { plan, limits, usage, canCreate, refresh: refreshPlan } = usePlan();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (company) fetchClients(); }, [company]);

  async function fetchClients() {
    if (!company) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setClients(data || []);
    } catch (e: any) {
      toast.error('Erreur chargement : ' + e.message);
    } finally { setLoading(false); }
  }

  function openAdd() {
    if (!canCreate('client')) {
      toast.error(`Limite plan ${PLAN_LABEL[plan]} atteinte (${usage.clientsCount}/${limits.clients} clients). Passez à Pro.`);
      onNavigate('pricing');
      return;
    }
    setForm(emptyForm);
    setIsAdding(true);
  }

  function openEdit(c: Client) {
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', tax_id: c.tax_id || '', type: c.type || 'entreprise' });
    setEditingClient(c);
  }

  function closeAll() { setIsAdding(false); setEditingClient(null); setDeletingClient(null); setForm(emptyForm); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company) { toast.error('Session invalide, rechargez la page.'); return; }
    if (!form.name.trim()) { toast.error('Le nom est requis.'); return; }
    setIsSubmitting(true);
    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            tax_id: form.tax_id.trim() || null,
            type: form.type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingClient.id);
        if (error) throw error;
        toast.success('Client mis à jour !');
      } else {
        const clientNumber = `CLI-${Date.now().toString().slice(-6)}`;
        const { error } = await supabase
          .from('clients')
          .insert({
            company_id: company.id,
            client_number: clientNumber,
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            tax_id: form.tax_id.trim() || null,
            type: form.type,
          });
        if (error) throw error;
        toast.success('Client enregistré !');
      }
      closeAll();
      fetchClients();
      refreshPlan();
    } catch (e: any) {
      toast.error('Erreur : ' + (e.message || 'Inconnue'));
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete() {
    if (!deletingClient) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', deletingClient.id);
      if (error) throw error;
      toast.success('Client supprimé.');
      setClients(prev => prev.filter(c => c.id !== deletingClient.id));
      closeAll();
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    } finally { setIsSubmitting(false); }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} />
          <Input
            placeholder="Rechercher un client..."
            className="pl-9 h-10 rounded-xl border-[#E5E7EB] text-[13px]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openAdd} className="bg-[#111827] text-white rounded-xl h-10 px-5 text-[13px] font-medium hover:bg-[#1F2937]">
          <UserPlus size={15} className="mr-1.5" /> Ajouter un client
        </Button>
      </div>

      {/* ── Dialog Ajout ── */}
      <Dialog open={isAdding} onOpenChange={v => { if (!v) closeAll(); }}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 border-none shadow-2xl">
          {/* JSX inliné ici — pas de sous-composant pour éviter la perte de focus */}
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div>
              <DialogTitle className="text-xl font-bold text-[#0A0A0A]">Nouveau Client</DialogTitle>
              <DialogDescription className="text-[13px] text-[#6B7280] mt-1">
                Enregistrez les coordonnées de votre partenaire d'affaires.
              </DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Nature du client"
                placeholder="Choisir"
                value={form.type}
                onValueChange={v => setForm(f => ({ ...f, type: v as any }))}
                options={CLIENT_TYPE_OPTIONS}
              />
              <div className="space-y-1.5">
                <Label className={labelCls}>Nom / Raison sociale *</Label>
                <Input
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Orange Côte d'Ivoire"
                  className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={labelCls}>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="client@domaine.ci"
                  className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+225 07 00 00 00"
                  className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Adresse de facturation</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Ex: Abidjan, Cocody, Rue des Jardins"
                className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
              />
            </div>

            <AnimatePresence>
              {form.type === 'entreprise' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <Label className={labelCls}>NCC (Compte Contribuable)</Label>
                  <Input
                    value={form.tax_id}
                    onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))}
                    placeholder="Ex: 1234567 A"
                    className="h-11 rounded-xl border-[#E5E7EB] text-[13px] font-mono"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeAll} className="flex-1 rounded-xl h-11 border-[#E5E7EB]">
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-[2] bg-[#111827] text-white rounded-xl h-11 hover:bg-[#1F2937]">
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer le client'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Modification ── */}
      <Dialog open={!!editingClient} onOpenChange={v => { if (!v) closeAll(); }}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 border-none shadow-2xl">
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div>
              <DialogTitle className="text-xl font-bold text-[#0A0A0A]">Modifier le client</DialogTitle>
              <DialogDescription className="text-[13px] text-[#6B7280] mt-1">
                Modifiez les coordonnées de ce partenaire.
              </DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Nature du client"
                placeholder="Choisir"
                value={form.type}
                onValueChange={v => setForm(f => ({ ...f, type: v as any }))}
                options={CLIENT_TYPE_OPTIONS}
              />
              <div className="space-y-1.5">
                <Label className={labelCls}>Nom / Raison sociale *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Orange Côte d'Ivoire"
                  className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={labelCls}>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="client@domaine.ci"
                  className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+225 07 00 00 00"
                  className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Adresse de facturation</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Ex: Abidjan, Cocody, Rue des Jardins"
                className="h-11 rounded-xl border-[#E5E7EB] text-[13px]"
              />
            </div>

            <AnimatePresence>
              {form.type === 'entreprise' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <Label className={labelCls}>NCC (Compte Contribuable)</Label>
                  <Input
                    value={form.tax_id}
                    onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))}
                    placeholder="Ex: 1234567 A"
                    className="h-11 rounded-xl border-[#E5E7EB] text-[13px] font-mono"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeAll} className="flex-1 rounded-xl h-11 border-[#E5E7EB]">
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-[2] bg-[#111827] text-white rounded-xl h-11 hover:bg-[#1F2937]">
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Suppression ── */}
      <Dialog open={!!deletingClient} onOpenChange={v => { if (!v) closeAll(); }}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl p-6 border-none shadow-2xl">
          <DialogTitle className="text-[17px] font-bold text-[#0A0A0A]">Supprimer ce client ?</DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B7280] mt-2">
            Le client <strong>{deletingClient?.name}</strong> sera définitivement supprimé. Cette action est irréversible.
          </DialogDescription>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={closeAll} className="flex-1 rounded-xl h-10 border-[#E5E7EB]">Annuler</Button>
            <Button onClick={handleDelete} disabled={isSubmitting} className="flex-1 bg-red-600 text-white rounded-xl h-10 hover:bg-red-700">
              {isSubmitting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#F3F4F6]">
              {['N° Client', 'Nom / Entreprise', 'Contact', 'Type', 'Actions'].map(h => (
                <TableHead key={h} className="text-[11px] font-bold text-[#374151] uppercase tracking-wider h-11">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3].map(i => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><div className="h-8 bg-[#F9FAFB] rounded animate-pulse my-1" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <Users size={32} className="mx-auto text-[#D1D5DB] mb-3" />
                  <p className="text-[14px] text-[#9CA3AF]">{search ? 'Aucun client trouvé' : "Aucun client pour l'instant"}</p>
                  {!search && (
                    <Button onClick={openAdd} className="mt-4 bg-[#111827] text-white rounded-xl h-9 px-4 text-[13px]">
                      Ajouter mon premier client
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(client => (
                <TableRow key={client.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                  <TableCell className="font-mono text-[12px] text-[#9CA3AF]">{client.client_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${client.type === 'entreprise' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                        {client.type === 'entreprise' ? <Building2 size={14} /> : <User size={14} />}
                      </div>
                      <span className="text-[13px] font-semibold text-[#0A0A0A]">{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {client.email && <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]"><Mail size={11} />{client.email}</div>}
                      {client.phone && <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]"><Phone size={11} />{client.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280] px-2.5 py-1 rounded-full">
                      {client.type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-[#F3F4F6]">
                          <MoreHorizontal size={15} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-48 p-1.5 border-[#E5E7EB] shadow-xl">
                        <DropdownMenuItem onClick={() => openEdit(client)} className="rounded-lg px-3 py-2 text-[13px] cursor-pointer">
                          <Pencil size={14} className="mr-2 text-[#9CA3AF]" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onNavigate('invoices')} className="rounded-lg px-3 py-2 text-[13px] cursor-pointer">
                          <Receipt size={14} className="mr-2 text-[#9CA3AF]" /> Voir les factures
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-[#F3F4F6]" />
                        <DropdownMenuItem
                          onClick={() => setDeletingClient(client)}
                          className="rounded-lg px-3 py-2 text-[13px] cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 size={14} className="mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
