import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, 
  Users, 
  UserPlus, 
  Edit, 
  Globe, 
  Phone, 
  MapPin, 
  ChevronRight,
  Briefcase,
  Mail,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle,
  FileText,
  Plus,
  Library
} from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';

interface Company {
  id: string;
  name: string;
  website?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  industry?: string;
  description?: string;
  created_at: string;
  state_of_incorporation?: string;
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

interface CompanyNDA {
  id: string;
  rfp_id: string;
  rfp_title: string;
  client_name: string;
  status: 'signed' | 'approved' | 'rejected';
  signed_at: string;
  signed_by: string;
  signer_name: string;
}

export const CompanyProfile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [ndas, setNdas] = useState<CompanyNDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [processing, setProcessing] = useState(false);
  
  useEffect(() => {
    fetchCompanyData();
  }, [user]);

  const fetchCompanyData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is part of a company
      if (user.company_id) {
        // Fetch company details
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', user.company_id)
          .single();
          
        if (companyError) throw companyError;
        setCompany(companyData);
        
        // Fetch company members
        const { data: membersData, error: membersError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, company_role, created_at')
          .eq('company_id', user.company_id);
          
        if (membersError) throw membersError;
        setMembers(membersData || []);
        
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
        
        // Fetch company NDAs
        const { data: ndasData, error: ndasError } = await supabase
          .from('company_ndas')
          .select(`
            id,
            rfp_id,
            status,
            signed_at,
            signed_by,
            full_name,
            rfps (
              title,
              client_name
            )
          `)
          .eq('company_id', user.company_id)
          .order('signed_at', { ascending: false });
          
        if (ndasError) throw ndasError;
        
        // Transform NDA data
        const transformedNDAs = ndasData.map(nda => ({
          id: nda.id,
          rfp_id: nda.rfp_id,
          rfp_title: nda.rfps.title,
          client_name: nda.rfps.client_name,
          status: nda.status,
          signed_at: nda.signed_at,
          signed_by: nda.signed_by,
          signer_name: nda.full_name
        }));
        
        setNdas(transformedNDAs);
      }
    } catch (error: any) {
      console.error('Error fetching company data:', error);
      setError(error.message || 'Failed to load company data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateCompany = () => {
    // Navigate to the join company flow
    navigate('/join-company');
  };
  
  const handleEditCompany = () => {
    // Navigate to the company settings page
    navigate('/profile?tab=company');
  };
  
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company || !inviteEmail.trim()) return;

