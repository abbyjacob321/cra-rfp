import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  User,
  Mail,
  Building2,
  Calendar,
  Save,
  AlertCircle,
  CheckCircle,
  Briefcase,
  Loader2,
  Phone
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CompanyProfile } from '../components/bidder/CompanyProfile';

export const ProfilePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'company'>('profile');
  
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { returnUrl: '/profile' } });
      return;
    }
    
    // Populate form fields with user data
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setFullName(`${user.first_name} ${user.last_name}`);
    setEmail(user.email || '');
    setCompany(user.company || '');
    setTitle(user.title || '');
    setPhone(user.phone || '');
    
  }, [user, navigate]);
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Prepare update data - only include fields that exist in the table
      const updateData: Record<string, any> = {
        first_name: firstName,
        last_name: lastName,
        company
      };
      
      // Only include these fields if they exist in the database
      if (user.hasOwnProperty('title')) {
        updateData.title = title;
      }
      
      if (user.hasOwnProperty('phone')) {
        updateData.phone = phone;
      }
      
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
        
      if (profileError) throw profileError;
      
      // Update password if changed
      if (password) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        
        const { error: passwordError } = await supabase.auth.updateUser({
          password
        });
        
        if (passwordError) throw passwordError;
      }
      
      setSuccess('Profile updated successfully');
      
      // Clear password fields
      setPassword('');
      setConfirmPassword('');
      
      // Refresh auth session to get updated user data
      await supabase.auth.refreshSession();
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  if (!user) {
    return (
      <div className="flex justify-center py-8">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading profile information...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">
          Manage your account settings and preferences
        </p>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            Personal Information
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'company'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('company')}
          >
            Company
          </button>
        </nav>
      </div>
      
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
            <p className="mt-1 text-sm text-gray-500">
              Update your personal information and account settings
            </p>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start mb-6">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start mb-6">
                <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{success}</p>
              </div>
            )}
            
            <form onSubmit={handleUpdateProfile}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Input
                    label="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    leftIcon={<User className="h-5 w-5 text-gray-400" />}
                  />
                  
                  <Input
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    leftIcon={<User className="h-5 w-5 text-gray-400" />}
                  />
                </div>
                
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                  helperText="You cannot change your email address"
                />
                
                <Input
                  label="Job Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  leftIcon={<Briefcase className="h-5 w-5 text-gray-400" />}
                />
                
                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                />
                
                {user.company_id ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-gray-700">{company}</span>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.company_role === 'admin' ? 'Administrator' : 'Member'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      You are a member of a company. Manage company settings in the Company tab.
                    </p>
                  </div>
                ) : (
                  <Input
                    label="Company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    leftIcon={<Building2 className="h-5 w-5 text-gray-400" />}
                    helperText="Enter your company name or create a company in the Company tab"
                  />
                )}
                
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                  
                  <div className="space-y-6">
                    <Input
                      label="New Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      helperText="Leave blank to keep your current password"
                    />
                    
                    <Input
                      label="Confirm New Password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      error={
                        password && confirmPassword && password !== confirmPassword
                          ? "Passwords don't match"
                          : undefined
                      }
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading || (password !== '' && password !== confirmPassword)}
                    isLoading={loading}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {activeTab === 'company' && (
        <CompanyProfile />
      )}
    </div>
  );
};