import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Building, AlertCircle, CheckCircle, Briefcase, Phone } from 'lucide-react';

type SignUpFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  phone: string;
};

export const SignUpForm: React.FC = () => {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  
  const defaultEmail = searchParams.get('email') || '';
  const returnTo = searchParams.get('returnTo') || '/verify-email?type=pending';
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    defaultValues: {
      email: defaultEmail
    }
  });
  
  const password = watch('password');
  
  const onSubmit = async (data: SignUpFormValues) => {
    console.time('signup-total');
    try {
      console.log('Starting signup process...');
      setIsLoading(true);
      setError('');
      setSuccess(false);
      
      // Remove confirmPassword from the data before sending
      const { confirmPassword, ...userData } = data;
      
      console.log('Calling signUp method...');
      console.time('signup-call');
      
      // Use a timeout to make sure we don't hang indefinitely
      const signupPromise = new Promise<void>(async (resolve, reject) => {
        try {
          // Set a timeout for the operation - 30 seconds (reduced from 120)
          const timeoutId = setTimeout(() => {
            reject(new Error("Signup timed out after 30 seconds"));
          }, 30000);
          
          // Call signup
          await signUp(userData.email, userData.password, {
            first_name: userData.first_name,
            last_name: userData.last_name,
            company: userData.company,
            title: userData.title,
            phone: userData.phone,
            role: 'bidder', // Default role
          });
          
          // Clear timeout since operation completed
          clearTimeout(timeoutId);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      
      // Wait for signup to complete or timeout
      await signupPromise;
      console.timeEnd('signup-call');
      
      console.log('Signup successful!');
      setSuccess(true);
      
      // Check for auto-join opportunities after successful signup
      try {
        const { data: autoJoinData, error: autoJoinError } = await supabase.rpc('find_autojoin_companies', {
          user_email: userData.email
        });
        
        if (!autoJoinError && autoJoinData?.matches?.length > 0) {
          // Navigate to company selection if matches found
          navigate(`/onboarding?step=company-selection&email=${encodeURIComponent(userData.email)}`);
          return;
        }
      } catch (autoJoinError) {
        console.warn('Auto-join check failed:', autoJoinError);
        // Continue with normal flow if auto-join check fails
      }
      
      // Navigate to the email verification page
      navigate(returnTo);
    } catch (error: any) {
      console.timeEnd('signup-call');
      console.error('Signup error details:', error);
      
      // Handle specific error cases with user-friendly messages
      if (error.message === 'User already registered' || 
          (error.code === 'user_already_exists') ||
          (error.error?.message === 'User already registered') ||
          error.message?.includes('already registered')) {
        setError('This email is already registered. Please use a different email or try logging in instead.');
      } else if (error.message?.includes('confirm') || error.message?.includes('verification')) {
        // Email confirmation related - this is expected, show success instead
        setSuccess(true);
        navigate('/verify-email?type=pending');
        return;
      } else if (error.message?.includes('violates row-level security policy')) {
        setError('Unable to create profile due to security policy. Please contact support for assistance.');
      } else if (error.message?.includes('policy for relation "profiles"')) {
        setError('Profile creation failed due to system policy. Please contact support.');
      } else if (error.message?.includes('duplicate key value violates unique constraint')) {
        setError('This email is already in use. Please use a different email address.');
      } else if (error.message?.includes('timed out')) {
        setError('The signup process timed out. Please try again or contact support if the issue persists.');
      } else {
        setError(`An error occurred during sign up: ${error.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      console.log('Signup process completed (success or failure)');
      console.timeEnd('signup-total');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-md w-full mx-auto">
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
          <h1 className="text-2xl font-bold text-white text-center">Create your account</h1>
          <p className="text-blue-100 mt-2 text-center">Join the CRA RFP Platform</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">Your account has been created successfully! Please check your email to verify your account.</p>
            </div>
          )}
          
          {!success && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="First Name"
                  type="text"
                  id="first_name"
                  placeholder="John"
                  error={errors.first_name?.message}
                  leftIcon={<User className="h-5 w-5 text-gray-400" />}
                  {...register('first_name', {
                    required: 'First name is required',
                  })}
                />
                
                <Input
                  label="Last Name"
                  type="text"
                  id="last_name"
                  placeholder="Doe"
                  error={errors.last_name?.message}
                  leftIcon={<User className="h-5 w-5 text-gray-400" />}
                  {...register('last_name', {
                    required: 'Last name is required',
                  })}
                />
              </div>
              
              <Input
                label="Job Title"
                type="text"
                id="title"
                placeholder="Energy Consultant"
                helperText="Your position at your company"
                leftIcon={<Briefcase className="h-5 w-5 text-gray-400" />}
                {...register('title')}
              />
              
              <Input
                label="Phone Number"
                type="tel"
                id="phone"
                placeholder="+1 (555) 123-4567"
                helperText="Optional contact number"
                leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                {...register('phone')}
              />
              
              <Input
                label="Company"
                type="text"
                id="company"
                placeholder="Your Company Name"
                helperText="You can join or create a company after signup"
                leftIcon={<Building className="h-5 w-5 text-gray-400" />}
                {...register('company')}
              />
              
              <Input
                label="Email address"
                type="email"
                id="email"
                placeholder="you@example.com"
                autoComplete="email"
                error={errors.email?.message}
                leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
              
              <Input
                label="Password"
                type="password"
                id="password"
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.password?.message}
                leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                    message: 'Password must include uppercase, lowercase, number and special character',
                  }
                })}
              />
              
              <Input
                label="Confirm Password"
                type="password"
                id="confirmPassword"
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: value => value === password || 'The passwords do not match',
                })}
              />
              
              <div className="flex items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  required
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
                  I agree to the{' '}
                  <Link to="/terms" className="font-medium text-blue-600 hover:text-blue-500">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="font-medium text-blue-600 hover:text-blue-500">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              
              <Button type="submit" fullWidth isLoading={isLoading} leftIcon={<User className="h-4 w-4" />}>
                Create Account
              </Button>
              
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};