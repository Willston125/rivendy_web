-- Rivendy Web App compatibility migration
-- Safe/idempotent patch for the existing Nikey/Vendy Supabase schema.

-- 1. Advertisements: add web-specific positions while keeping mobile positions.
ALTER TABLE public.advertisements
  DROP CONSTRAINT IF EXISTS advertisements_position_check;

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_position_check
  CHECK (position IN (
    'home_banner',
    'feed_inline',
    'splash',
    'web_home_banner',
    'web_feed_inline',
    'web_category_banner'
  ));

-- Public read for active ads used by web and mobile anon clients.
DROP POLICY IF EXISTS public_read_active_ads ON public.advertisements;
CREATE POLICY public_read_active_ads
  ON public.advertisements
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 2. Products: dashboard already uses rejected, web publishes pending.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN (
    'active',
    'boosted',
    'sold',
    'validated',
    'pending',
    'epuise',
    'rejected'
  ));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN (
    'femme',
    'homme',
    'bebeEnfants',
    'electronique',
    'maison',
    'beauteParfums',
    'artisanatLocal',
    'materiauxConstruction',
    'alimentation',
    'restaurant',
    'location',
    'mariage',
    'personnels'
  ));

-- 3. Orders: align Flutter + admin dashboard lifecycle.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'shipped',
    'delivered',
    'pending_whatsapp',
    'confirmed_by_customer_service',
    'assigned_to_delivery',
    'picked_up',
    'en_route',
    'delivered_by_rider',
    'completed',
    'cancelled'
  ));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_image_url TEXT;

-- 4. Seller payout requests from app/web users should not require admin_users.requested_by.
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS requested_by UUID;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'FDJ';

ALTER TABLE public.payout_requests
  ALTER COLUMN requested_by DROP NOT NULL;

ALTER TABLE public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_status_check;

ALTER TABLE public.payout_requests
  ADD CONSTRAINT payout_requests_status_check
  CHECK (status IN (
    'pending_director',
    'approved_director',
    'pending_ceo',
    'approved_ceo',
    'pending',
    'approved_regional',
    'paid',
    'rejected'
  ));

-- If the modern payout workflow is installed, keep seller inserts possible.
DROP POLICY IF EXISTS seller_insert_own_payout ON public.payout_requests;
DROP POLICY IF EXISTS seller_insert_own_payouts ON public.payout_requests;

CREATE POLICY seller_insert_own_payouts
  ON public.payout_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());
