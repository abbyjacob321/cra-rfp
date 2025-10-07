import { createClient } from 'npm:@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  company: string;
  role: 'admin' | 'client_reviewer' | 'bidder';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !requestingUser) {
      throw new Error('Unauthorized');
    }

    // Verify user is admin through profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requestingUser.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Unauthorized - Admin access required');
    }

    // Get request payload
    const payload: CreateUserPayload = await req.json();

    // Create the auth user
    const { data: { user }, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role
      },
      app_metadata: {
        role: payload.role
      }
    });

    if (createUserError || !user) {
      throw createUserError || new Error('Failed to create user');
    }

    // Create the profile record
    const { data: profile, error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
        company: payload.company,
        role: payload.role
      })
      .select()
      .single();

    if (createProfileError) {
      // Cleanup: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      throw createProfileError;
    }

    return new Response(JSON.stringify(profile), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof Error && error.message.includes('already registered') ? 409 : 400,
    });
  }
});