import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types';
import { X, AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface AddUserModalProps {
  onClose: () => void;
  onUserAdded: (user: User) => void;
}

type AddUserFormValues = {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  role: 'admin' | 'client_reviewer' | 'bidder';
  password: string;
};

export const AddUserModal: React.FC<AddUserModalProps> = ({ onClose, onUserAdded }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddUserFormValues>();
  
  const onSubmit = async (data: AddUserFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      
      // Use the correct URL format for Edge Functions
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error('A user with this email already exists');
        }
        throw new Error(errorData.error || 'Failed to create user');
      }

      const profile = await response.json();
      onUserAdded(profile as User);
      onClose();
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(error.message || 'Failed to create user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        
        <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="sm:flex sm:items-start">
            <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-blue-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Add New User
              </h3>
              
              {error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    {...register('first_name', { required: 'First name is required' })}
                    error={errors.first_name?.message}
                  />
                  
                  <Input
                    label="Last Name"
                    {...register('last_name', { required: 'Last name is required' })}
                    error={errors.last_name?.message}
                  />
                </div>
                
                <Input
                  label="Email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  error={errors.email?.message}
                />
                
                <Input
                  label="Password"
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    }
                  })}
                  error={errors.password?.message}
                />
                
                <Input
                  label="Company"
                  {...register('company')}
                  error={errors.company?.message}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    {...register('role', { required: 'Role is required' })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="bidder">Bidder</option>
                    <option value="client_reviewer">Client Reviewer</option>
                    <option value="admin">Administrator</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                  )}
                </div>
                
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                  >
                    {isSubmitting ? 'Creating...' : 'Create User'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};