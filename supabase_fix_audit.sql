-- Fix : audit_trigger doit bypasser RLS pour insérer dans audit_logs
-- (sinon authenticated user n'a pas d'INSERT policy)

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp_id UUID;
  inv_id  UUID;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    inv_id := COALESCE(
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.invoice_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.invoice_id END
    );
    SELECT i.company_id INTO comp_id FROM public.invoices i WHERE i.id = inv_id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      comp_id := OLD.company_id;
    ELSE
      comp_id := NEW.company_id;
    END IF;
  END IF;

  IF comp_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = comp_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (
    comp_id, auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

-- Webhook trigger : résout company_id différemment selon table
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evt TEXT;
  payload JSONB;
  comp_id UUID;
  inv_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    comp_id := COALESCE(NEW.company_id, OLD.company_id);
    IF TG_OP = 'INSERT' THEN
      evt := CASE NEW.type WHEN 'estimate' THEN 'estimate.created' ELSE 'invoice.created' END;
      payload := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
      evt := CASE NEW.status
        WHEN 'paid' THEN 'invoice.paid'
        WHEN 'sent' THEN 'invoice.sent'
        WHEN 'overdue' THEN 'invoice.overdue'
        WHEN 'accepted' THEN 'estimate.accepted'
        ELSE NULL
      END;
      IF evt IS NULL THEN RETURN NEW; END IF;
      payload := to_jsonb(NEW);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'INSERT' THEN
    inv_id := NEW.invoice_id;
    SELECT i.company_id INTO comp_id FROM public.invoices i WHERE i.id = inv_id;
    evt := 'payment.received';
    payload := to_jsonb(NEW);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF comp_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  INSERT INTO public.webhook_queue (webhook_id, event, payload)
  SELECT w.id, evt, payload
  FROM public.webhooks w
  WHERE w.company_id = comp_id AND w.active = true AND evt = ANY(w.events);

  RETURN COALESCE(NEW, OLD);
END $$;

-- Idem pour recompute_invoice_status (fait UPDATE sur invoices via auth user)
CREATE OR REPLACE FUNCTION public.recompute_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_id UUID;
  total NUMERIC;
  paid NUMERIC;
  cur_status TEXT;
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT total_ttc, status INTO total, cur_status FROM public.invoices WHERE id = inv_id;
  IF cur_status IN ('draft','canceled') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO paid FROM public.payments WHERE invoice_id = inv_id;
  IF paid >= total THEN
    UPDATE public.invoices SET status = 'paid', updated_at = now() WHERE id = inv_id;
  ELSIF paid > 0 THEN
    UPDATE public.invoices SET status = 'partial', updated_at = now() WHERE id = inv_id;
  ELSE
    UPDATE public.invoices SET status = 'sent', updated_at = now() WHERE id = inv_id AND status IN ('paid','partial');
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
