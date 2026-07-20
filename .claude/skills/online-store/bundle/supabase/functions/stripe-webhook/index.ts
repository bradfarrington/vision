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

// Helper to deduct inventory for order items
async function deductInventory(supabase: any, orderId: string) {
    const { data: items } = await supabase
        .from('order_items')
        .select('product_id, variant_id, quantity')
        .eq('order_id', orderId);

    if (!items || items.length === 0) return;

    for (const item of items) {
        if (item.variant_id) {
            // Deduct from variant stock
            const { data: variant } = await supabase
                .from('product_variants')
                .select('stock_quantity')
                .eq('id', item.variant_id)
                .single();

            if (variant) {
                await supabase
                    .from('product_variants')
                    .update({ stock_quantity: Math.max(0, (variant.stock_quantity || 0) - item.quantity) })
                    .eq('id', item.variant_id);
            }
        } else if (item.product_id) {
            // Deduct from product stock
            const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single();

            if (product) {
                await supabase
                    .from('products')
                    .update({ stock_quantity: Math.max(0, (product.stock_quantity || 0) - item.quantity) })
                    .eq('id', item.product_id);
            }
        }
    }
}

// Helper to restore inventory for refunded order items
async function restoreInventory(supabase: any, orderId: string) {
    const { data: items } = await supabase
        .from('order_items')
        .select('product_id, variant_id, quantity')
        .eq('order_id', orderId);

    if (!items || items.length === 0) return;

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

// Helper to trigger email via send-email function
async function triggerEmail(supabase: any, action: string, orderId: string) {
    try {
        await supabase.functions.invoke('send-email', {
            body: { action, orderId },
        });
    } catch (err) {
        console.error(`Failed to trigger ${action} email:`, err);
    }
}

// Helper to trigger SMS via send-sms function
async function triggerSms(supabase: any, action: string, orderId: string) {
    try {
        await supabase.functions.invoke('send-sms', {
            body: { action, orderId },
        });
    } catch (err) {
        console.error(`Failed to trigger ${action} SMS:`, err);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // Webhook secret comes from the customer's store Stripe settings.
        const { data: settings } = await supabase
            .from('stripe_settings')
            .select('stripe_webhook_secret')
            .limit(1)
            .single();

        const webhookSecrets = [settings?.stripe_webhook_secret].filter(Boolean) as string[];

        // Get the raw body for signature verification
        const rawBody = await req.text();
        const sig = req.headers.get('stripe-signature');

        // Verify signature against any known secret
        if (webhookSecrets.length > 0 && sig) {
            const parts = sig.split(',');
            const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
            const v1Signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.split('=')[1]);

            if (!timestamp || v1Signatures.length === 0) {
                return jsonRes({ error: 'Invalid signature format' }, 400);
            }

            // Check timestamp tolerance (5 minutes)
            const tolerance = 300;
            const now = Math.floor(Date.now() / 1000);
            if (Math.abs(now - Number(timestamp)) > tolerance) {
                return jsonRes({ error: 'Webhook timestamp too old' }, 400);
            }

            // Try each secret — accept if any one matches
            const payload = `${timestamp}.${rawBody}`;
            const encoder = new TextEncoder();
            let verified = false;

            for (const secret of webhookSecrets) {
                const key = await crypto.subtle.importKey(
                    'raw',
                    encoder.encode(secret),
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign'],
                );
                const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
                const expectedSig = Array.from(new Uint8Array(signatureBytes))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                if (v1Signatures.includes(expectedSig)) {
                    verified = true;
                    break;
                }
            }

            if (!verified) {
                return jsonRes({ error: 'Invalid webhook signature' }, 400);
            }
        }

        const event = JSON.parse(rawBody);
        const eventType = event.type;

        // Handle checkout.session.completed (Phone Number subscription provisioning).
        // SMS credit purchases moved to GoCardless — see supabase/functions/gocardless-sms-webhook.
        if (eventType === 'checkout.session.completed') {
            const session = event.data.object;

            // Handle Phone Number Subscriptions
            const phoneNumber = session.metadata?.phone_number;
            if (phoneNumber) {
                console.log(`Checkout completed for phone number ${phoneNumber}, starting provision...`);
                // Invoke phone-numbers function to actually acquire the Twilio number
                const { data, error } = await supabase.functions.invoke('phone-numbers', {
                    body: { 
                        action: 'provisionNumber',
                        phoneNumber: session.metadata.phone_number,
                        friendlyName: session.metadata.friendly_name,
                        forwardTo: session.metadata.forward_to,
                        addressSid: session.metadata.address_sid,
                        bundleSid: session.metadata.bundle_sid,
                        subscriptionId: session.subscription,
                        priceId: session.metadata.price_id,
                    }
                });

                if (error || (data && data.error)) {
                    console.error('Failed to provision phone number in webhook:', error || data.error);
                    // Throw error so Stripe retries the webhook if it was a temporary Twilio failure
                    throw new Error(`Failed to provision number ${phoneNumber}: ${error?.message || data?.error}`);
                }
                
                console.log(`Successfully provisioned phone number ${phoneNumber}`);
            }

            return jsonRes({ received: true });
        }

        // Handle payment_intent.succeeded
        if (eventType === 'payment_intent.succeeded') {
            const intent = event.data.object;
            const orderId = intent.metadata?.order_id;

            if (!orderId) {
                console.log('No order_id in metadata, skipping');
                return jsonRes({ received: true });
            }

            // Update order status
            await supabase
                .from('orders')
                .update({
                    status: 'paid',
                    payment_status: 'paid',
                    payment_intent_id: intent.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

            // Deduct inventory
            await deductInventory(supabase, orderId);

            // Check if this order contains a gift card (no product/variant, sku is the code)
            const { data: items } = await supabase
                .from('order_items')
                .select('sku, product_id, variant_id')
                .eq('order_id', orderId);

            let giftCardCode = null;
            if (items) {
                const gcItem = items.find((i: any) => !i.product_id && !i.variant_id && i.sku);
                if (gcItem) {
                    giftCardCode = gcItem.sku;
                }
            }

            if (giftCardCode) {
                const { data: gc } = await supabase
                    .from('gift_cards')
                    .select('id, recipient_email')
                    .eq('code', giftCardCode)
                    .single();

                if (gc && gc.recipient_email) {
                    const { data: order } = await supabase
                        .from('orders')
                        .select('customer_name')
                        .eq('id', orderId)
                        .single();

                    await supabase.functions.invoke('send-email', {
                        body: { 
                            action: 'send_gift_card_notification', 
                            giftCardId: gc.id, 
                            senderName: order?.customer_name || 'Someone' 
                        },
                    }).catch(err => console.error('Webhook gift card notification failed:', err));
                }
            }

            // Send order confirmation + invoice emails
            await triggerEmail(supabase, 'send_order_confirmation', orderId);
            await triggerEmail(supabase, 'send_invoice', orderId);

            // Send SMS
            await triggerSms(supabase, 'order_confirmation', orderId);

            // Notify admin about the new order (non-blocking)
            triggerEmail(supabase, 'send_admin_order_notification', orderId);

            return jsonRes({ received: true });
        }

        // Handle charge.refunded
        if (eventType === 'charge.refunded') {
            const charge = event.data.object;
            const paymentIntentId = charge.payment_intent;

            if (!paymentIntentId) {
                return jsonRes({ received: true });
            }

            // Find the order by payment_intent_id
            const { data: order } = await supabase
                .from('orders')
                .select('id')
                .eq('payment_intent_id', paymentIntentId)
                .single();

            if (!order) {
                console.log('No order found for payment_intent:', paymentIntentId);
                return jsonRes({ received: true });
            }

            // Check if fully refunded
            const isFullRefund = charge.refunded === true;

            if (isFullRefund) {
                await supabase
                    .from('orders')
                    .update({
                        status: 'refunded',
                        payment_status: 'refunded',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', order.id);

                // Restore inventory
                await restoreInventory(supabase, order.id);

                // Send refund confirmation email
                await triggerEmail(supabase, 'send_refund_confirmation', order.id);

                // Send SMS
                await triggerSms(supabase, 'order_refunded', order.id);
            }

            return jsonRes({ received: true });
        }

        // Handle invoice.payment_failed — suspend phone number if subscription payment fails
        if (eventType === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;

            if (subscriptionId) {
                // Check if this subscription belongs to a phone number
                const { data: phoneRecord } = await supabase
                    .from('phone_numbers')
                    .select('id, phone_number, gocardless_subscription_id')
                    .eq('stripe_subscription_id', subscriptionId)
                    .single();

                if (phoneRecord && !phoneRecord.gocardless_subscription_id) {
                    await supabase
                        .from('phone_numbers')
                        .update({ status: 'suspended', updated_at: new Date().toISOString() })
                        .eq('id', phoneRecord.id);

                    console.log(`Phone number ${phoneRecord.phone_number} suspended due to payment failure`);
                }
            }
            return jsonRes({ received: true });
        }

        // Handle invoice.payment_succeeded — reactivate suspended phone numbers
        if (eventType === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;

            if (subscriptionId) {
                const { data: phoneRecord } = await supabase
                    .from('phone_numbers')
                    .select('id, status')
                    .eq('stripe_subscription_id', subscriptionId)
                    .eq('status', 'suspended')
                    .single();

                if (phoneRecord) {
                    await supabase
                        .from('phone_numbers')
                        .update({ status: 'active', updated_at: new Date().toISOString() })
                        .eq('id', phoneRecord.id);

                    console.log(`Phone number reactivated after payment succeeded`);
                }
            }
            return jsonRes({ received: true });
        }

        // Other event types — acknowledge but ignore
        return jsonRes({ received: true });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('stripe-webhook error:', errMsg, err);
        return jsonRes({ error: errMsg || 'Internal server error' }, 500);
    }
});
