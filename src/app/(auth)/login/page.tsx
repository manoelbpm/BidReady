'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth/actions';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);

    if (result?.error) {
      setErrorMessage(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            BidReady Sign In
          </h1>
          <p className="text-sm text-slate-400">
            Access your secure tender intelligence and compliance workspace
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-base text-white">Sign In to Your Workspace</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your verified credentials to proceed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="analyst@company.com"
                    defaultValue="demo@bidready.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <a href="#" className="text-[11px] text-blue-400 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    name="password"
                    type="password"
                    required
                    defaultValue="SuperSecret2026!"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <div className="text-center text-xs text-slate-400">
                Don&apos;t have an account yet?{' '}
                <Link href="/signup" className="text-blue-400 font-semibold hover:underline">
                  Create Workspace
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Demo Fast-Pass / Dev Link */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Direct Preview Dashboard (Dev Local Mode) &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
