import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  Mail,
  Calendar,
  User
} from 'lucide-react';
import { Button } from '../components/ui/Button';

interface InvitationDetails {
  invitation_id: string;
  rfp_id: string;
  rfp_title: string;
  client_name: string;
  recipient_email: string;
  message?: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_name: string;
}

export const RFPInvitationAcceptPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [token] = useState<string>(searchParams.get('token') || '');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Missing token.');
      setLoading(false);
      return;
    }
    
    fetchInvitationDetails();
  }, [token]);
  
  const fetchInvitationDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_rfp_invitation_details', {
        p_token: token
      });
      
      if (error) throw error;
      
      if (!data) {
        setError('Invitation not found or has expired.');
        return;
      }
      
      setInvitationDetails(data);
      
      // Check if invitation is expired
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired.');
        return;
      }
      
      // Check if already accepted
      if (data.status === 'accepted') {
        setSuccess(true);
        return;
      }
      
    } catch (error: any) {
      console.error('Error fetching invitation details:', error);
      setError('Failed to load invitation details.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAcceptInvitation = async () => {
    try {
      setAccepting(true);
      setError(null);
      
      if (!user) {
        // Redirect to login with return URL
        navigate(`/login?returnTo=${encodeURIComponent(`/rfp-invitation?token=${token}`)}`);
        return;
      }
      
      if (user.email !== invitationDetails?.recipient_email) {
        setError(`This invitation was sent to ${invitationDetails?.recipient_email}. You are currently logged in as ${user.email}.`);
        return;
      }
      
      // Accept the invitation
      const { data, error } = await supabase.rpc('accept_rfp_invitation', {
        p_token: token
      });
      
      if (error) throw error;
      
      setSuccess(true);
      
      // Navigate to RFP after a delay
      setTimeout(() => {
        navigate(`/rfps/${invitationDetails?.rfp_id}`);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setError(error.message || 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Verifying invitation...</p>
          </div>
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
                You have successfully accepted the invitation to participate in this RFP.
              </p>
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="mb-4 text-gray-600">
              You'll be redirected to the RFP page shortly.
            </p>
            <Link to={`/rfps/${invitationDetails?.rfp_id}`}>
              <Button>
                View RFP Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <Link to="/" className="text-gray-500 hover:text-gray-700 flex items-center">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-center">
            <Building2 className="h-10 w-10 mr-3" />
            <h2 className="text-xl font-semibold">RFP Invitation</h2>
          </div>
        </div>
        
        <div className="p-6">
          {invitationDetails && (
            <>
              <div className="mb-6 text-center">
                <h3 className="text-lg font-medium text-gray-900">
                  You've been invited to participate in
                </h3>
                <p className="text-xl font-bold text-blue-600 mt-2">
                  {invitationDetails.rfp_title}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Issued by {invitationDetails.client_name}
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center">
                    <User className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="text-blue-800">
                      Invited by: {invitationDetails.invited_by_name}
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="text-blue-800">
                      Sent to: {invitationDetails.recipient_email}
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="text-blue-800">
                      Expires: {new Date(invitationDetails.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {invitationDetails.message && (
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <p className="text-sm text-blue-700 italic">
                      "{invitationDetails.message}"
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  This invitation gives you access to view and participate in this RFP. 
                  {user && user.email !== invitationDetails.recipient_email && (
                    <span className="block text-red-600 mt-1 font-medium">
                      You are currently logged in as {user.email}. Please log out and log in with the invited email address.
                    </span>
                  )}
                </p>
              </div>
              
              <div className="space-y-3">
                {!user ? (
                  <div className="space-y-3">
                    <Link to={`/login?returnTo=${encodeURIComponent(`/rfp-invitation?token=${token}`)}`}>
                      <Button fullWidth>
                        Log in to accept
                      </Button>
                    </Link>
                    <Link to={`/signup?email=${encodeURIComponent(invitationDetails.recipient_email)}&returnTo=${encodeURIComponent(`/rfp-invitation?token=${token}`)}`}>
                      <Button variant="outline" fullWidth>
                        Create an account
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    onClick={handleAcceptInvitation}
                    disabled={accepting || user.email !== invitationDetails.recipient_email}
                    isLoading={accepting}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};