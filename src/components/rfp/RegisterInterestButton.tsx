import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clipboard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface RegisterInterestButtonProps {
  rfpId: string;
  rfpTitle: string;
}

export const RegisterInterestButton: React.FC<RegisterInterestButtonProps> = ({ 
  rfpId,
  rfpTitle
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if user's company is already registered for this RFP
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!user || !user.company_id) {
        setIsChecking(false);
        return;
      }

      try {
        setIsChecking(true);
        
        const { data, error } = await supabase.rpc(
          'check_rfp_interest_registration',
          { p_rfp_id: rfpId }
        );
          
        if (error) throw error;
        
        setIsRegistered(data.is_registered);
      } catch (error) {
        console.error('Error checking registration:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkRegistrationStatus();
  }, [user, rfpId]);

  const handleRegisterInterest = async () => {
    if (!user) {
      navigate('/login', { state: { returnUrl: `/rfps/${rfpId}` } });
      return;
    }

    if (!user.company_id) {
      navigate('/join-company', { state: { returnUrl: `/rfps/${rfpId}` } });
      setError('You must be associated with a company to register interest');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const { data, error } = await supabase.rpc(
        'register_rfp_interest',
        { p_rfp_id: rfpId }
      );
      
      if (error) throw error;
      
      setIsRegistered(true);
      setSuccess('Your company has been registered for this RFP');
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error registering interest:', error);
      setError(error.message || 'Failed to register interest');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <Button
        variant="outline"
        disabled
        leftIcon={<Loader2 className="h-4 w-4 animate-spin" />}
      >
        Checking...
      </Button>
    );
  }

  if (isRegistered) {
    return (
      <Button
        variant="outline"
        disabled
        leftIcon={<CheckCircle className="h-4 w-4 text-green-500" />}
        className="border-green-200 text-green-700"
      >
        Interest Registered
      </Button>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 text-sm text-red-600 rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-2 p-2 bg-green-50 border border-green-200 text-sm text-green-600 rounded-md flex items-center">
          <CheckCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
          {success}
        </div>
      )}
      
      <Button
        variant="outline"
        leftIcon={<Clipboard className="h-4 w-4" />}
        onClick={handleRegisterInterest}
        isLoading={isLoading}
      >
        Register for RFP
      </Button>
    </>
  );
};