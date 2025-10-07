import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Building2, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const CompanyInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [token] = useState<string>(searchParams.get('token') || '');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [invitedRole, setInvitedRole] = useState<string>('member');
  
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Missing token.');
      setLoading(false);
      return;
    }
    
    const fetchInvitationDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch invitation details
        const { data, error } = await supabase
          .from('company_invitations')
          .select(`
            email,
            role,
            expires_at,
            companies(name)
          `)
          .eq('token', token)
          .eq('status', 'pending')
          .single();
          
        if (error) throw error;
        
        if (!data) {
          setError('Invitation not found or has expired.');
          return;
        }
        
        // Check if invitation is expired
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
          setError('This invitation has expired.');
          return;
        }
        
        // Set invitation details
        setInvitedEmail(data.email);
        setInvitedRole(data.role);
        setCompanyName(data.companies.name);
        
      } catch (error: any) {
        console.error('Error fetching invitation details:', error);
        setError('Failed to load invitation details.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitationDetails();
  }, [token]);
  
  const handleAcceptInvitation = async () => {
    try {
      setProcessing(true);
      
      if (!user) {
        // Redirect to login with return URL
        navigate(`/login?returnTo=${encodeURIComponent(`/invitation?token=${token}`)}`);
        return;
      }
      
      if (user.email !== invitedEmail) {
        setError(`This invitation was sent to ${invitedEmail}. You are currently logged in as ${user.email}.`);
        return;
      }
      
      // Call function to accept invitation
      const { data, error } = await supabase.rpc('accept_company_invitation', {
        p_token: token
      });
      
      if (error) throw error;
      
      setSuccess(true);
      
      // Refresh user session to get updated company info
      await supabase.auth.refreshSession();
      
      // Navigate to profile page after a delay
      setTimeout(() => {
        navigate('/profile');
      }, 3000);
      
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setError(error.message || 'Failed to accept invitation.');
    } finally {
      setProcessing(false);
    }
  };
  
  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Verifying invitation...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-red-50 p-6 flex items-start">
            <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800">Invitation Error</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
          <div className="p-6">
            <p className="mb-4 text-gray-600">
              Please contact the person who invited you or go back to the homepage.
            </p>
            <Link to="/">
              <Button>
                Go to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-green-50 p-6">
            <div className="flex justify-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium leading-6 text-green-800">Invitation Accepted</h3>
              <p className="mt-2 text-sm text-green-600">
                You have successfully joined {companyName}.
              </p>
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="mb-4 text-gray-600">
              You'll be redirected to your profile page shortly.
            </p>
            <Link to="/profile">
              <Button>
                Go to Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-center">
            <Building2 className="h-10 w-10 mr-3" />
            <h2 className="text-xl font-semibold">Company Invitation</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-6 text-center">
            <h3 className="text-lg font-medium text-gray-900">
              You've been invited to join
            </h3>
            <p className="text-xl font-bold text-blue-600 mt-1">{companyName}</p>
            <p className="text-sm text-gray-600 mt-1">
              as a {invitedRole === 'admin' ? 'Company Administrator' : 'Team Member'}
            </p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-3">
              <Users className="h-5 w-5 text-blue-500 mr-2" />
              <h4 className="font-medium text-blue-800">What this means:</h4>
            </div>
            <ul className="space-y-2 text-sm text-blue-700">
              <li>• You'll be associated with {companyName}</li>
              <li>• Your profile will show you as a member of this company</li>
              {invitedRole === 'admin' && (
                <>
                  <li>• You'll have administrator privileges for the company</li>
                  <li>• You can sign NDAs on behalf of the company</li>
                  <li>• You can manage company information and team members</li>
                </>
              )}
              <li>• You'll have access to the company's RFPs and documents</li>
            </ul>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              This invitation was sent to <span className="font-medium">{invitedEmail}</span>.
              {user && user.email !== invitedEmail && (
                <span className="block text-red-600 mt-1">
                  You are currently logged in as {user.email}. Please log out and log in with the invited email address.
                </span>
              )}
            </p>
          </div>
          
          <div className="space-y-3">
            {!user ? (
              <div className="space-y-3">
                <Link to={`/login?returnTo=${encodeURIComponent(`/invitation?token=${token}`)}`}>
                  <Button fullWidth>
                    Log in to accept
                  </Button>
                </Link>
                <Link to={`/signup?email=${encodeURIComponent(invitedEmail)}&returnTo=${encodeURIComponent(`/invitation?token=${token}`)}`}>
                  <Button variant="outline" fullWidth>
                    Create an account
                  </Button>
                </Link>
              </div>
            ) : (
              <Button
                onClick={handleAcceptInvitation}
                disabled={processing || user.email !== invitedEmail}
                isLoading={processing}
                fullWidth
              >
                Accept Invitation
              </Button>
            )}
            
            <Link to="/">
              <Button variant="outline" fullWidth>
                Decline
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};