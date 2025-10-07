import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        console.log('Fetching user profile...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Handle invalid refresh token error
        if (sessionError && sessionError.message?.includes('Invalid Refresh Token')) {
          console.log('Invalid refresh token detected, clearing session');
          setUser(null);
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          console.log('Session found, fetching profile for:', session.user.id);
          
          // Fetch additional user data from profiles table
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.user.email)
            .single();
            
          if (error) {
            console.error('Error fetching profile:', error);
            // Don't return here, try id lookup as fallback
            console.log('Trying id lookup as fallback...');
            const { data: idData, error: idError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            if (idError) {
              console.error('Profile lookup by id also failed:', idError);
              setUser(null);
              setLoading(false);
              return;
            }
            
            if (idData) {
              console.log('Profile found by id');
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                first_name: idData.first_name || '',
                last_name: idData.last_name || '',
                company: idData.company || '',
                role: idData.role || 'bidder',
                created_at: idData.created_at || '',
                company_id: idData.company_id || undefined,
                company_role: idData.company_role || undefined,
                title: idData.title || undefined,
                phone: idData.phone || undefined
              });
              setLoading(false);
              return;
            }
          }
            
          if (data) {
            console.log('Profile found by email');
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              first_name: data.first_name || '',
              last_name: data.last_name || '',
              company: data.company || '',
              role: data.role || 'bidder',
              created_at: data.created_at || '',
              company_id: data.company_id || undefined,
              company_role: data.company_role || undefined,
              title: data.title || undefined,
              phone: data.phone || undefined
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error: any) {
        console.error('Error fetching user:', error);
        
        // Handle invalid refresh token error in catch block
        if (error.message?.includes('Invalid Refresh Token')) {
          setUser(null);
          await supabase.auth.signOut();
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      switch (event) {
        case 'SIGNED_IN':
          // Wait a moment for JWT to propagate
          setTimeout(() => fetchUser(), 500);
          break;
        case 'SIGNED_OUT':
          console.log('User signed out, clearing state');
          setUser(null);
          break;
        case 'TOKEN_REFRESHED':
          console.log('Token refreshed, updating user data');
          fetchUser();
          break;
      }
    });

    return () => {
      if (authListener) {
        console.log('Unsubscribing from auth listener');
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in user:', email);
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Sign in error:', error);
        throw error;
      }
      console.log('Sign in successful');
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      // Handle invalid refresh token error
      if (error.message?.includes('Invalid Refresh Token')) {
        console.warn('Invalid refresh token detected during sign in, clearing session');
        await supabase.auth.signOut();
      }
      
      throw error;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    console.time('signup');
    
    try {
      console.log('Starting signup process for:', email);
      console.log('Signup data:', { ...userData, password: '****' });
      
      // Create the auth user with email confirmation enabled
      console.log('Creating auth user...');
      const { error: signUpError, data } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            company: userData.company,
            role: 'bidder'
          }
        }
      });
      
      if (signUpError) {
        throw signUpError;
      }
      
      if (!data.user) {
        throw new Error('Failed to create user account');
      }
      
      // Only create profile if user is confirmed or if confirmation is disabled
      // If email confirmation is enabled, profile will be created after confirmation
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            company: userData.company || '',
            role: 'bidder',
            title: userData.title || '',
            phone: userData.phone || ''
          })
          .select();
        
        if (profileError) {
          // If profile creation fails and it's due to email not being confirmed, that's expected
          if (profileError.code !== '23503') { // Foreign key violation (expected for unconfirmed users)
            console.error('Profile creation error:', profileError);
            throw profileError;
          }
        }
        
        console.log('Profile created successfully:', profile);
      } catch (error: any) {
        console.error('Error in signup process:', error);
        // Only throw if it's not an expected confirmation-related error
        if (!error.message?.includes('email') && !error.message?.includes('confirm')) {
          throw error;
        }
      }
      
      console.log('Signup complete!');
      console.timeEnd('signup');
      
      // Check for auto-join opportunities after profile creation
      try {
        console.log('Checking for auto-join opportunities...');
        const { data: autoJoinData, error: autoJoinError } = await supabase.rpc('signup_with_autojoin_check', {
          p_user_id: data.user.id,
          p_email: email
        });
        
        if (autoJoinError) {
          console.warn('Auto-join check failed:', autoJoinError);
        } else if (autoJoinData?.auto_joined) {
          console.log('User was auto-joined to company:', autoJoinData.company_id);
        }
      } catch (autoJoinError) {
        console.warn('Auto-join check error:', autoJoinError);
        // Don't fail signup if auto-join check fails
      }
      
    } catch (error: any) {
      console.error('Error in signup process:', error);
      console.timeEnd('signup');
      
      // Handle specific Supabase error cases
      if (error.message?.includes('already registered') || 
          error.message?.includes('already in use') ||
          error.error?.message?.includes('already registered')) {
        throw { message: 'User already registered', code: 'user_already_exists' };
      }
      
      // If error is from Supabase's API
      if (error.error?.message) {
        console.error('Supabase API error:', error.error.message);
        throw { 
          message: error.error.message,
          code: error.error?.code || 'unknown',
          error: error.error
        };
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out user...');
      
      // Check if session exists first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found during sign out');
        setUser(null);
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        // If the error is 'session_not_found', we can just consider the user signed out
        if (error.message?.includes('session_not_found') || 
            error.message?.includes('Invalid Refresh Token')) {
          console.log('Session not found or invalid during sign out, clearing user state anyway');
          setUser(null);
          return;
        }
        
        console.error('Error signing out:', error);
        throw error;
      }
      
      console.log('Sign out successful');
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if there's an error, clear the user state
      setUser(null);
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      console.log('Requesting password reset for:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        console.error('Error requesting password reset:', error);
        throw error;
      }
      console.log('Password reset email sent');
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  };

  const resetPassword = async (password: string) => {
    try {
      console.log('Updating user password...');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('Error updating password:', error);
        throw error;
      }
      console.log('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    forgotPassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};