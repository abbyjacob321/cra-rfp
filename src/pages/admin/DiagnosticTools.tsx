import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  UserCog,
  Database,
  Eye,
  RefreshCw,
  Users,
  Shield,
  Key,
  Building,
  Download,
  Wrench,
  Mail
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmailDiagnosticTool } from '../../components/admin/EmailDiagnosticTool';

// This component won't be linked in the main navigation
// You can access it directly via /admin/diagnostic-tools
export const DiagnosticTools: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userCounts, setUserCounts] = useState<{role: string, count: number}[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('admin');
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const runDiagnostic = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the debug function
      const { data, error: fnError } = await supabase
        .rpc('debug_admin_status');
        
      if (fnError) throw fnError;
      
      setResult(data);
      
      // Also fetch users directly from the profiles table
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (usersError) {
        console.warn('Error fetching users directly:', usersError);
      } else {
        setUsers(usersData || []);
      }
      
      // Get user counts by role
      const { data: countData, error: countError } = await supabase
        .rpc('count_users_by_role');
        
      if (countError) {
        console.warn('Error getting user counts:', countError);
      } else {
        setUserCounts(countData || []);
      }
      
    } catch (error: any) {
      console.error('Diagnostic error:', error);
      setError(error.message || 'Failed to run diagnostic');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);
      setError(null);
      
      // Call the function to list all companies - use explicit foreign key reference
      const { data, error } = await supabase
        .from('companies')
        .select('*, profiles!profiles_company_id_fkey(count)');
        
      if (error) throw error;
      
      console.log('Fetched companies:', data);
      setCompanies(data || []);
      
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      setError('Failed to fetch companies: ' + error.message);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fixAdminAccess = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // Call the fix function
      const { data, error: fnError } = await supabase
        .rpc('fix_admin_access');
        
      if (fnError) throw fnError;
      
      // Success - show the result
      setResult({
        ...result,
        fix_result: data
      });
      
      // Refresh the diagnostic
      await runDiagnostic();
      
    } catch (error: any) {
      console.error('Fix error:', error);
      setError(error.message || 'Failed to fix admin access');
    } finally {
      setRefreshing(false);
    }
  };

  const listAllUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the admin-only function to bypass RLS
      const { data, error: fnError } = await supabase
        .rpc('list_all_users_for_admin');
        
      if (fnError) throw fnError;
      
      // Success - show all users
      setUsers(data || []);
      
    } catch (error: any) {
      console.error('List users error:', error);
      setError(error.message || 'Failed to list all users');
    } finally {
      setLoading(false);
    }
  };

  const fixCompanyRoles = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // Export the current state of profiles for backup
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
        
      if (profilesError) throw profilesError;
      
      // Export companies data for backup
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*');
        
      if (companiesError) throw companiesError;
      
      // Create a diagnostic log
      const diagnosticData = {
        timestamp: new Date().toISOString(),
        profiles: profilesData,
        companies: companiesData,
        userCounts: userCounts
      };
      
      // Create a downloadable backup
      const backupData = JSON.stringify(diagnosticData, null, 2);
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a link to download the backup
      const link = document.createElement('a');
      link.href = url;
      link.download = `company-roles-backup-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Diagnostic data exported successfully. You can now use this backup for troubleshooting.');
      
    } catch (error: any) {
      console.error('Company roles diagnostic error:', error);
      setError('Failed to run company roles diagnostic: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const fixCompanyPermissions = async (companyId: string) => {
    try {
      setRefreshing(true);
      setError(null);
      
      // Get company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
        
      if (companyError) throw companyError;
      
      // Get company members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId);
        
      if (membersError) throw membersError;
      
      // Find admins
      const admins = membersData.filter(m => m.company_role === 'admin');
      
      // If no admins, promote the first member
      if (admins.length === 0 && membersData.length > 0) {
        const firstMember = membersData[0];
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ company_role: 'admin' })
          .eq('id', firstMember.id);
          
        if (updateError) throw updateError;
        
        setSuccess(`Fixed company permissions. Promoted ${firstMember.first_name} ${firstMember.last_name} to admin.`);
      } else {
        setSuccess(`Company "${companyData.name}" has ${admins.length} administrators. No fix needed.`);
      }
      
      // Refresh the companies list
      await fetchCompanies();
      
    } catch (error: any) {
      console.error('Fix company permissions error:', error);
      setError('Failed to fix company permissions: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
    
    if (activeTab === 'companies') {
      fetchCompanies();
    }
  }, [activeTab]);
  
  const [success, setSuccess] = useState<string | null>(null);

  if (!user || user.role !== 'admin') {
    return (
      <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-medium text-red-800">Access Denied</h2>
            <p className="text-sm text-red-600 mt-1">
              This diagnostic tool is only available to administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <UserCog className="h-7 w-7 mr-2 text-blue-600" />
          Admin Diagnostic Tools
        </h1>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={runDiagnostic}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Shield className="h-4 w-4" />}
            onClick={fixAdminAccess}
            disabled={refreshing}
          >
            Fix Admin Access
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={listAllUsers}
            disabled={loading}
          >
            List All Users
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admin'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Status
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'companies'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('companies')}
          >
            Companies
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('email')}
          >
            Email System
          </button>
        </nav>
      </div>
      
      {activeTab === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Admin Status */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Key className="h-5 w-5 text-blue-500 mr-2" />
              Admin Status
            </h2>
            
            {result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-600">Admin by JWT:</span>
                  <span className={`flex items-center ${result.is_admin_by_jwt ? 'text-green-600' : 'text-red-600'}`}>
                    {result.is_admin_by_jwt ? (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Yes</>
                    ) : (
                      <><AlertCircle className="h-4 w-4 mr-1" /> No</>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-600">Admin by Profile:</span>
                  <span className={`flex items-center ${result.is_admin_by_profile ? 'text-green-600' : 'text-red-600'}`}>
                    {result.is_admin_by_profile ? (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Yes</>
                    ) : (
                      <><AlertCircle className="h-4 w-4 mr-1" /> No</>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-600">Can See Other Profiles:</span>
                  <span className={`flex items-center ${result.can_see_other_profiles ? 'text-green-600' : 'text-red-600'}`}>
                    {result.can_see_other_profiles ? (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Yes</>
                    ) : (
                      <><AlertCircle className="h-4 w-4 mr-1" /> No</>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Profiles Count:</span>
                  <span className="text-blue-600 font-medium">{result.profiles_count}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Visible Profiles Count:</span>
                  <span className="text-blue-600 font-medium">{result.visible_profiles_count}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* User Counts by Role */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Database className="h-5 w-5 text-blue-500 mr-2" />
              User Counts by Role
            </h2>
            
            {userCounts.length > 0 ? (
              <div className="space-y-4">
                {userCounts.map(roleCount => (
                  <div key={roleCount.role} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-600 capitalize">{roleCount.role}s:</span>
                    <span className="text-blue-600 font-medium">{roleCount.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No user count data available</p>
            )}
          </div>
          
          {/* Raw Diagnostic Data */}
          {result && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden md:col-span-2">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="text-sm font-medium text-gray-900 flex items-center">
                  <Eye className="h-4 w-4 text-gray-500 mr-2" />
                  Raw Diagnostic Data
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                    alert('Copied to clipboard');
                  }}
                >
                  Copy
                </Button>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'users' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Users className="h-5 w-5 text-blue-500 mr-2" />
              All Users ({users.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              This shows all users in the database regardless of RLS policies
            </p>
          </div>
          
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : user.role === 'client_reviewer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.company || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.company_role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : user.company_role
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.company_role || 'None'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No users found or visible</p>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'companies' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <Building className="h-5 w-5 text-blue-500 mr-2" />
                  Companies
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Manage and diagnose company records
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={fetchCompanies}
                  disabled={loadingCompanies}
                >
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={fixCompanyRoles}
                  disabled={refreshing}
                >
                  Export Diagnostic
                </Button>
              </div>
            </div>
          </div>
          
          {loadingCompanies ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-600">Loading company data...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No companies found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Industry
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map(company => (
                    <tr key={company.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{company.website || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{company.industry || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {company.profiles?.count || 0} members
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(company.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          leftIcon={<Wrench className="h-4 w-4" />}
                          onClick={() => fixCompanyPermissions(company.id)}
                        >
                          Fix Permissions
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'email' && (
        <EmailDiagnosticTool />
      )}
      
      {result?.fix_result && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Fix Applied</h3>
              <p className="text-sm text-green-700 mt-1">
                Admin access has been fixed. Please refresh the page to see the changes.
              </p>
              <pre className="text-xs bg-green-100 p-2 rounded mt-2 max-h-32 overflow-y-auto">
                {JSON.stringify(result.fix_result, null, 2)}
              </pre>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Wrench className="h-4 w-4" />}
                onClick={async () => {
                  try {
                    const diagnostic = await import('../../lib/companyHelpers').then(m => 
                      m.diagnoseCompanyPermissions('test')
                    );
                    console.log('Company diagnostic result:', diagnostic);
                    alert('Check browser console for diagnostic results');
                  } catch (error) {
                    console.error('Diagnostic failed:', error);
                    alert('Diagnostic failed - check console');
                  }
                }}
              >
                Test Company Access
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};