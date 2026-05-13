import { PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { InvoicePDF } from './InvoicePDF';
import type { Company } from '@/types/database';

interface Props {
  company: Company;
  invoice: any;
}

export default function PdfDownloadButton({ company, invoice }: Props) {
  const items = invoice.invoice_items?.length
    ? invoice.invoice_items
    : [{
        description: 'Service',
        quantity: 1,
        unit_price: (invoice.total_ttc || 0) / 1.18,
        tva_rate: 18,
        amount_ht: (invoice.total_ttc || 0) / 1.18,
      }];

  return (
    <PDFDownloadLink
      document={
        <InvoicePDF
          company={company}
          client={invoice.clients || { name: 'Client' }}
          invoice={invoice}
          items={items}
        />
      }
      fileName={`${invoice.number}.pdf`}
    >
      {({ loading: pdfLoading }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full group-hover:bg-primary/5 group-hover:text-primary transition-colors"
          disabled={pdfLoading}
          aria-label="Télécharger PDF"
        >
          <FileDown size={18} />
        </Button>
      )}
    </PDFDownloadLink>
  );
}
