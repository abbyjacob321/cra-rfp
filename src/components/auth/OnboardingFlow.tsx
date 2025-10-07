import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { User, Building2, Check, ArrowRight, Users, Zap, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface AutoJoinCompany {
  id: string;
  name: string;
  industry?: string;
  member_count: number;
  verified_domain: string;
  auto_join_enabled: boolean;
  website?: string;
  description?: string;
}

// Component to show after new user signup
export const OnboardingFlow: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [step, setStep] = useState(1);
  const [autoJoinStep, setAutoJoinStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoJoinLoading, setAutoJoinLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [skipCompany, setSkipCompany] = useState(false);
  const [autoJoinCompanies, setAutoJoinCompanies] = useState<AutoJoinCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<AutoJoinCompany | null>(null);
  
  // Check for auto-join opportunities
  useEffect(() => {
    const checkAutoJoin = async () => {
      const stepParam = searchParams.get('step');
      const emailParam = searchParams.get('email');
      
      if (stepParam === 'company-selection' && emailParam && user) {
        try {
          setAutoJoinLoading(true);
          
          const { data, error } = await supabase.rpc('find_autojoin_companies', {
            user_email: emailParam
          });
          
          if (error) throw error;
          
          if (data?.matches?.length > 0) {
            setAutoJoinCompanies(data.matches);
            setAutoJoinStep(true);
            setStep(2); // Skip profile step for auto-join
          }
        } catch (error) {
          console.error('Error checking auto-join:', error);
        } finally {
          setAutoJoinLoading(false);
        }
      }
    };
    
    if (user) {
      checkAutoJoin();
    }
  }, [user, searchParams]);
  
  // If user already completed onboarding, redirect to home
  useEffect(() => {
    if (!user) return;
    
    // If profile has a company_id or title set, consider onboarding complete
    if (user.company_id || user.title) {
      navigate('/');
    }
  }, [user, navigate]);
  
  const handleAutoJoinCompany = async () => {
    if (!selectedCompany || !user) return;
    
    try {
      setAutoJoinLoading(true);
      
      const { data, error } = await supabase.rpc('auto_join_company', {
        p_company_id: selectedCompany.id,
        p_user_email: user.email
      });
      
      if (error) throw error;
      
      if (data.success) {
        // Refresh user session to get updated company info
        await supabase.auth.refreshSession();
        navigate('/');
      } else {
        throw new Error(data.message || 'Failed to join company');
      }
    } catch (error: any) {
      console.error('Error auto-joining company:', error);
      // Fall back to manual company flow
      setAutoJoinStep(false);
      setStep(2);
    } finally {
      setAutoJoinLoading(false);
    }
  };
  
  const handleUpdateProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Update profile with additional details
      const { error } = await supabase
        .from('profiles')
        .update({
          title,
          phone
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Move to next step
      setStep(autoJoinStep ? 3 : 2);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFinishOnboarding = () => {
    if (skipCompany) {
      navigate('/');
    } else {
      navigate('/join-company');
    }
  };
  
  // Auto-join company selection step
  if (autoJoinStep && autoJoinCompanies.length > 0) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="p-6">
            <h1 className="text-xl font-bold">We Found Your Company!</h1>
            <p className="text-green-100 mt-1">Companies matching your email domain are ready for instant access</p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 text-green-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Auto-Join Available</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Your email domain matches {autoJoinCompanies.length === 1 ? 'a company' : 'companies'} with auto-join enabled. 
              Select your company to join instantly:
            </p>
          </div>
          
          <div className="space-y-3 mb-6">
            {autoJoinCompanies.map(company => (
              <label key={company.id} className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                <input
                  type="radio"
                  name="auto-join-company"
                  value={company.id}
                  checked={selectedCompany?.id === company.id}
                  onChange={() => setSelectedCompany(company)}
                  className="h-4 w-4 mt-1 text-green-600 focus:ring-green-500 border-gray-300"
                />
                <div className="ml-3 flex-grow">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium text-gray-900">{company.name}</h3>
                    <span className="text-sm text-green-600 font-medium">Auto-Join Enabled</span>
                  </div>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    {company.industry && <span>{company.industry}</span>}
                    <span className="flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {company.member_count} members
                    </span>
                    <span className="text-green-600">@{company.verified_domain}</span>
                  </div>
                  {company.description && (
                    <p className="mt-1 text-sm text-gray-600">{company.description}</p>
                  )}
                </div>
              </label>
            ))}
            
            <label className="flex items-start p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
              <input
                type="radio"
                name="auto-join-company"
                value="skip"
                checked={selectedCompany === null}
                onChange={() => setSelectedCompany(null)}
                className="h-4 w-4 mt-1 text-gray-600 focus:ring-gray-500 border-gray-300"
              />
              <div className="ml-3">
                <h3 className="text-base font-medium text-gray-900">Skip Auto-Join</h3>
                <p className="text-sm text-gray-500 mt-1">I'll join or create a company manually later</p>
              </div>
            </label>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">About Auto-Join:</p>
                <ul className="space-y-1">
                  <li>• You'll automatically become a team member</li>
                  <li>• Company NDAs will apply to your account</li>
                  <li>• You can collaborate on RFPs with your team</li>
                  <li>• You can join additional companies later as a collaborator</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setAutoJoinStep(false);
                setStep(2);
              }}
            >
              Skip for Now
            </Button>
            <Button
              onClick={handleAutoJoinCompany}
              disabled={!selectedCompany || autoJoinLoading}
              isLoading={autoJoinLoading}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {autoJoinLoading ? 'Joining...' : selectedCompany ? `Join ${selectedCompany.name}` : 'Select Company'}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Progress header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="p-6">
          <h1 className="text-xl font-bold">Welcome to the CRA RFP Platform</h1>
          <p className="text-blue-100 mt-1">Complete your profile setup to get started</p>
        </div>
        
        <div className="flex">
          <div className={`flex-1 p-4 ${step === 1 ? 'bg-white/10' : ''} flex justify-center`}>
            <div className="flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step > 1 ? 'bg-green-500' : 'bg-white/20'}`}>
                {step > 1 ? <Check className="h-5 w-5 text-white" /> : <span className="text-white">1</span>}
              </div>
              <span className="ml-2 font-medium">Profile Details</span>
            </div>
          </div>
          
          <div className={`flex-1 p-4 ${step === 2 ? 'bg-white/10' : ''} flex justify-center`}>
            <div className="flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step > 2 ? 'bg-green-500' : 'bg-white/20'}`}>
                {step > 2 ? <Check className="h-5 w-5 text-white" /> : <span className="text-white">2</span>}
              </div>
              <span className="ml-2 font-medium">Company Association</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-1">Complete Your Profile</h2>
              <p className="text-gray-500">
                Add a few more details to help us personalize your experience
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                  {user?.first_name.charAt(0)}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Energy Consultant, Project Manager"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your work phone number"
                />
              </div>
            </div>
            
            <div className="pt-4">
              <Button
                onClick={handleUpdateProfile}
                disabled={loading}
                isLoading={loading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Continue
              </Button>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-1">Company Association</h2>
              <p className="text-gray-500">
                Connect your account to your company for better collaboration
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => handleFinishOnboarding()}>
                <div className="mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Join a Company</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Search for your company and request to join. Your company admin will approve your request.
                </p>
                <Button variant="outline" fullWidth>
                  Find My Company
                </Button>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSkipCompany(true)}>
                <div className="mb-4 h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Continue as Individual</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Proceed without joining a company. You can always join or create one later.
                </p>
                <Button variant="outline" fullWidth onClick={() => navigate('/')}>
                  Skip for Now
                </Button>
              </div>
            </div>
            
            <div className="pt-4 text-center">
              <p className="text-sm text-gray-600">
                You can manage your company settings anytime from your profile page
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};