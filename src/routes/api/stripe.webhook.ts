import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
}

function calcularFim(tipo: string | undefined): string | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (tipo) {
    case "mensal":
      return new Date(now + 30 * day).toISOString();
    case "trimestral":
      return new Date(now + 90 * day).toISOString();
    case "anual":
    case "diamante":
      return new Date(now + 365 * day).toISOString();
    default:
      return null;
  }
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripe = getStripe();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          return new Response("STRIPE_WEBHOOK_SECRET ausente", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Assinatura ausente", { status: 400 });

        const body = await request.text();
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "erro desconhecido";
          console.error("Webhook signature inválida:", msg);
          return new Response(`Webhook Error: ${msg}`, { status: 400 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const meta = session.metadata || {};
            const userId = meta.user_id;
            if (!userId) {
              console.warn("checkout.session.completed sem user_id em metadata");
              return new Response("ok");
            }

            if (session.mode === "subscription") {
              const planoId = meta.plano_id || null;
              const planoTipo = meta.plano_tipo;
              await supabaseAdmin.from("assinaturas").insert({
                user_id: userId,
                plano_id: planoId,
                stripe_subscription_id:
                  typeof session.subscription === "string" ? session.subscription : null,
                stripe_customer_id:
                  typeof session.customer === "string" ? session.customer : null,
                status: "ativa",
                fim: calcularFim(planoTipo),
              });
              // trigger sync_profile_plano_atual atualiza profiles automaticamente
            } else if (session.mode === "payment" && meta.cronograma_id) {
              await supabaseAdmin.from("cronograma_compras").insert({
                user_id: userId,
                cronograma_id: meta.cronograma_id,
                stripe_payment_intent_id:
                  typeof session.payment_intent === "string" ? session.payment_intent : null,
                status: "ativo",
              });
            }
          } else if (event.type === "customer.subscription.deleted") {
            const sub = event.data.object as Stripe.Subscription;
            await supabaseAdmin
              .from("assinaturas")
              .update({ status: "cancelada", fim: new Date().toISOString() })
              .eq("stripe_subscription_id", sub.id);
          } else if (event.type === "customer.subscription.updated") {
            const sub = event.data.object as Stripe.Subscription;
            const status =
              sub.status === "active" || sub.status === "trialing"
                ? "ativa"
                : sub.status === "canceled"
                  ? "cancelada"
                  : sub.status === "past_due" || sub.status === "unpaid"
                    ? "expirada"
                    : null;
            if (status) {
              await supabaseAdmin
                .from("assinaturas")
                .update({
                  status,
                  fim: sub.current_period_end
                    ? new Date(sub.current_period_end * 1000).toISOString()
                    : null,
                })
                .eq("stripe_subscription_id", sub.id);
            }
          }
        } catch (err) {
          console.error("Erro processando webhook:", err);
          return new Response("Erro interno", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
