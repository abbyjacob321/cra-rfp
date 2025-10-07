import { createClient } from 'npm:@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables for Supabase connection');
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get request payload
    const { action, token, email } = await req.json();
    
    if (!action) {
      throw new Error('Action is required');
    }
    
    let result;
    
    if (action === 'process_invitation') {
      if (!token) throw new Error('Token is required');
      
      // Check if token is valid
      const { data: invitation, error: invitationError } = await supabaseAdmin
        .from('company_invitations')
        .select(`
          *,
          companies:company_id (
            id,
            name,
            website,
            industry
          ),
          inviter:inviter_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq('token', token)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (invitationError || !invitation) {
        throw new Error('Invalid or expired invitation token');
      }
      
      // Get user by email
      const { data: userByEmail, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', invitation.email)
        .single();
      
      if (userError && userError.code !== 'PGRST116') { // PGRST116 is not found
        throw userError;
      }
      
      result = {
        valid: true,
        invitation: {
          ...invitation,
          user_exists: !!userByEmail,
        }
      };
    }
    else if (action === 'accept_invitation') {
      if (!token) throw new Error('Token is required');
      
      // Verify authenticated user (from auth header)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing Authorization header');
      }
      
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (userError || !user) {
        throw new Error('Unauthorized or invalid token');
      }
      
      // Call accept_company_invitation function
      const { data: acceptResult, error: acceptError } = await supabaseAdmin.rpc(
        'accept_company_invitation',
        { p_token: token }
      );
      
      if (acceptError) {
        throw acceptError;
      }
      
      result = {
        success: true,
        ...acceptResult,
      };
    }
    else if (action === 'create_invitation') {
      if (!email) throw new Error('Email is required');
      
      // Verify authenticated user (from auth header)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing Authorization header');
      }
      
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (userError || !user) {
        throw new Error('Unauthorized or invalid token');
      }
      
      // Get user's company and check if they are an admin
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('company_id, company_role')
        .eq('id', user.id)
        .single();
        
      if (profileError) {
        throw profileError;
      }
      
      if (!profile.company_id || profile.company_role !== 'admin') {
        throw new Error('Only company administrators can create invitations');
      }
      
      // Create invitation
      const { data, error } = await supabaseAdmin.rpc('invite_to_company', {
        p_company_id: profile.company_id,
        p_email: email,
        p_role: 'member',
      });
      
      if (error) {
        throw error;
      }
      
      // In production, send email notification here
      
      result = {
        success: true,
        invitation: data,
      };
    }
    else {
      throw new Error(`Unknown action: ${action}`);
    }
    
    // Return the result
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    console.error(`Error: ${error.message}`);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    );
  }
});