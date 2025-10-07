import { supabase } from './supabase';

/**
 * Diagnose company permissions issues for a specific company
 * @param companyId The ID of the company to diagnose
 * @returns Diagnostic information about the company and permissions
 */
export async function diagnoseCompanyPermissions(companyId: string) {
  try {
    // Try to fetch companies using basic query first
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(5);
      
    if (companiesError) {
      console.error('Basic companies query failed:', companiesError);
    }
    
    // Try the new RPC function
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('get_all_companies_with_members');
    
    if (rpcError) {
      console.error('RPC function failed:', rpcError);
    }
    
    // Get current user info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    return {
      user_info: user ? {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'unknown'
      } : null,
      basic_companies_query: {
        success: !companiesError,
        error: companiesError?.message,
        count: companies?.length || 0,
        data: companies
      },
      rpc_function_query: {
        success: !rpcError,
        error: rpcError?.message,
        data: rpcResult
      },
      companies_table_accessible: !companiesError,
      rpc_function_accessible: !rpcError
    };
  } catch (error) {
    console.error('Error diagnosing company permissions:', error);
    throw error;
  }
}

/**
 * Fix company admin role for the current user
 * @param companyId The ID of the company
 * @returns Result of the fix operation
 */
export async function fixCompanyAdminRole(companyId: string) {
  try {
    // First attempt to update via profiles table
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) throw userError;
    
    const { error } = await supabase
      .from('profiles')
      .update({ company_role: 'admin' })
      .eq('id', userData.user.id)
      .eq('company_id', companyId);
      
    if (error) throw error;
    
    // Refresh session to get updated role
    await supabase.auth.refreshSession();
    
    return {
      success: true,
      message: 'Company admin role has been fixed',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fixing company admin role:', error);
    throw error;
  }
}