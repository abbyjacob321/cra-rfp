import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Search,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowRight,
  Loader2,
  Plus,
  MapPin,
  Globe,
  Library,
  Lightbulb,
  Mail,
  Users,
  Star
} from 'lucide-react';
import { Button } from '../ui/Button';

interface CompanySearchResult {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  member_count: number;
  location?: string;
  verified?: boolean;
  suggested_reason?: string;
}

export const ImprovedJoinCompanyFlow: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [suggestedCompanies, setSuggestedCompanies] = useState<CompanySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [currentStep, setCurrentStep] = useState<'discover' | 'select' | 'create'>('discover');
  
  // For the "create new company" flow
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyStateOfIncorporation, setNewCompanyStateOfIncorporation] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  
  // Load suggestions based on user's email domain
  useEffect(() => {
    if (user?.email) {
      loadEmailDomainSuggestions();
    }
  }, [user]);
  
  const loadEmailDomainSuggestions = async () => {
    try {
      const emailDomain = user?.email.split('@')[1];
      if (!emailDomain || emailDomain === 'gmail.com' || emailDomain === 'yahoo.com' || emailDomain === 'hotmail.com') {
        return; // Skip common email providers
      }
      
      // Search for companies with similar domain
      const { data, error } = await supabase.rpc('search_companies', {
        search_term: emailDomain.split('.')[0] // Use the company part of domain
      });
      
      if (error) throw error;
      
      const suggestions = (data || []).map((company: any) => ({
        ...company,
        suggested_reason: `Matches your email domain (${emailDomain})`
      }));
      
      setSuggestedCompanies(suggestions.slice(0, 3)); // Limit to top 3 suggestions
    } catch (error) {
      console.error('Error loading domain suggestions:', error);
    }
  };
  
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Call the search_companies function with improved fuzzy matching
      const { data, error } = await supabase.rpc('search_companies', {
        search_term: searchTerm.trim()
      });
      
      if (error) throw error;
      
      setSearchResults(data || []);
    } catch (error: any) {
      console.error('Error searching companies:', error);
      setError(`Search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleJoinRequest = async () => {
    if (!selectedCompany) return;
    
    try {
      setRequestSending(true);
      setError(null);
      
      // Call the request_to_join_company function
      const { data, error } = await supabase.rpc('request_to_join_company', {
        p_company_id: selectedCompany.id,
        p_message: joinMessage.trim() || null
      });
      
      if (error) throw error;
      
      // Success
      setSuccess(`Your request to join ${selectedCompany.name} has been submitted. You'll be notified once it's approved.`);
      setSelectedCompany(null);
      setJoinMessage('');
      setCurrentStep('discover');
    } catch (error: any) {
      console.error('Error requesting to join company:', error);
      setError(error.message || 'Failed to submit join request');
    } finally {
      setRequestSending(false);
    }
  };
  
  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      setError('Company name is required');
      return;
    }
    
    try {
      setCreateLoading(true);
      setError(null);
      
      // Call the create_company function
      const { data, error } = await supabase.rpc('create_company', {
        p_name: newCompanyName.trim(),
        p_website: newCompanyWebsite.trim() || null,
        p_industry: newCompanyIndustry.trim() || null,
        p_address: newCompanyAddress.trim() || null,
        p_state_of_incorporation: newCompanyStateOfIncorporation.trim() || null
      });
      
      if (error) throw error;
      
      // Success
      setSuccess(`Company "${newCompanyName}" created successfully! You are now the company administrator.`);
      
      // Refresh user session to get updated role
      await supabase.auth.refreshSession();
      
      // Refresh the page
      window.location.reload();
    } catch (error: any) {
      console.error('Error creating company:', error);
      setError(error.message || 'Failed to create company');
    } finally {
      setCreateLoading(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        handleSearch();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-8">
      <div className={`w-3 h-3 rounded-full ${currentStep === 'discover' ? 'bg-blue-600' : 'bg-gray-300'}`} />
      <div className={`w-8 h-1 ${currentStep !== 'discover' ? 'bg-blue-600' : 'bg-gray-300'}`} />
      <div className={`w-3 h-3 rounded-full ${currentStep === 'select' ? 'bg-blue-600' : 'bg-gray-300'}`} />
      <div className={`w-8 h-1 ${currentStep === 'create' ? 'bg-blue-600' : 'bg-gray-300'}`} />
      <div className={`w-3 h-3 rounded-full ${currentStep === 'create' ? 'bg-blue-600' : 'bg-gray-300'}`} />
    </div>
  );
  
  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Success!</h3>
          <p className="text-gray-600">{success}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {renderStepIndicator()}
      
      {currentStep === 'discover' && (
        <div className="space-y-6">
          {/* Email Domain Suggestions */}
          {suggestedCompanies.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <div className="flex items-center mb-4">
                <Lightbulb className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-medium text-blue-800">Suggested for You</h3>
              </div>
              <p className="text-blue-700 text-sm mb-4">
                Based on your email address, these companies might be relevant:
              </p>
              <div className="space-y-3">
                {suggestedCompanies.map(company => (
                  <div 
                    key={company.id}
                    className="bg-white rounded-lg p-4 border border-blue-200 hover:border-blue-300 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCompany(company);
                      setCurrentStep('select');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Building2 className="h-6 w-6 text-blue-600 mr-3" />
                        <div>
                          <h4 className="font-medium text-gray-900">{company.name}</h4>
                          <p className="text-sm text-blue-600">{company.suggested_reason}</p>
                          {company.industry && (
                            <p className="text-xs text-gray-500">{company.industry} • {company.member_count} members</p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Search Interface */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Find Your Company
            </h3>
            
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by company name, domain, or industry..."
                  className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              )}
              
              {!loading && searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <ul className="divide-y divide-gray-200">
                    {searchResults.map(company => (
                      <li 
                        key={company.id} 
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedCompany(company);
                          setCurrentStep('select');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center">
                              <Building2 className="h-6 w-6 text-gray-600" />
                            </div>
                            <div className="ml-3">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">{company.name}</p>
                                {company.verified && (
                                  <Star className="h-4 w-4 text-blue-500 ml-2" />
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                                {company.industry && <span>{company.industry}</span>}
                                <span className="flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  {company.member_count} members
                                </span>
                                {company.location && (
                                  <span className="flex items-center">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {company.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {!loading && searchTerm && searchResults.length === 0 && (
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No companies found matching "{searchTerm}"</p>
                  <Button
                    leftIcon={<Plus className="h-4 w-4" />}
                    variant="outline"
                    onClick={() => {
                      setCurrentStep('create');
                      setNewCompanyName(searchTerm);
                    }}
                  >
                    Create "{searchTerm}"
                  </Button>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Don't see your company listed?
              </p>
              <Button
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setCurrentStep('create')}
              >
                Create New Company
              </Button>
            </div>
          </div>
          
          {/* Information Panel */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
              <div>
                <h4 className="text-base font-medium text-blue-900 mb-2">Why join a company?</h4>
                <ul className="space-y-2 text-sm text-blue-700 list-disc pl-5">
                  <li>Collaborate with team members on RFP responses</li>
                  <li>Company-level NDAs apply to all members automatically</li>
                  <li>Centralized proposal and bid management</li>
                  <li>Shared access to RFP documents and communications</li>
                  <li>Streamlined administrative processes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {currentStep === 'select' && selectedCompany && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-blue-800">Request to Join {selectedCompany.name}</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentStep('discover')}
              >
                Back to Search
              </Button>
            </div>
            <p className="mt-1 text-sm text-blue-600">
              Your request will be reviewed by the company administrators.
            </p>
          </div>
          
          <div className="p-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-blue-600" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center">
                    <h4 className="text-base font-medium">{selectedCompany.name}</h4>
                    {selectedCompany.verified && (
                      <Star className="h-4 w-4 text-blue-500 ml-2" />
                    )}
                  </div>
                  <div className="flex space-x-4 text-sm text-gray-500 mt-1">
                    {selectedCompany.industry && (
                      <span>{selectedCompany.industry}</span>
                    )}
                    {selectedCompany.website && (
                      <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                        <Globe className="h-3 w-3 mr-1" />
                        {selectedCompany.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <span className="flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {selectedCompany.member_count} members
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message to Company Administrators
              </label>
              <textarea
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                rows={4}
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="Introduce yourself and explain why you want to join this company..."
              />
              <p className="mt-1 text-xs text-gray-500">
                This message will help administrators understand your request and make a decision.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <Button
                onClick={handleJoinRequest}
                disabled={requestSending}
                isLoading={requestSending}
                leftIcon={requestSending ? undefined : <ArrowRight className="h-4 w-4" />}
              >
                {requestSending ? 'Submitting...' : 'Submit Request'}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setCurrentStep('discover')}
                disabled={requestSending}
              >
                Back to Search
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {currentStep === 'create' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-green-800">Create a New Company</h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentStep('discover')}
              >
                Back to Search
              </Button>
            </div>
            <p className="mt-1 text-sm text-green-600">
              You'll be set as the company administrator and can invite team members.
            </p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={newCompanyIndustry}
                  onChange={(e) => setNewCompanyIndustry(e.target.value)}
                >
                  <option value="">Select industry</option>
                  <option value="Energy">Energy</option>
                  <option value="Renewable Energy">Renewable Energy</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Construction">Construction</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Technology">Technology</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Website
                </label>
                <div className="flex items-center">
                  <Globe className="h-5 w-5 text-gray-400 mr-2" />
                  <input
                    type="url"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={newCompanyWebsite}
                    onChange={(e) => setNewCompanyWebsite(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State of Incorporation
                </label>
                <div className="flex items-center">
                  <Library className="h-5 w-5 text-gray-400 mr-2" />
                  <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={newCompanyStateOfIncorporation}
                    onChange={(e) => setNewCompanyStateOfIncorporation(e.target.value)}
                    placeholder="e.g., Delaware, California"
                  />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Address
                </label>
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={newCompanyAddress}
                    onChange={(e) => setNewCompanyAddress(e.target.value)}
                    placeholder="123 Main St, Suite 100, City, State, ZIP"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mt-6">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium text-blue-800">As a company administrator, you'll be able to:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Invite other team members to join</li>
                    <li>Sign NDAs on behalf of the entire company</li>
                    <li>Manage company information and settings</li>
                    <li>Approve or reject join requests from other users</li>
                    <li>Access company-wide RFP analytics and reports</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 pt-6">
              <Button
                onClick={handleCreateCompany}
                disabled={createLoading || !newCompanyName.trim()}
                isLoading={createLoading}
                leftIcon={createLoading ? undefined : <Building2 className="h-4 w-4" />}
              >
                {createLoading ? 'Creating...' : 'Create Company'}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setCurrentStep('discover')}
                disabled={createLoading}
              >
                Back to Search
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};