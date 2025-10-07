import { createClient } from 'npm:@supabase/supabase-js@2.39.8';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current user from request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    // Get payload with company ID to check
    const { companyId } = await req.json();
    
    if (!companyId) {
      throw new Error('Missing companyId parameter');
    }

    // Get detailed profile information
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Get company information
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
      
    if (companyError) {
      throw companyError;
    }

    // Get company members
    const { data: members, error: membersError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, company_role')
      .eq('company_id', companyId);
      
    if (membersError) {
      throw membersError;
    }

    // Check if user is a company admin
    const isCompanyAdmin = userProfile.company_id === companyId && userProfile.company_role === 'admin';
    
    // Check what would happen with an update
    let updateTest = null;
    let updateError = null;
    
    if (isCompanyAdmin) {
      try {
        // Test update with minimal change
        const { data: updateResult, error: testError } = await supabaseAdmin
          .from('companies')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', companyId);
          
        if (testError) {
          updateError = testError;
        } else {
          updateTest = { success: true };
        }
      } catch (err) {
        updateError = err;
      }
    }

    // Construct the diagnostic result
    const result = {
      userId: user.id,
      email: userProfile.email,
      isAdmin: userProfile.role === 'admin',
      userProfile: userProfile,
      company: company,
      companyMembers: members,
      isCompanyAdmin: isCompanyAdmin,
      canTheorecticallyUpdateCompany: isCompanyAdmin,
      updateTest: updateTest,
      updateError: updateError,
      timestamp: new Date().toISOString()
    };

    // Return the diagnostic information
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error(`Error in debug-company-permissions:`, error.message);
    
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});