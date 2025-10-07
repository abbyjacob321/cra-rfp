import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

type ForgotPasswordFormValues = {
  email: string;
};

export const ForgotPasswordPage: React.FC = () => {
  const { forgotPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>();
  
  const onSubmit = async (data: ForgotPasswordFormValues) => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess(false);
      
      await forgotPassword(data.email);
      setSuccess(true);
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An error occurred. Please check your email and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-md w-full mx-auto">
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
          <h1 className="text-2xl font-bold text-white text-center">Reset your password</h1>
          <p className="text-blue-100 mt-2 text-center">We'll send you a link to reset your password</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {success ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Check your email</h3>
              <p className="text-gray-500 mb-6">
                We've sent a password reset link to your email address. Please check your inbox and follow the instructions.
              </p>
              <Link to="/login">
                <Button variant="outline" fullWidth>
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              
              <Button type="submit" fullWidth isLoading={isLoading}>
                Send Reset Link
              </Button>
              
              <div className="text-center mt-4">
                <Link to="/login" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};