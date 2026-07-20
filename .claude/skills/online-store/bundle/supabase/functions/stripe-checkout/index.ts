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

        // Read Stripe secret key from stripe_settings
        const { data: settings, error: settingsErr } = await supabase
            .from('stripe_settings')
            .select('*')
            .limit(1)
            .single();

        if (settingsErr || !settings || !settings.stripe_secret_key) {
            return jsonRes({ error: 'Stripe is not configured. Go to Settings → Payments to set up your Stripe keys.' }, 400);
        }

        const stripeKey = settings.stripe_secret_key;

        // Fetch the order
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderErr || !order) return jsonRes({ error: 'Order not found' }, 400);

        if (order.payment_status === 'paid') {
            return jsonRes({ error: 'Order is already paid' }, 400);
        }

        // Create a Stripe PaymentIntent (using fetch to the Stripe API)
        const amountInPence = Math.round(Number(order.total) * 100);

        const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                amount: String(amountInPence),
                currency: 'gbp',
                'metadata[order_id]': orderId,
                'metadata[order_number]': String(order.order_number || ''),
                'automatic_payment_methods[enabled]': 'true',
            }),
        });

        const intent = await stripeRes.json();

        if (intent.error) {
            return jsonRes({ error: intent.error.message || 'Failed to create payment intent' }, 500);
        }

        // Save the payment_intent_id on the order
        await supabase
            .from('orders')
            .update({ payment_intent_id: intent.id })
            .eq('id', orderId);

        return jsonRes({ clientSecret: intent.client_secret });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('stripe-checkout error:', errMsg, err);
        return jsonRes({ error: errMsg || 'Internal server error' }, 500);
    }
});
