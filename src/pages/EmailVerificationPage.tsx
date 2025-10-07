import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const type = searchParams.get('type') || 'pending';
  const token = searchParams.get('token') || '';
  
  useEffect(() => {
    const verifyEmail = async () => {
      if (type === 'verify' && token) {
        try {
          setLoading(true);
          
          // Handle email confirmation from link
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Session error:', error);
            throw error;
          }
          
          // Check if user is now confirmed
          if (data.session?.user?.email_confirmed_at) {
            // User is confirmed, create their profile if it doesn't exist
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                id: data.session.user.id,
                email: data.session.user.email || '',
                first_name: data.session.user.user_metadata?.first_name || '',
                last_name: data.session.user.user_metadata?.last_name || '',
                company: data.session.user.user_metadata?.company || '',
                role: 'bidder',
                title: data.session.user.user_metadata?.title || '',
                phone: data.session.user.user_metadata?.phone || ''
              }, {
                onConflict: 'id'
              });
            
            if (profileError) {
              console.error('Profile creation error:', profileError);
              // Don't fail verification for profile errors
            }
          }
          
          setSuccess(true);
          
          // Redirect to login after a delay
          setTimeout(() => {
            navigate('/login');
          }, 3000);
          
        } catch (error: any) {
          console.error('Error verifying email:', error);
          setError(error.message || 'Failed to verify email. The link may have expired.');
        } finally {
          setLoading(false);
        }
      } else {
        // Just show the pending verification page
        setLoading(false);
      }
    };
    
    verifyEmail();
  }, [token, type, navigate]);
  
  // Pending verification view
  if (type === 'pending' && !loading) {
    return (
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <h1 className="text-2xl font-bold text-white text-center">Verify Your Email</h1>
            <p className="text-blue-100 mt-2 text-center">Check your inbox to complete signup</p>
          </div>
          
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">Verification Email Sent</h3>
            <p className="text-gray-500 mb-6">
              We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
            </p>
            
            <div className="text-sm text-gray-500 mb-6">
              <p>If you don't see the email, please check your spam folder.</p>
              <p className="mt-2">You won't be able to log in until you verify your email address.</p>
            </div>
            
            <div className="space-y-3">
              <Link to="/login">
                <Button variant="outline" fullWidth>
                  Back to Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <h1 className="text-2xl font-bold text-white text-center">Email Verification</h1>
          </div>
          
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Verifying Your Email</h3>
            <p className="text-gray-500">Please wait while we verify your email address...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-500 p-6">
            <h1 className="text-2xl font-bold text-white text-center">Verification Failed</h1>
          </div>
          
          <div className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Verify Email</h3>
            <p className="text-gray-500 mb-6">
              {error}
            </p>
            
            <div className="space-y-3">
              <Link to="/login">
                <Button fullWidth>
                  Back to Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Success state
  return (
    <div className="max-w-md w-full mx-auto">
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-500 p-6">
          <h1 className="text-2xl font-bold text-white text-center">Email Verified</h1>
        </div>
        
        <div className="p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">Email Successfully Verified</h3>
          <p className="text-gray-500 mb-6">
            We've sent a verification link to your email address. Please check your inbox and click the link to verify your account. 
            This email is sent automatically by Supabase and should arrive within a few minutes.
          </p>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-2">Redirecting you to login page...</p>
            <p className="mt-2">You won't be able to access the platform until you verify your email address.</p>
            <p className="mt-2 text-xs">Note: Verification emails are sent by Supabase's email service and should be reliable.</p>
            <Link to="/login">
              <Button fullWidth>
                Log In Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};