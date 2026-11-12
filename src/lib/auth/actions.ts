'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { emailService } from '@/lib/email';

function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return (
    supabaseUrl.length > 0 &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('dummy') &&
    !supabaseAnonKey.includes('placeholder')
  );
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  // Local Development & Demo Environment Fallback
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    cookieStore.set(
      'bidready_auth_session',
      JSON.stringify({
        email,
        fullName: email.split('@')[0] || 'Demo User',
        organizationId: 'org-1',
        role: 'admin',
        mode: 'development_demo',
      }),
      {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 86400 * 7, // 7 days
      }
    );

    redirect('/dashboard');
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      error: `Authentication failed: Unable to connect to Supabase (${message}). For local preview, placeholder credentials will use demo session mode.`,
    };
  }

  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const companyName = formData.get('companyName') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  // Local Development & Demo Environment Fallback
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    cookieStore.set(
      'bidready_auth_session',
      JSON.stringify({
        email,
        fullName: fullName || email.split('@')[0],
        companyName: companyName || 'Demo Organization',
        organizationId: `org-${Date.now().toString(36)}`,
        role: 'owner',
        mode: 'development_demo',
      }),
      {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 86400 * 7,
      }
    );

    // Non-blocking welcome email delivery
    try {
      await emailService.sendTransactionalEmail({
        to: email,
        eventType: 'welcome',
        idempotencyKey: `welcome:${email.toLowerCase().trim()}`,
        data: {
          fullName,
          organizationName: companyName || 'Demo Organization',
        },
      });
    } catch {
      // Non-blocking fallback
    }

    redirect('/dashboard');
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
          company_name: companyName || '',
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    // Non-blocking welcome email delivery for production Supabase registration
    try {
      await emailService.sendTransactionalEmail({
        to: email,
        eventType: 'welcome',
        idempotencyKey: `welcome:${email.toLowerCase().trim()}`,
        data: {
          fullName,
          organizationName: companyName || 'Your Workspace',
        },
      });
    } catch {
      // Non-blocking fallback
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      error: `Account creation failed: Unable to connect to Supabase (${message}).`,
    };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete('bidready_auth_session');

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on signout
    }
  }

  redirect('/login');
}