    try {
      setProcessing(true);
      setError(null);
      
      // Call the invite_to_company function
      const { data, error } = await supabase.rpc('invite_to_company', {
        p_company_id: company.id,
        p_email: inviteEmail.trim(),
        p_role: inviteRole
      });
      
      if (error) throw error;
      
      // Success - reset form and refresh data
      setInviteFormOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      
      // Refresh invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from('company_invitations')
        .select('*')
        .eq('company_id', company.id)
        .eq('status', 'pending');
        
      if (invitesError) throw invitesError;
      
      setInvitations(invitesData);
    } catch (error: any) {
      console.error('Error inviting member:', error);
      setError(error.message || 'Failed to invite member');
    } finally {
      setProcessing(false);
    }
  };
  
  const isCompanyAdmin = () => {
    return user && user.company_role === 'admin';
  };
  
  // If user isn't part of a company, show the option to create one
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-8 text-center">
        <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-3 animate-spin" />
        <h2 className="text-lg font-medium text-gray-900 mb-1">Loading company data...</h2>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }
  
  if (!company) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-8 text-center">
        <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-gray-900 mb-2">No Company Associated</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          You're not currently associated with any company. Create a company profile to better organize your team
          and simplify NDA management.
        </p>
        <div className="space-y-4">
          <Button
            leftIcon={<Building2 className="h-4 w-4" />}
            onClick={handleCreateCompany}
          >
            Create a Company
          </Button>
          <p className="text-sm text-gray-500">
            Or wait for an invitation from your company administrator.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-7 text-gray-900 sm:truncate flex items-center">
              <Building2 className="inline-block h-6 w-6 mr-2 text-blue-500" />
              {company.name}
            </h2>
            {company.industry && (
              <p className="mt-1 text-sm text-gray-500">
                Industry: {company.industry}
              </p>
            )}
          </div>
          {isCompanyAdmin() && (
            <div className="mt-4 flex md:ml-4 md:mt-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                leftIcon={<Edit className="h-4 w-4" />}
                onClick={handleEditCompany}
              >
                Edit Company
              </Button>
            </div>
          )}
        </div>
        
        {company.description && (
          <div className="mt-4 text-sm text-gray-600">
            <p>{company.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {company.website && (
            <div className="flex items-center">
              <Globe className="h-5 w-5 text-gray-400 mr-3" />
              <a 
                href={company.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          
          {company.phone && (
            <div className="flex items-center">
              <Phone className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-sm text-gray-600">{company.phone}</span>
            </div>
          )}
          
          {company.address && (
            <div className="flex items-center">
              <MapPin className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-sm text-gray-600">{company.address}</span>
            </div>
          )}

          {company.state_of_incorporation && (
            <div className="flex items-center">
              <Library className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-sm text-gray-600">{company.state_of_incorporation}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Company NDAs */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Company NDAs</h3>
          <p className="text-sm text-gray-500 mt-1">
            Non-disclosure agreements signed on behalf of your company
          </p>
        </div>
        
        {ndas.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Company NDAs</h3>
            <p className="text-gray-500 mb-4 max-w-md mx-auto">
              Your company hasn't signed any NDAs yet. When viewing an RFP that requires an NDA,
              company administrators can sign on behalf of all company members.
            </p>
            {isCompanyAdmin() && (
              <Link to="/rfps">
                <Button>
                  Browse RFPs
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {ndas.map(nda => (
              <li key={nda.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <Link 
                        to={`/rfps/${nda.rfp_id}`} 
                        className="text-base font-medium text-blue-600 hover:text-blue-700"
                      >
                        {nda.rfp_title}
                      </Link>
                      <p className="text-sm text-gray-500">Client: {nda.client_name}</p>
                      <div className="mt-1 flex items-center text-sm space-x-3">
                        <span className="text-gray-500">
                          Signed by: {nda.signer_name}
                        </span>
                        <span className="text-gray-500">
                          {format(new Date(nda.signed_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    {nda.status === 'approved' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Approved
                      </span>
                    ) : nda.status === 'signed' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertCircle className="h-3.5 w-3.5 mr-1" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Company Members section - only show for admins */}
      {isCompanyAdmin() && (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Users className="h-5 w-5 text-gray-400 mr-2" />
                Company Members
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Manage your team members and invitations
              </p>
            </div>
            <Button
              size="sm"
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setInviteFormOpen(true)}
            >
              Invite Member
            </Button>
          </div>
          
          {/* Invite Form */}
          {inviteFormOpen && (
            <div className="px-6 pt-4 pb-6 border-b border-gray-200 bg-blue-50">
              <h4 className="text-sm font-medium text-blue-800 mb-3">Invite a New Team Member</h4>
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="invite-email" className="block text-xs font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="invite-email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="colleague@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="invite-role" className="block text-xs font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={processing || !inviteEmail.trim()}
                      leftIcon={processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    >
                      {processing ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <p className="text-xs text-blue-700">
                    An email will be sent with instructions to join your company.
                  </p>
                  <button
                    type="button"
                    className="text-xs text-blue-700 hover:text-blue-900"
                    onClick={() => setInviteFormOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* Members List */}
          <ul className="divide-y divide-gray-200">
            {/* Active Members */}
            {members.map(member => (
              <li key={member.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="font-medium text-blue-800">
                          {member.first_name[0]}{member.last_name[0]}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        <Mail className="h-3 w-3 inline mr-1" /> {member.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {member.company_role === 'admin' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Administrator
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Member
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-gray-400 ml-3" />
                  </div>
                </div>
              </li>
            ))}
            
            {/* Pending Invitations */}
            {invitations.map(invitation => (
              <li key={invitation.id} className="px-6 py-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {invitation.email}
                      </div>
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-gray-500">
                          Invited on {format(new Date(invitation.created_at), 'MMM d, yyyy')}
                        </span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="text-xs text-gray-500">
                          Expires on {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      Resend
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            
            {members.length === 0 && invitations.length === 0 && (
              <li className="px-6 py-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No team members yet</h3>
                <p className="text-gray-500 mb-4 max-w-md mx-auto">
                  Start building your team by inviting colleagues to join your company.
                </p>
                <Button
                  leftIcon={<UserPlus className="h-4 w-4" />}
                  onClick={() => setInviteFormOpen(true)}
                >
                  Invite First Member
                </Button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};