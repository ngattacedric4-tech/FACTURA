import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MoreHorizontal, PackagePlus, Layers, Tag, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/SelectField';
import { PRODUCT_UNIT_OPTIONS, TVA_OPTIONS } from '@/lib/selectOptions';
import { toast } from 'sonner';
import { usePlan } from '@/hooks/usePlan';
import { PLAN_LABEL } from '@/lib/plans';

interface ProductsPageProps { onNavigate: (page: string) => void; }
const emptyForm = { name:'', description:'', unit_price:0, unit:'unite', tva_rate:18 };

export function ProductsPage({ onNavigate }: ProductsPageProps) {
  const { company } = useAuth();
  const { plan, limits, usage, canCreate, refresh: refreshPlan } = usePlan();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product|null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product|null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (company) fetchProducts(); }, [company]);

  async function fetchProducts() {
    if (!company) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('*').eq('company_id', company.id).order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch(e:any) { console.error(e.message); }
    finally { setLoading(false); }
  }

  function openAdd() {
    if (!canCreate('product')) {
      toast.error(`Limite plan ${PLAN_LABEL[plan]} atteinte (${usage.productsCount}/${limits.products} produits). Passez à Pro.`);
      onNavigate('pricing');
      return;
    }
    setForm(emptyForm); setIsAdding(true);
  }
  function openEdit(p: Product) { setForm({ name:p.name, description:p.description||'', unit_price:p.unit_price, unit:p.unit, tva_rate:p.tva_rate }); setEditingProduct(p); }
  function closeAll() { setIsAdding(false); setEditingProduct(null); setDeletingProduct(null); setForm(emptyForm); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        const { error } = await supabase.from('products').update({ ...form }).eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Produit mis à jour !');
      } else {
        const { data, error } = await supabase.from('products').insert([{ ...form, company_id: company.id }]).select().single();
        if (error) throw error;
        setProducts(prev => [data, ...prev]);
        toast.success('Produit ajouté au catalogue !');
      }
      closeAll(); fetchProducts(); refreshPlan();
    } catch(e:any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  }

  async function handleDelete() {
    if (!deletingProduct) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', deletingProduct.id);
      if (error) throw error;
      toast.success('Produit supprimé.');
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
      closeAll();
    } catch(e:any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={15} />
          <Input placeholder="Rechercher dans le catalogue..." className="pl-9 h-10 rounded-xl border-[#E5E7EB] text-[13px]" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <Button onClick={openAdd} className="bg-[#111827] text-white rounded-xl h-10 px-5 text-[13px] font-medium hover:bg-[#1F2937]">
          <PackagePlus size={15} className="mr-1.5" /> Ajouter un produit
        </Button>
      </div>

      <Dialog open={isAdding||!!editingProduct} onOpenChange={v=>{ if(!v) closeAll(); }}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-0 border-none shadow-2xl">
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div>
              <DialogTitle className="text-[18px] font-bold text-[#0A0A0A]">{editingProduct ? 'Modifier le produit' : 'Nouveau Produit / Service'}</DialogTitle>
              <DialogDescription className="text-[13px] text-[#6B7280] mt-1">Enregistrez un élément dans votre catalogue de vente.</DialogDescription>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Désignation *</Label>
              <Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex: Prestation de conseil stratégique" className="h-11 rounded-xl border-[#E5E7EB] text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Description (optionnel)</Label>
              <Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Apparaîtra sur la facture..." className="h-11 rounded-xl border-[#E5E7EB] text-[13px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-[#374151] uppercase tracking-wider">Prix unitaire (FCFA) *</Label>
                <Input required type="number" min="0" value={form.unit_price||''} onChange={e=>setForm({...form,unit_price:Number(e.target.value)})} placeholder="0" className="h-11 rounded-xl border-[#E5E7EB] text-[13px] font-mono" />
              </div>
              <SelectField label="Unité de mesure" value={form.unit} onValueChange={v=>setForm({...form,unit:v})} options={PRODUCT_UNIT_OPTIONS} />
            </div>
            <SelectField label="Taux de TVA (%)" value={form.tva_rate.toString()} onValueChange={v=>setForm({...form,tva_rate:Number(v)})} options={TVA_OPTIONS} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeAll} className="flex-1 rounded-xl h-11 border-[#E5E7EB]">Annuler</Button>
              <Button type="submit" disabled={isSubmitting} className="flex-[2] bg-[#111827] text-white rounded-xl h-11 hover:bg-[#1F2937]">
                {isSubmitting ? 'Enregistrement...' : (editingProduct ? 'Enregistrer les modifications' : 'Ajouter au catalogue')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingProduct} onOpenChange={v=>{ if(!v) closeAll(); }}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl p-6 border-none shadow-2xl">
          <DialogTitle className="text-[16px] font-bold text-[#0A0A0A]">Supprimer ce produit ?</DialogTitle>
          <DialogDescription className="text-[13px] text-[#6B7280] mt-2">
            <strong>{deletingProduct?.name}</strong> sera retiré de votre catalogue. Cette action est irréversible.
          </DialogDescription>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={closeAll} className="flex-1 rounded-xl h-10 border-[#E5E7EB]">Annuler</Button>
            <Button onClick={handleDelete} disabled={isSubmitting} className="flex-1 bg-red-600 text-white rounded-xl h-10 hover:bg-red-700">
              {isSubmitting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#F3F4F6]">
              {['Désignation','Description','Prix unitaire','Unité','TVA','Actions'].map(h=>(
                <TableHead key={h} className="text-[11px] font-bold text-[#374151] uppercase tracking-wider h-11">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1,2,3].map(i=>(<TableRow key={i}><TableCell colSpan={6}><div className="h-8 bg-[#F9FAFB] rounded animate-pulse my-1"/></TableCell></TableRow>))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <Tag size={32} className="mx-auto text-[#D1D5DB] mb-3" />
                  <p className="text-[14px] text-[#9CA3AF]">{search ? 'Aucun produit trouvé' : 'Le catalogue est vide'}</p>
                  {!search && <Button onClick={openAdd} className="mt-4 bg-[#111827] text-white rounded-xl h-9 px-4 text-[13px]">Ajouter mon premier produit</Button>}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(product => (
                <TableRow key={product.id} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"><Layers size={14}/></div>
                      <span className="text-[13px] font-semibold text-[#0A0A0A]">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-[#9CA3AF] max-w-[180px] truncate">{product.description||'—'}</TableCell>
                  <TableCell className="text-[13px] font-bold text-[#0A0A0A] font-mono">{product.unit_price.toLocaleString('fr-FR')} FCFA</TableCell>
                  <TableCell><span className="text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] px-2.5 py-1 rounded-full capitalize">{product.unit}</span></TableCell>
                  <TableCell><span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{product.tva_rate}%</span></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-[#F3F4F6]"><MoreHorizontal size={15}/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-44 p-1.5 border-[#E5E7EB] shadow-xl">
                        <DropdownMenuItem onClick={()=>openEdit(product)} className="rounded-lg px-3 py-2 text-[13px] cursor-pointer">
                          <Pencil size={14} className="mr-2 text-[#9CA3AF]"/> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-[#F3F4F6]"/>
                        <DropdownMenuItem onClick={()=>setDeletingProduct(product)} className="rounded-lg px-3 py-2 text-[13px] cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                          <Trash2 size={14} className="mr-2"/> Supprimer
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
