import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Mail, 
  Users, 
  UserPlus, 
  Search, 
  Send, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Building2,
  Loader2,
  X,
  Plus,
  Copy
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface RFPInvitationManagerProps {
  rfpId: string;
  rfpTitle: string;
}

interface ExistingUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  company_id?: string;
}

interface Invitation {
  id: string;
  recipient_email: string;
  invitation_type: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
  invited_by_name?: string;
}

export const RFPInvitationManager: React.FC<RFPInvitationManagerProps> = ({ 
  rfpId, 
  rfpTitle 
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'email'>('existing');
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [emailList, setEmailList] = useState('');
  const [invitationMessage, setInvitationMessage] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchExistingUsers();
    fetchInvitations();
  }, [rfpId]);

  const fetchExistingUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          company,
          company_id,
          companies:company_id(name)
        `)
        .neq('role', 'admin')
        .order('email');

      if (error) throw error;

      const processedUsers = data.map(user => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company: user.companies?.name || user.company || 'Independent',
        company_id: user.company_id
      }));

      setExistingUsers(processedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('rfp_invitations')
        .select(`
          id,
          recipient_email,
          invitation_type,
          status,
          created_at,
          expires_at,
          token,
          invited_by:profiles!rfp_invitations_invited_by_fkey(
            first_name,
            last_name
          )
        `)
        .eq('rfp_id', rfpId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedInvitations = data.map(inv => ({
        id: inv.id,
        recipient_email: inv.recipient_email,
        invitation_type: inv.invitation_type,
        status: inv.status,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
        token: inv.token,
        invited_by_name: inv.invited_by ? 
          `${inv.invited_by.first_name} ${inv.invited_by.last_name}` : 
          'Unknown'
      }));

      setInvitations(processedInvitations);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
    }
  };

  const filteredUsers = existingUsers.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserSelection = (userId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedUsers(filteredUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const sendInvitationsToExistingUsers = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setSending(true);
      setError(null);
      setSuccess(null);

      const selectedUserData = existingUsers.filter(user => selectedUsers.includes(user.id));
      
      for (const user of selectedUserData) {
        const { data, error } = await supabase.rpc('send_rfp_invitation', {
          p_rfp_id: rfpId,
          p_recipient_email: user.email,
          p_invitation_type: user.company_id ? 'company' : 'user',
          p_recipient_user_id: user.id,
          p_recipient_company_id: user.company_id,
          p_message: invitationMessage.trim() || null
        });

        if (error) {
          console.error(`Error inviting ${user.email}:`, error);
          continue; // Continue with other invitations
        }

        // Send email notification via edge function
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
        
        try {
          await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              templateName: 'rfp_invitation',
              recipient: user.email,
              data: {
                ...data,
                firstName: user.first_name,
                lastName: user.last_name
              }
            })
          });
        } catch (emailError) {
          console.warn('Failed to send email notification:', emailError);
        }
      }

      setSuccess(`Invitations sent to ${selectedUserData.length} users`);
      setSelectedUsers([]);
      setInvitationMessage('');
      await fetchInvitations();

    } catch (error: any) {
      console.error('Error sending invitations:', error);
      setError('Failed to send some invitations');
    } finally {
      setSending(false);
    }
  };

  const sendEmailInvitations = async () => {
    const emails = emailList
      .split('\n')
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    if (emails.length === 0) {
      setError('Please enter valid email addresses');
      return;
    }

    try {
      setSending(true);
      setError(null);
      setSuccess(null);

      for (const email of emails) {
        const { data, error } = await supabase.rpc('send_rfp_invitation', {
          p_rfp_id: rfpId,
          p_recipient_email: email,
          p_invitation_type: 'email',
          p_message: invitationMessage.trim() || null
        });

        if (error) {
          console.error(`Error inviting ${email}:`, error);
          continue;
        }

        // Send email notification
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
        
        try {
          await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              templateName: 'rfp_invitation',
              recipient: email,
              data: data
            })
          });
        } catch (emailError) {
          console.warn('Failed to send email notification:', emailError);
        }
      }

      setSuccess(`Invitations sent to ${emails.length} recipients`);
      setEmailList('');
      setInvitationMessage('');
      await fetchInvitations();

    } catch (error: any) {
      console.error('Error sending email invitations:', error);
      setError('Failed to send some invitations');
    } finally {
      setSending(false);
    }
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/rfp-invitation?token=${token}`;
    navigator.clipboard.writeText(link);
    setSuccess('Invitation link copied to clipboard');
    setTimeout(() => setSuccess(null), 3000);
  };

  const resendInvitation = async (invitationId: string) => {
    // Implementation for resending invitations
    setSuccess('Invitation resent (implementation pending)');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Invite Users to RFP</h3>
        <div className="text-sm text-gray-500">
          {rfpTitle}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md flex items-start">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'existing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('existing')}
          >
            Existing Users
          </button>
          <button
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('email')}
          >
            Email Invitations
          </button>
        </nav>
      </div>

      {/* Existing Users Tab */}
      {activeTab === 'existing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-grow max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {selectedUsers.length} selected
              </span>
              <Button
                onClick={() => handleSelectAll(selectedUsers.length !== filteredUsers.length)}
                variant="outline"
                size="sm"
              >
                {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="w-12 px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                            <span className="text-sm font-medium text-blue-800">
                              {user.first_name[0]}{user.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-500">{user.company}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invitation Message (Optional)
              </label>
              <textarea
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Add a personal message to the invitation..."
                value={invitationMessage}
                onChange={(e) => setInvitationMessage(e.target.value)}
              />
            </div>

            <Button
              onClick={sendInvitationsToExistingUsers}
              disabled={selectedUsers.length === 0 || sending}
              isLoading={sending}
              leftIcon={<Send className="h-4 w-4" />}
            >
              {sending 
                ? 'Sending Invitations...' 
                : `Send Invitations to ${selectedUsers.length} Users`}
            </Button>
          </div>
        </div>
      )}

      {/* Email Invitations Tab */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Addresses
            </label>
            <textarea
              rows={6}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter email addresses, one per line:&#10;john@company.com&#10;jane@example.org&#10;team@contractor.net"
              value={emailList}
              onChange={(e) => setEmailList(e.target.value)}
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter one email address per line. Recipients will receive an invitation to register for the platform and access this RFP.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invitation Message (Optional)
            </label>
            <textarea
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Add a personal message to the invitation..."
              value={invitationMessage}
              onChange={(e) => setInvitationMessage(e.target.value)}
            />
          </div>

          <Button
            onClick={sendEmailInvitations}
            disabled={!emailList.trim() || sending}
            isLoading={sending}
            leftIcon={<Mail className="h-4 w-4" />}
          >
            {sending 
              ? 'Sending Invitations...' 
              : `Send Email Invitations`}
          </Button>
        </div>
      )}

      {/* Existing Invitations */}
      {invitations.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">Recent Invitations</h4>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {invitations.slice(0, 10).map(invitation => (
                <li key={invitation.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {invitation.recipient_email}
                        </p>
                        <p className="text-xs text-gray-500">
                          Sent {new Date(invitation.created_at).toLocaleDateString()} by {invitation.invited_by_name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {invitation.status === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </span>
                      ) : invitation.status === 'accepted' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {invitation.status}
                        </span>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Copy className="h-3 w-3" />}
                        onClick={() => copyInvitationLink(invitation.token)}
                      >
                        Copy Link
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};