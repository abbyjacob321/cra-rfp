import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Company, CompanyInvitation, CompanyMember } from '../../types';
import { CompanyVerificationWorkflow } from '../../components/admin/CompanyVerificationWorkflow';
import { AdminUserAssignment } from '../../components/admin/AdminUserAssignment';
import { Building, Plus, Search, Filter, Users, Globe, Phone, MapPin, MoreHorizontal, CreditCard as Edit, Trash2, ArrowUpDown, Calendar, Mail, CheckCircle, Clock, Loader2, AlertCircle, Library, RefreshCw, UserPlus, ExternalLink, X, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { format } from 'date-fns';

interface CompanyWithMemberCount extends Company {
  member_count?: number;
}

export const CompanyManagementPage: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyState, setNewCompanyState] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Company detail state
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithMemberCount | null>(null);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [companyInvitations, setCompanyInvitations] = useState<CompanyInvitation[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Invite member form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  
  // Edit company state
  const [isEditing, setIsEditing] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyWebsite, setEditCompanyWebsite] = useState('');
  const [editCompanyIndustry, setEditCompanyIndustry] = useState('');
  const [editCompanyAddress, setEditCompanyAddress] = useState('');
  const [editCompanyPhone, setEditCompanyPhone] = useState('');
  const [editCompanyState, setEditCompanyState] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'companies' | 'assignments' | 'verification'>('companies');

  // Fetch all companies with member counts
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Fetching companies with member counts...");
      
      // First try basic query to see if companies table is accessible
      const { data: basicData, error: basicError } = await supabase
        .from('companies')
        .select('*')
        .limit(10);
      
      if (basicError) {
        console.error('Basic companies query failed:', basicError);
        throw new Error(`Cannot access companies table: ${basicError.message}`);
      }
      
      console.log("Basic companies query successful:", basicData?.length, "companies");
      
      // Try the RPC function
      const { data, error } = await supabase.rpc('get_all_companies_with_members');
      
      if (error) {
        console.error('RPC function failed:', error);
        console.log('Falling back to basic query with manual member count...');
        
        // Fallback: manually calculate member counts
        const companiesWithCounts = await Promise.all(
          basicData.map(async (company) => {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact' })
              .eq('company_id', company.id);
            
            return {
              ...company,
              member_count: count || 0,
              primary_member_count: count || 0,
              secondary_member_count: 0
            };
          })
        );
        
        setCompanies(companiesWithCounts);
        return;
      }
      
      console.log("RPC companies data received:", data);
      
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      setError(`Failed to load companies: ${error.message}. Please check the browser console for details.`);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch company details including members and invitations
  const fetchCompanyDetails = async (companyId: string) => {
    try {
      setLoadingDetails(true);
      
      console.log("Fetching details for company ID:", companyId);
      
      // Fetch company details with explicit foreign key reference
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          *,
          members:profiles!profiles_company_id_fkey(count)
        `)
        .eq('id', companyId)
        .single();
      
      if (companyError) throw companyError;
      
      console.log("Company data received:", companyData);
      
      const companyWithCount = {
        ...companyData,
        member_count: companyData.members?.count || 0
      };
      
      // Fetch company members with explicit query
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_role, created_at')
        .eq('company_id', companyId);
      
      if (membersError) throw membersError;
      
      console.log(`Found ${membersData?.length || 0} members for company:`, membersData);
      
      // Fetch company invitations - ONLY for this specific company
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('company_invitations')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending');
      
      if (invitationsError) throw invitationsError;
      
      console.log(`Found ${invitationsData?.length || 0} pending invitations for company:`, invitationsData);
      
      // Update state
      setSelectedCompany(companyWithCount);
      setCompanyMembers(membersData || []);
      setCompanyInvitations(invitationsData || []);
      
      // Set edit form values
      setEditCompanyName(companyWithCount.name);
      setEditCompanyWebsite(companyWithCount.website || '');
      setEditCompanyIndustry(companyWithCount.industry || '');
      setEditCompanyAddress(companyWithCount.address || '');
      setEditCompanyPhone(companyWithCount.phone || '');
      setEditCompanyState(companyWithCount.state_of_incorporation || '');
      
    } catch (error: any) {
      console.error('Error fetching company details:', error);
      setError(error.message || 'Failed to load company details');
    } finally {
      setLoadingDetails(false);
    }
  };
  
  useEffect(() => {
    fetchCompanies();
  }, []);
  
  // Sort and filter companies
  const filteredAndSortedCompanies = companies
    .filter(company => {
      const matchesSearch = !searchTerm || 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.industry && company.industry.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesIndustry = !industryFilter || company.industry === industryFilter;
      
      return matchesSearch && matchesIndustry;
    })
    .sort((a, b) => {
      // Special case for member_count which is a number
      if (sortField === 'member_count') {
        const countA = a.member_count || 0;
        const countB = b.member_count || 0;
        return sortDirection === 'asc' ? countA - countB : countB - countA;
      }
      
      // For other string fields
      const fieldA = String(a[sortField as keyof Company] || '');
      const fieldB = String(b[sortField as keyof Company] || '');
      
      return sortDirection === 'asc' 
        ? fieldA.localeCompare(fieldB) 
        : fieldB.localeCompare(fieldA);
    });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  // Handle company creation
  const handleCreateCompany = async () => {
    if (!newCompanyName) {
      setError('Company name is required');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw new Error(`Authentication error: ${userError.message}`);
      }
      
      if (!user) {
        throw new Error('You must be logged in to create a company');
      }

      console.log("Creating company with user ID:", user.id);

      // Create the company with created_by field set to the current user's ID
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName,
          website: newCompanyWebsite || null,
          industry: newCompanyIndustry || null,
          address: newCompanyAddress || null,
          phone: newCompanyPhone || null,
          state_of_incorporation: newCompanyState || null,
          created_by: user.id  // Set created_by to satisfy RLS policy
        })
        .select();
      
      if (error) {
        console.error('Error creating company:', error);
        throw error;
      }
      
      console.log("Company created successfully:", data);
      
      // Add member count to the new company for UI
      const newCompaniesWithCount = data.map(company => ({
        ...company,
        member_count: 0 // New company has no members yet
      }));
      
      // Update the companies list
      setCompanies([...newCompaniesWithCount, ...companies]);
      
      // Reset the form
      setNewCompanyName('');
      setNewCompanyWebsite('');
      setNewCompanyIndustry('');
      setNewCompanyAddress('');
      setNewCompanyPhone('');
      setNewCompanyState('');
      setShowCreateForm(false);
      
    } catch (error: any) {
      console.error('Error creating company:', error);
      setError(error.message || 'Failed to create company');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle company deletion
  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingId(companyId);
      
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);
      
      if (error) throw error;
      
      // Update companies list
      setCompanies(companies.filter(company => company.id !== companyId));
      
      // Clear selection if deleted
      if (selectedCompany?.id === companyId) {
        setSelectedCompany(null);
      }
      
    } catch (error: any) {
      console.error('Error deleting company:', error);
      setError(error.message || 'Failed to delete company');
    } finally {
      setDeletingId(null);
    }
  };
  
  // Handle company update
  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    
    if (!editCompanyName) {
      setError('Company name is required');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      const { error } = await supabase
        .from('companies')
        .update({
          name: editCompanyName,
          website: editCompanyWebsite || null,
          industry: editCompanyIndustry || null,
          address: editCompanyAddress || null,
          phone: editCompanyPhone || null,
          state_of_incorporation: editCompanyState || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCompany.id);
      
      if (error) throw error;
      
      // Update local state
      const updatedCompany = {
        ...selectedCompany,
        name: editCompanyName,
        website: editCompanyWebsite || null,
        industry: editCompanyIndustry || null,
        address: editCompanyAddress || null,
        phone: editCompanyPhone || null,
        state_of_incorporation: editCompanyState || null,
        updated_at: new Date().toISOString()
      };
      
      setSelectedCompany(updatedCompany);
      
      // Update in companies list
      setCompanies(companies.map(company => 
        company.id === selectedCompany.id ? updatedCompany : company
      ));
      
      // Exit edit mode
      setIsEditing(false);
      
    } catch (error: any) {
      console.error('Error updating company:', error);
      setError(error.message || 'Failed to update company');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle sort change
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle company selection
  const handleViewCompany = (company: CompanyWithMemberCount) => {
    setSelectedCompany(company);
    fetchCompanyDetails(company.id);
    setIsEditing(false); // Reset edit mode when selecting a company
  };
  
  // Handle edit button click
  const handleEditClick = () => {
    if (!selectedCompany) return;
    
    setEditCompanyName(selectedCompany.name);
    setEditCompanyWebsite(selectedCompany.website || '');
    setEditCompanyIndustry(selectedCompany.industry || '');
    setEditCompanyAddress(selectedCompany.address || '');
    setEditCompanyPhone(selectedCompany.phone || '');
    setEditCompanyState(selectedCompany.state_of_incorporation || '');
    setIsEditing(true);
  };
  
  // Handle sending an invitation
  const handleInviteMember = async () => {
    if (!selectedCompany || !inviteEmail.trim()) {
      setError('Please enter an email address');
      return;
    }
    
    try {
      setIsInviting(true);
      setError(null);
      setInviteSuccess(null);
      
      console.log("Inviting to company:", selectedCompany.id, inviteEmail, inviteRole);
      
      const { data, error } = await supabase.rpc('invite_to_company', {
        p_company_id: selectedCompany.id,
        p_email: inviteEmail.trim(),
        p_role: inviteRole
      });
      
      if (error) throw error;
      
      console.log("Invitation result:", data);
      
      // Success message
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      
      // Reset form
      setInviteEmail('');
      
      // Refresh company details
      await fetchCompanyDetails(selectedCompany.id);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setInviteSuccess(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error inviting member:', error);
      setError(error.message || 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };
  
  // Handle resending an invitation
  const handleResendInvitation = async (invitationId: string) => {
    try {
      setError(null);
      
      // In a real implementation, you would call an API to resend the invitation
      // This is just a placeholder for demonstration
      alert(`Invitation would be resent. ID: ${invitationId}`);
      
      // Refresh invitations
      if (selectedCompany) {
        fetchCompanyDetails(selectedCompany.id);
      }
      
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      setError(error.message || 'Failed to resend invitation');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage companies and their members
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button 
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowCreateForm(true)}
          >
            Add Company
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('assignments')}
          >
            User Assignments
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'verification'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('verification')}
          >
            Verification
          </button>
        </nav>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {/* Success message */}
      {inviteSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{inviteSuccess}</p>
        </div>
      )}
      
      {/* Tab Content */}
      {activeTab === 'companies' && (
        <>
      {/* Create Company Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Create New Company</h2>
            <button 
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <input
                type="text"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={newCompanyIndustry}
                onChange={(e) => setNewCompanyIndustry(e.target.value)}
                placeholder="e.g., Energy, Technology, Construction"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <div className="flex items-center">
                <Globe className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="url"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={newCompanyWebsite}
                  onChange={(e) => setNewCompanyWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="tel"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  placeholder="123 Main St, City, State, ZIP"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State of Incorporation
              </label>
              <div className="flex items-center">
                <Library className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={newCompanyState}
                  onChange={(e) => setNewCompanyState(e.target.value)}
                  placeholder="e.g., Delaware, California"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowCreateForm(false)}
              className="mr-3"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompany}
              disabled={!newCompanyName.trim() || isCreating}
              isLoading={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Company'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Search and filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search companies..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              leftIcon={<Filter className="h-4 w-4" />}
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : ''}
            >
              Filters
            </Button>
            <Button 
              variant="outline" 
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchCompanies}
            >
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={industryFilter || ''}
                  onChange={(e) => setIndustryFilter(e.target.value || null)}
                >
                  <option value="">All Industries</option>
                  <option value="Energy">Energy</option>
                  <option value="Technology">Technology</option>
                  <option value="Construction">Construction</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Utilities">Utilities</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Companies table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
              <p className="text-gray-600">Loading companies...</p>
            </div>
          </div>
        ) : filteredAndSortedCompanies.length === 0 ? (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No companies found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || industryFilter
                ? "No companies match your search criteria."
                : "Get started by creating your first company."}
            </p>
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreateForm(true)}
            >
              Create Company
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      <span>Company Name</span>
                      {sortField === 'name' && (
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('industry')}
                  >
                    <div className="flex items-center">
                      <span>Industry</span>
                      {sortField === 'industry' && (
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('member_count')}
                  >
                    <div className="flex items-center">
                      <span>Members</span>
                      {sortField === 'member_count' && (
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auto-Join
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center">
                      <span>Created</span>
                      {sortField === 'created_at' && (
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedCompanies.map(company => (
                  <tr 
                    key={company.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedCompany?.id === company.id ? 'bg-blue-50' : ''}`}
                    onClick={() => handleViewCompany(company)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {company.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {company.industry || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        <Users className="h-4 w-4 inline mr-1" />
                        {company.member_count} {company.member_count === 1 ? 'member' : 'members'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        company.auto_join_enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {company.auto_join_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1.5" />
                        {formatDate(company.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                        {company.website && (
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <ExternalLink className="h-5 w-5" />
                          </a>
                        )}
                        <button 
                          className="text-blue-600 hover:text-blue-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCompany(company);
                            handleEditClick();
                          }}
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCompany(company.id);
                          }}
                          disabled={deletingId === company.id}
                        >
                          {deletingId === company.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Company Details */}
      {selectedCompany && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">{selectedCompany.name} Details</h2>
            {!isEditing ? (
              <Button 
                variant="outline" 
                size="sm" 
                leftIcon={<Edit className="h-4 w-4" />}
                onClick={handleEditClick}
              >
                Edit Company
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                leftIcon={<X className="h-4 w-4" />}
                onClick={() => setIsEditing(false)}
              >
                Cancel Edit
              </Button>
            )}
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Information */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Company Information</h3>
                
                {isEditing ? (
                  // Edit Form
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Industry
                      </label>
                      <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={editCompanyIndustry}
                        onChange={(e) => setEditCompanyIndustry(e.target.value)}
                        placeholder="e.g., Energy, Technology, Construction"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={editCompanyWebsite}
                        onChange={(e) => setEditCompanyWebsite(e.target.value)}
                        placeholder="https://example.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={editCompanyAddress}
                        onChange={(e) => setEditCompanyAddress(e.target.value)}
                        placeholder="123 Main St, City, State, ZIP"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={editCompanyPhone}
                        onChange={(e) => setEditCompanyPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State of Incorporation
                      </label>
                      <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={editCompanyState}
                        onChange={(e) => setEditCompanyState(e.target.value)}
                        placeholder="e.g., Delaware, California"
                      />
                    </div>
                    
                    <Button
                      leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      onClick={handleUpdateCompany}
                      disabled={!editCompanyName.trim() || isSaving}
                      isLoading={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                ) : (
                  // Display Info
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Industry</p>
                      <p className="text-sm">{selectedCompany.industry || 'Not specified'}</p>
                    </div>
                    {selectedCompany.website && (
                      <div>
                        <p className="text-xs text-gray-500">Website</p>
                        <p className="text-sm">
                          <a 
                            href={selectedCompany.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            {selectedCompany.website}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </p>
                      </div>
                    )}
                    {selectedCompany.address && (
                      <div>
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm">{selectedCompany.address}</p>
                      </div>
                    )}
                    {selectedCompany.phone && (
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm">{selectedCompany.phone}</p>
                      </div>
                    )}
                    {selectedCompany.state_of_incorporation && (
                      <div>
                        <p className="text-xs text-gray-500">State of Incorporation</p>
                        <p className="text-sm">{selectedCompany.state_of_incorporation}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="text-sm">{formatDate(selectedCompany.created_at)}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Members and Invitations */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Members ({companyMembers.length})</h3>
                </div>
                
                {loadingDetails ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                  </div>
                ) : companyMembers.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">No members yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {companyMembers.map(member => (
                      <div key={member.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md">
                        <div>
                          <p className="text-sm font-medium">{member.first_name} {member.last_name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          member.company_role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {member.company_role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Pending Invitations */}
                {companyInvitations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Pending Invitations</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {companyInvitations.map(invitation => (
                        <div key={invitation.id} className="flex justify-between items-center p-2 bg-yellow-50 rounded-md">
                          <div>
                            <p className="text-sm font-medium">{invitation.email}</p>
                            <p className="text-xs text-gray-500">
                              Invited {formatDate(invitation.created_at)}
                              <span className="mx-1">•</span>
                              Expires {formatDate(invitation.expires_at)}
                            </p>
                          </div>
                          <div className="flex items-center">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 mr-2">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Pending
                            </span>
                            <button 
                              className="text-sm text-blue-600 hover:text-blue-800"
                              onClick={() => handleResendInvitation(invitation.id)}
                            >
                              Resend
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Invite Form */}
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Invite New Member</h3>
                  <div className="flex flex-col space-y-2">
                    <input 
                      type="email" 
                      placeholder="Email address"
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <div className="flex justify-between">
                      <select 
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button
                        size="sm"
                        leftIcon={isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        onClick={handleInviteMember}
                        disabled={isInviting || !inviteEmail.trim()}
                      >
                        {isInviting ? 'Sending...' : 'Send Invite'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      An email will be sent with instructions to join the company.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      
      {activeTab === 'assignments' && (
        <AdminUserAssignment 
          onAssignmentComplete={() => {
            fetchCompanies();
            setSuccess('User assignment completed successfully');
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}
      
      {activeTab === 'verification' && (
        <CompanyVerificationWorkflow />
      )}
    </div>
  );
};