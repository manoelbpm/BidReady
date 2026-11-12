'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { Check, ShieldAlert, Sparkles, CreditCard, ArrowRight, Loader2, HelpCircle, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAAS_PLANS, PlanId } from '@/types/billing';

function PricingContent() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams?.get('orgId') || 'e2e00000-0000-4000-a000-000000000001';

  const [currentPlan, setCurrentPlan] = useState<PlanId>('free');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [paddleReady, setPaddleReady] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSub() {
      try {
        const res = await fetch(`/api/billing/subscription?orgId=${targetOrgId}`);
        const data = await res.json();
        if (data.success && data.subscription) {
          setCurrentPlan(data.subscription.planId);
        }
      } catch (e) {
        console.error('Error fetching subscription', e);
      }
    }
    fetchSub();

    if (typeof window !== 'undefined' && (window as any).Paddle && !paddleReady) {
      handlePaddleInit();
    }
  }, [targetOrgId, paddleReady]);

  const handlePaddleInit = () => {
    if (typeof window !== 'undefined' && (window as any).Paddle) {
      try {
        (window as any).Paddle.Environment.set('sandbox');
        const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
        if (clientToken && clientToken.trim() !== '') {
          (window as any).Paddle.Initialize({
            token: clientToken,
            eventCallback: (data: any) => {
              console.log('[Paddle.js Sandbox Event]', data);
              if (data.name === 'checkout.completed') {
                const checkoutData = data.data;
                const txnId = checkoutData?.transaction_id || checkoutData?.id;
                console.log('✓ Checkout Completed in Paddle Sandbox! Transaction ID:', txnId);
                setCheckoutSessionId(txnId || 'completed');
              }
            },
          });
          setPaddleReady(true);
        }
      } catch (err) {
        console.warn('Paddle.js Sandbox initialization notice:', err);
      }
    }
  };

  const getPriceId = (pId: PlanId): string => {
    if (pId === 'starter') {
      return process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER || 'pri_01m73t7nhv4rwj634cwpaw3hec';
    }
    if (pId === 'pro') {
      return process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO || 'pri_01m73t7pae2d7wkta71swvzv09';
    }
    if (pId === 'business') {
      return process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS || 'pri_01m73t7pr06wahgkdh9ce7w2d9';
    }
    return '';
  };

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlan) return;
    setLoadingPlan(planId);

    // Free plan bypasses payment gateway
    if (planId === 'free') {
      try {
        const res = await fetch('/api/billing/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'change_plan',
            organizationId: targetOrgId,
            planId: 'free',
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCurrentPlan('free');
        }
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    // Commercial Plan Checkout via Paddle.js v2 (Sandbox)
    try {
      // 1. Authorize checkout with server first (validates user auth, membership, and server-controlled metadata)
      const authRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          organizationId: targetOrgId,
        }),
      });

      const authData = await authRes.json();
      if (!authRes.ok || !authData.success) {
        console.error('Checkout authorization failed:', authData.error);
        alert(authData.error || 'Checkout authorization failed');
        return;
      }

      const { priceId, customData, userEmail } = authData.authorizedCheckout;

      if (typeof window !== 'undefined' && (window as any).Paddle && paddleReady) {
        (window as any).Paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customData,
          customer: {
            email: userEmail,
          },
          settings: {
            displayMode: 'overlay',
            theme: 'light',
          },
        });
        return;
      }
    } catch (err) {
      console.warn('Checkout error:', err);
    } finally {
      setLoadingPlan(null);
    }

    // Safe development simulation fallback when NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not yet supplied
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_plan',
          organizationId: targetOrgId,
          planId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentPlan(planId);
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  const plansList = Object.values(SAAS_PLANS);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      {/* Official Paddle.js v2 CDN Loader for Sandbox Checkout */}
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={handlePaddleInit}
      />

      {/* Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30">
          Transparent SaaS Monetization
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Flexible Plans for Tender Intelligence
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Scale your RFP analysis capacity with predictable monthly allowances. Quotas are enforced strictly server-side, and failed analyses are never counted against your allowance.
        </p>
      </div>

      {checkoutSessionId && (
        <div data-testid="checkout-success-banner" className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center justify-between">
          <span>Checkout concluído no Paddle Sandbox! ID da Transação: {checkoutSessionId}</span>
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40">Sandbox Verified</Badge>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plansList.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isRecommended = plan.recommended;

          return (
            <Card
              key={plan.id}
              data-testid={`card-plan-${plan.id}`}
              className={`flex flex-col relative transition-all duration-200 ${
                isRecommended
                  ? 'border-blue-500 shadow-md shadow-blue-500/5 ring-1 ring-blue-500'
                  : 'hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] tracking-wide uppercase px-2.5 py-0.5">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="space-y-1 pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    {plan.name}
                  </CardTitle>
                  {isCurrent && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 text-[10px]">
                      Current
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-slate-500 min-h-[32px] line-clamp-2">
                  {plan.description}
                </CardDescription>

                <div className="pt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    ${plan.monthlyPriceUsd}
                  </span>
                  <span className="text-xs text-slate-500">/month</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 text-center">
                  {plan.monthlyAnalysesLimit} document analyses included
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
                  Features Included:
                </div>
                {plan.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-tight">{feat}</span>
                  </div>
                ))}
              </CardContent>

              <CardFooter className="pt-2">
                <Button
                  data-testid={`select-plan-${plan.id}`}
                  className="w-full text-xs"
                  variant={isCurrent ? 'outline' : isRecommended ? 'primary' : 'secondary'}
                  disabled={isCurrent || loadingPlan === plan.id}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Updating...
                    </>
                  ) : isCurrent ? (
                    'Active Plan'
                  ) : (
                    <>
                      <span>Switch to {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Commercial Disclaimers & FAQ */}
      <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs text-slate-600 dark:text-slate-400">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-500" />
          Subscription & Fair Billing Principles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 leading-relaxed">
          <div>
            <strong className="text-slate-800 dark:text-slate-200">How are document analyses counted?</strong>
            <p className="mt-0.5">
              An analysis count is deducted only when the complete pipeline finishes and extracts valid requirements. Upload errors, corrupted files, or cancelled jobs are never charged.
            </p>
          </div>
          <div>
            <strong className="text-slate-800 dark:text-slate-200">What happens if our quota is reached?</strong>
            <p className="mt-0.5">
              Document uploads are paused with a clear server notice. You can upgrade your tier instantly with pro-rata calculation, or wait for the monthly cycle rollover.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Pricing...</div>}>
      <PricingContent />
    </Suspense>
  );
}
