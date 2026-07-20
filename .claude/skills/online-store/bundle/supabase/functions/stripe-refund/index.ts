// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonRes(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { orderId } = body;

        if (!orderId) return jsonRes({ error: 'orderId is required' }, 400);

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // Read Stripe secret key
        const { data: settings, error: settingsErr } = await supabase
            .from('stripe_settings')
            .select('stripe_secret_key')
            .limit(1)
            .single();

        if (settingsErr || !settings?.stripe_secret_key) {
            return jsonRes({ error: 'Stripe is not configured. Go to Settings → Payments.' }, 400);
        }

        const stripeKey = settings.stripe_secret_key;

        // Fetch the order
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderErr || !order) return jsonRes({ error: 'Order not found' }, 400);

        if (!order.payment_intent_id) {
            return jsonRes({ error: 'No payment intent associated with this order. Cannot refund.' }, 400);
        }

        if (order.payment_status === 'refunded') {
            return jsonRes({ error: 'Order is already refunded' }, 400);
        }

        // Create a Stripe refund
        const stripeRes = await fetch('https://api.stripe.com/v1/refunds', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                payment_intent: order.payment_intent_id,
            }),
        });

        const refund = await stripeRes.json();

        if (refund.error) {
            return jsonRes({ error: refund.error.message || 'Failed to create refund' }, 500);
        }

        // Update order status
        await supabase
            .from('orders')
            .update({
                status: 'refunded',
                payment_status: 'refunded',
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        // Restore inventory
        const { data: items } = await supabase
            .from('order_items')
            .select('product_id, variant_id, quantity')
            .eq('order_id', orderId);

        if (items && items.length > 0) {
            for (const item of items) {
                if (item.variant_id) {
                    const { data: variant } = await supabase
                        .from('product_variants')
                        .select('stock_quantity')
                        .eq('id', item.variant_id)
                        .single();

                    if (variant) {
                        await supabase
                            .from('product_variants')
                            .update({ stock_quantity: (variant.stock_quantity || 0) + item.quantity })
                            .eq('id', item.variant_id);
                    }
                } else if (item.product_id) {
                    const { data: product } = await supabase
                        .from('products')
                        .select('stock_quantity')
                        .eq('id', item.product_id)
                        .single();

                    if (product) {
                        await supabase
                            .from('products')
                            .update({ stock_quantity: (product.stock_quantity || 0) + item.quantity })
                            .eq('id', item.product_id);
                    }
                }
            }
        }

        // Trigger refund confirmation email
        try {
            await supabase.functions.invoke('send-email', {
                body: { action: 'send_refund_confirmation', orderId },
            });
        } catch (emailErr) {
            console.error('Failed to send refund email:', emailErr);
        }

        return jsonRes({ ok: true, refundId: refund.id });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('stripe-refund error:', errMsg, err);
        return jsonRes({ error: errMsg || 'Internal server error' }, 500);
    }
});
