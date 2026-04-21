import { createServerFn, createMiddleware } from "@tanstack/react-start";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as browserSupabase } from "@/integrations/supabase/client";

const attachAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await browserSupabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  return new Stripe(key);
}

function getSiteUrl(fallbackOrigin?: string) {
  return process.env.SITE_URL || fallbackOrigin || "https://www.leicompany.com.br";
}

/** Inicia checkout de assinatura (mensal/trimestral/anual/diamante) */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { planoId: string; origin?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const stripe = getStripe();
    const siteUrl = getSiteUrl(data.origin);

    const { data: plano, error } = await supabase
      .from("planos")
      .select("id, nome, tipo, preco_centavos, stripe_price_id")
      .eq("id", data.planoId)
      .eq("ativo", true)
      .maybeSingle();

    if (error || !plano) throw new Error("Plano não encontrado");
    if (!plano.preco_centavos || plano.preco_centavos <= 0)
      throw new Error("Plano sem preço configurado");

    // Define recorrência por tipo
    const recurring: Record<string, { interval: "day" | "week" | "month" | "year"; interval_count?: number }> = {
      mensal: { interval: "month" },
      trimestral: { interval: "month", interval_count: 3 },
      anual: { interval: "year" },
      diamante: { interval: "year" },
    };
    const rec = recurring[plano.tipo];
    if (!rec) throw new Error(`Tipo de plano não suporta assinatura: ${plano.tipo}`);

    const lineItem = plano.stripe_price_id
      ? { price: plano.stripe_price_id, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: plano.preco_centavos,
            product_data: { name: plano.nome },
            recurring: rec,
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: (claims.email as string) || undefined,
      line_items: [lineItem],
      success_url: `${siteUrl}/meu-plano?sucesso=true`,
      cancel_url: `${siteUrl}/meu-plano?cancelado=true`,
      metadata: { user_id: userId, plano_id: plano.id, plano_tipo: plano.tipo },
      locale: "pt-BR",
    });

    return { url: session.url };
  });

/** Inicia checkout de compra avulsa de cronograma */
export const createCheckoutAvulso = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: { cronogramaId: string; origin?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const stripe = getStripe();
    const siteUrl = getSiteUrl(data.origin);

    const { data: cron, error } = await supabase
      .from("cronogramas")
      .select("id, nome, premium, preco_centavos, stripe_price_id")
      .eq("id", data.cronogramaId)
      .maybeSingle();

    if (error || !cron) throw new Error("Cronograma não encontrado");
    if (!cron.premium) throw new Error("Cronograma não é premium");
    if (!cron.preco_centavos || cron.preco_centavos <= 0)
      throw new Error("Cronograma sem preço configurado");

    const lineItem = cron.stripe_price_id
      ? { price: cron.stripe_price_id, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: cron.preco_centavos,
            product_data: { name: `Cronograma: ${cron.nome}` },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: (claims.email as string) || undefined,
      line_items: [lineItem],
      success_url: `${siteUrl}/cronogramas?compra=true`,
      cancel_url: `${siteUrl}/meu-plano?cancelado=true`,
      metadata: { user_id: userId, cronograma_id: cron.id },
      locale: "pt-BR",
    });

    return { url: session.url };
  });
