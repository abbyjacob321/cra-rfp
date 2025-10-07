import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  Globe, 
  MapPin, 
  Phone, 
  Briefcase,
  FileText,
  Save,
  Users,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle,
  Library,
  BugPlay
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Company {
  id: string;
  name: string;
  website: string | null;
  address: string | null;
  phone: string | null;
  industry: string | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  state_of_incorporation: string | null;
}

interface CompanyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_role: string;
  created_at: string;
}

interface CompanyInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export const CompanySettings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // New company form state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyDescription, setNewCompanyDescription] = useState('');
  const [newCompanyStateOfIncorporation, setNewCompanyStateOfIncorporation] = useState('');
  
  // Auto-join settings
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(false);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  
  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    fetchCompanyData();
  }, [user]);

  const fetchCompanyData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is associated with a company
      if (user.company_id) {
        // Fetch company details
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', user.company_id)
          .single();
          
        if (companyError) throw companyError;
        setCompany(companyData);
        
        // Set auto-join settings
        setAutoJoinEnabled(companyData.auto_join_enabled || false);
        setBlockedDomains(companyData.blocked_domains || []);
        
        // Fetch company members
        const { data: membersData, error: membersError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, company_role, created_at')
          .eq('company_id', user.company_id);
          
        if (membersError) throw membersError;
        setCompanyMembers(membersData || []);
        
        // Fetch pending invitations if user is company admin
        if (user.company_role === 'admin') {
          const { data: invitationsData, error: invitationsError } = await supabase
            .from('company_invitations')
            .select('*')
            .eq('company_id', user.company_id)
            .eq('status', 'pending');
            
          if (invitationsError) throw invitationsError;
          setInvitations(invitationsData || []);
        }
      }
    } catch (error: any) {
      console.error('Error fetching company data:', error);
      setError(error.message || 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateAutoJoinSettings = async () => {
    if (!company) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      const { data, error } = await supabase.rpc('update_company_autojoin_settings', {
        p_company_id: company.id,
        p_auto_join_enabled: autoJoinEnabled,
        p_blocked_domains: blockedDomains
      });
      
      if (error) throw error;
      
      setSuccess('Auto-join settings updated successfully');
      
    } catch (error: any) {
      console.error('Error updating auto-join settings:', error);
      setError(error.message || 'Failed to update auto-join settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddBlockedDomain = () => {
    if (newBlockedDomain.trim() && !blockedDomains.includes(newBlockedDomain.trim())) {
      setBlockedDomains([...blockedDomains, newBlockedDomain.trim()]);
      setNewBlockedDomain('');
    }
  };
  
  const handleRemoveBlockedDomain = (domain: string) => {
    setBlockedDomains(blockedDomains.filter(d => d !== domain));
  };
  
  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      setError('Company name is required');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Call the enhanced create_company function
      const { data, error } = await supabase.rpc('create_company_with_autojoin', {
        p_name: newCompanyName.trim(),
        p_website: newCompanyWebsite.trim() || null,
        p_address: newCompanyAddress.trim() || null,
        p_phone: newCompanyPhone.trim() || null,
        p_industry: newCompanyIndustry.trim() || null,
        p_description: newCompanyDescription.trim() || null,
        p_state_of_incorporation: newCompanyStateOfIncorporation.trim() || null,
        p_auto_join_enabled: true, // Default enabled
        p_blocked_domains: []
      });
      
      if (error) throw error;
      
      const autoJoinMessage = data.auto_join_enabled 
        ? ` Auto-join is enabled for @${data.verified_domain} domain.`
        : '';
      setSuccess(`Company created successfully! You are now the company admin.${autoJoinMessage}`);
      
      // Track company creation in analytics
      await supabase.from('analytics_events').insert({
        event_type: 'company_created',
        user_id: user?.id,
        metadata: {
          company_name: newCompanyName,
          auto_join_enabled: true
        }
      });
      
      // Refresh user session to get updated role
      await supabase.auth.refreshSession();
      
      // Refetch company data
      setTimeout(() => {
        fetchCompanyData();
      }, 1000);
      
    } catch (error: any) {
      console.error('Error creating company:', error);
      setError(error.message || 'Failed to create company');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleUpdateCompany = async () => {
    if (!company) return;
    
    try {
      setIsSaving(true);
      setError(null);
      setDebugInfo(null);
      
      // Get additional information about permissions for debugging
      const { data: permissionCheck, error: permCheckError } = await supabase.rpc('debug_company_management');
      
      if (permCheckError) {
        console.warn('Could not retrieve permission debug info:', permCheckError);
      } else {
        setDebugInfo(permissionCheck);
      }
      
      console.log('Updating company with data:', company);
      
      const updateData = {
        name: company.name,
        website: company.website,
        address: company.address,
        phone: company.phone,
        industry: company.industry,
        description: company.description,
        state_of_incorporation: company.state_of_incorporation,
        updated_at: new Date().toISOString()
      };
      
      console.log('Update payload:', updateData);
      
      // First, check if we have admin role
      if (user?.company_role !== 'admin') {
        throw new Error('Only company administrators can update company information');
      }
      
      // Try to update the company
      const { data, error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id);
        
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      
      setSuccess('Company information updated successfully');
      
      // Add the update result to debug info
      setDebugInfo(prevInfo => ({
        ...prevInfo,
        updateResult: {
          success: true,
          data
        }
      }));
      
    } catch (error: any) {
      console.error('Error updating company:', error);
      setError(error.message || 'Failed to update company information');
      
      // Add the error to debug info
      setDebugInfo(prevInfo => ({
        ...prevInfo,
        updateError: {
          message: error.message,
          details: error.details || error.hint || null,
          code: error.code || null
        }
      }));
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !company) {
      setError('Email address is required');
      return;
    }
    
    try {
      setIsInviting(true);
      setError(null);
      
      // Call the invite_to_company function
      const { data, error } = await supabase.rpc('invite_to_company', {
        p_company_id: company.id,
        p_email: inviteEmail.trim(),
        p_role: inviteRole
      });
      
      if (error) throw error;
      
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      
      // Refresh invitations
      fetchCompanyData();
      
    } catch (error: any) {
      console.error('Error inviting user:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };
  
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('company_invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);
        
      if (error) throw error;
      
      setSuccess('Invitation cancelled');
      
      // Refresh invitations
      fetchCompanyData();
      
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      setError(error.message || 'Failed to cancel invitation');
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Function to check and fix admin permissions
  const checkCompanyRole = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Check if user is associated with this company
      if (!user?.company_id || user.company_id !== company?.id) {
        throw new Error('You are not associated with this company');
      }
      
      // Try to manually update the company role
      const { data, error } = await supabase
        .from('profiles')
        .update({ company_role: 'admin' })
        .eq('id', user.id)
        .select('company_role');
        
      if (error) throw error;
      
      // Refresh user session
      await supabase.auth.refreshSession();
      
      setSuccess('Your company role has been verified. You now have admin privileges.');
      
      // Fetch updated data
      fetchCompanyData();
      
    } catch (error: any) {
      console.error('Error checking company role:', error);
      setError(error.message || 'Failed to check company role');
    } finally {
      setIsSaving(false);
    }
  };
  
  // User is part of a company
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading company information...</p>
        </div>
      </div>
    );
  }
  
  // Display success or error messages
  const StatusMessage = () => {
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start mb-6">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      );
    }
    
    if (success) {
      return (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start mb-6">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      );
    }
    
    return null;
  };
  
  // User needs to create a company
  if (!company) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Create Your Company</h2>
        
        <StatusMessage />
        
        <div className="space-y-4">
          <Input
            label="Company Name"
            required
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            leftIcon={<Building2 className="h-5 w-5 text-gray-400" />}
          />
          
          <Input
            label="Website"
            type="url"
            value={newCompanyWebsite}
            onChange={(e) => setNewCompanyWebsite(e.target.value)}
            leftIcon={<Globe className="h-5 w-5 text-gray-400" />}
          />
          
          <Input
            label="Address"
            value={newCompanyAddress}
            onChange={(e) => setNewCompanyAddress(e.target.value)}
            leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
          />
          
          <Input
            label="Phone"
            type="tel"
            value={newCompanyPhone}
            onChange={(e) => setNewCompanyPhone(e.target.value)}
            leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
          />
          
          <Input
            label="State of Incorporation"
            value={newCompanyStateOfIncorporation}
            onChange={(e) => setNewCompanyStateOfIncorporation(e.target.value)}
            leftIcon={<Library className="h-5 w-5 text-gray-400" />}
          />
          
          <Input
            label="Industry"
            value={newCompanyIndustry}
            onChange={(e) => setNewCompanyIndustry(e.target.value)}
            leftIcon={<Briefcase className="h-5 w-5 text-gray-400" />}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Description
            </label>
            <textarea
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              rows={3}
              value={newCompanyDescription}
              onChange={(e) => setNewCompanyDescription(e.target.value)}
              placeholder="Brief description of your company"
            />
          </div>
          
          <div className="pt-4">
            <Button
              onClick={handleCreateCompany}
              disabled={isSaving || !newCompanyName.trim()}
              isLoading={isSaving}
              leftIcon={<Building2 className="h-4 w-4" />}
            >
              Create Company
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // User is part of a company
  return (
    <div className="space-y-8">
      <StatusMessage />
      
      {/* Company Information */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Company Information</h2>
          
          {/* Debug Toggle Button */}
          {user?.role === 'admin' && (
            <Button 
              variant="outline" 
              size="sm" 
              leftIcon={<BugPlay className="h-4 w-4" />}
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? 'Hide Debug' : 'Debug Info'}
            </Button>
          )}
        </div>
        
        <div className="p-6">
          {/* Debug Info Display */}
          {showDebug && debugInfo && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-medium mb-2 flex items-center text-gray-700">
                <BugPlay className="h-4 w-4 mr-2" />
                Debug Information
              </h3>
              <div className="text-xs overflow-auto max-h-60">
                <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded-md">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
              {user?.company_role !== 'admin' && (
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={checkCompanyRole}
                    disabled={isSaving}
                  >
                    Fix Company Role
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {user?.company_role === 'admin' ? (
            <div className="space-y-4">
              <Input
                label="Company Name"
                value={company.name}
                onChange={(e) => setCompany({...company, name: e.target.value})}
                required
                leftIcon={<Building2 className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label="Website"
                type="url"
                value={company.website || ''}
                onChange={(e) => setCompany({...company, website: e.target.value})}
                leftIcon={<Globe className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label="Address"
                value={company.address || ''}
                onChange={(e) => setCompany({...company, address: e.target.value})}
                leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label="Phone"
                type="tel"
                value={company.phone || ''}
                onChange={(e) => setCompany({...company, phone: e.target.value})}
                leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label="State of Incorporation"
                value={company.state_of_incorporation || ''}
                onChange={(e) => setCompany({...company, state_of_incorporation: e.target.value})}
                leftIcon={<Library className="h-5 w-5 text-gray-400" />}
              />
              
              <Input
                label="Industry"
                value={company.industry || ''}
                onChange={(e) => setCompany({...company, industry: e.target.value})}
                leftIcon={<Briefcase className="h-5 w-5 text-gray-400" />}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Description
                </label>
                <textarea
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  rows={3}
                  value={company.description || ''}
                  onChange={(e) => setCompany({...company, description: e.target.value})}
                />
              </div>
              
              {/* Auto-Join Settings for Company Admins */}
              {user?.company_role === 'admin' && (company.verified_domain || company.email_domain) && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Auto-Join Settings</h3>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Auto-Join Domain: @{company.verified_domain || company.email_domain}</p>
                        <p>When enabled, anyone with this email domain can automatically join your company as a member.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="auto-join-enabled"
                        checked={autoJoinEnabled}
                        onChange={(e) => setAutoJoinEnabled(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="auto-join-enabled" className="ml-2 block text-sm text-gray-900">
                        Enable auto-join for @{company.verified_domain || company.email_domain}
                      </label>
                    </div>
                    
                    {autoJoinEnabled && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          ✅ Auto-join enabled: New users with @{company.verified_domain || company.email_domain} will automatically become members
                        </p>
                      </div>
                    )}
                    
                    {!autoJoinEnabled && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700">
                          🔒 Auto-join disabled: All join requests will require manual approval
                        </p>
                      </div>
                    )}
                    
                    {/* Blocked Domains Management */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Blocked Domains (Optional)
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Block specific domains from auto-joining (e.g., contractors, temporary workers)
                      </p>
                      
                      {blockedDomains.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {blockedDomains.map(domain => (
                            <span key={domain} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              @{domain}
                              <button
                                onClick={() => handleRemoveBlockedDomain(domain)}
                                className="ml-1.5 text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="contractor.com"
                          value={newBlockedDomain}
                          onChange={(e) => setNewBlockedDomain(e.target.value)}
                          className="flex-grow text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddBlockedDomain}
                          disabled={!newBlockedDomain.trim()}
                        >
                          Block Domain
                        </Button>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <Button
                        onClick={handleUpdateAutoJoinSettings}
                        disabled={isSaving}
                        isLoading={isSaving}
                        leftIcon={<Save className="h-4 w-4" />}
                      >
                        Save Auto-Join Settings
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex gap-3">
                <Button
                  onClick={handleUpdateCompany}
                  disabled={isSaving}
                  isLoading={isSaving}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Save Changes
                </Button>
                
                {user?.role === 'admin' && (
                  <Button
                    onClick={checkCompanyRole}
                    disabled={isSaving}
                    variant="outline"
                  >
                    Verify Admin Access
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Company Name</label>
                <p className="mt-1 text-lg font-medium flex items-center">
                  <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                  {company.name}
                </p>
              </div>
              
              {company.website && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Website</label>
                  <p className="mt-1 text-sm flex items-center">
                    <Globe className="h-5 w-5 text-gray-400 mr-2" />
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      {company.website}
                    </a>
                  </p>
                </div>
              )}
              
              {company.address && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Address</label>
                  <p className="mt-1 text-sm flex items-center">
                    <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                    {company.address}
                  </p>
                </div>
              )}
              
              {company.phone && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Phone</label>
                  <p className="mt-1 text-sm flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-2" />
                    {company.phone}
                  </p>
                </div>
              )}
              
              {company.state_of_incorporation && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">State of Incorporation</label>
                  <p className="mt-1 text-sm flex items-center">
                    <Library className="h-5 w-5 text-gray-400 mr-2" />
                    {company.state_of_incorporation}
                  </p>
                </div>
              )}
              
              {company.industry && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Industry</label>
                  <p className="mt-1 text-sm flex items-center">
                    <Briefcase className="h-5 w-5 text-gray-400 mr-2" />
                    {company.industry}
                  </p>
                </div>
              )}
              
              {company.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-sm">
                    {company.description}
                  </p>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-blue-700">
                  You are a member of this company. Contact your company administrator to update company information.
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={checkCompanyRole}
                    disabled={isSaving}
                  >
                    {isSaving ? "Checking..." : "Verify Company Role"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Company Members */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Company Members</h2>
          <div className="text-sm text-gray-500">
            {companyMembers.length} {companyMembers.length === 1 ? 'member' : 'members'}
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {companyMembers.map(member => (
            <div key={member.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                  {member.first_name.charAt(0)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {member.company_role === 'admin' ? 'Administrator' : 'Member'}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Invite Members (Admin Only) */}
      {user?.company_role === 'admin' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Invite Team Members</h2>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                placeholder="colleague@example.com"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Administrators can manage company information, invite members, and sign NDAs on behalf of the company.
                </p>
              </div>
              
              <div className="pt-4">
                <Button
                  onClick={handleInviteMember}
                  disabled={isInviting || !inviteEmail.trim()}
                  isLoading={isInviting}
                  leftIcon={<Users className="h-4 w-4" />}
                >
                  Send Invitation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Pending Invitations (Admin Only) */}
      {user?.company_role === 'admin' && invitations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Pending Invitations</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {invitations.filter(inv => inv.status === 'pending').map(invitation => (
              <div key={invitation.id} className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{invitation.email}</p>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-gray-500">
                      Invited on {formatDate(invitation.created_at)}
                    </span>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className="text-xs text-gray-500">
                      Expires on {formatDate(invitation.expires_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {invitation.role === 'admin' ? 'Administrator' : 'Member'}
                  </span>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelInvitation(invitation.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};