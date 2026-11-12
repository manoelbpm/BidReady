'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight, Lock, Mail, User, Building, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signUp } from '@/lib/auth/actions';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await signUp(formData);

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
            Create BidReady Workspace
          </h1>
          <p className="text-sm text-slate-400">
            Set up isolated tender analysis for your organization
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-base text-white">Organization Registration</CardTitle>
              <CardDescription className="text-slate-400">
                14-day free trial. No credit card required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Your Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    name="fullName"
                    type="text"
                    required
                    placeholder="Sarah Jenkins"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Company / Organization</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    name="companyName"
                    type="text"
                    required
                    placeholder="Global Defense Systems Corp"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="sarah@company.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
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
                    <span>Creating Tenant...</span>
                  </>
                ) : (
                  <>
                    <span>Create Organization & Start</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <div className="text-center text-xs text-slate-400">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-400 font-semibold hover:underline">
                  Sign In
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
