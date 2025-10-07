import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Building2, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ExternalLink,
  FileText,
  Mail,
  Phone,
  Globe,
  MapPin,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';

interface CompanyVerificationRequest {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  address?: string;
  phone?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_requested_at: string;
  verification_requested_by: string;
  verification_documents?: string[];
  member_count: number;
  created_by_name: string;
  created_by_email: string;
}

export const CompanyVerificationWorkflow: React.FC = () => {
  const [pendingVerifications, setPendingVerifications] = useState<CompanyVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingVerifications();
  }, []);

  const fetchPendingVerifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          website,
          industry,
          address,
          phone,
          verification_status,
          verification_requested_at,
          created_at,
          created_by,
          profiles!companies_created_by_fkey (
            first_name,
            last_name,
            email
          ),
          members:profiles!profiles_company_id_fkey (count)
        `)
        .eq('verification_status', 'pending')
        .order('verification_requested_at', { ascending: false });

      if (error) throw error;

      const processedData = data.map(company => ({
        id: company.id,
        name: company.name,
        website: company.website,
        industry: company.industry,
        address: company.address,
        phone: company.phone,
        verification_status: company.verification_status,
        verification_requested_at: company.verification_requested_at || company.created_at,
        verification_requested_by: company.created_by,
        member_count: company.members?.[0]?.count || 0,
        created_by_name: company.profiles ? 
          `${company.profiles.first_name} ${company.profiles.last_name}` : 
          'Unknown',
        created_by_email: company.profiles?.email || 'Unknown'
      }));

      setPendingVerifications(processedData);
    } catch (error: any) {
      console.error('Error fetching verification requests:', error);
      setError('Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationDecision = async (companyId: string, decision: 'verified' | 'rejected', reason?: string) => {
    try {
      setProcessing(companyId);
      setError(null);

      const { error } = await supabase
        .from('companies')
        .update({
          verification_status: decision,
          verification_completed_at: new Date().toISOString(),
          verification_completed_by: (await supabase.auth.getUser()).data.user?.id,
          verification_notes: reason
        })
        .eq('id', companyId);

      if (error) throw error;

      // Send notification to company creator
      const company = pendingVerifications.find(c => c.id === companyId);
      if (company) {
        await supabase
          .from('notifications')
          .insert({
            user_id: company.verification_requested_by,
            title: `Company Verification ${decision === 'verified' ? 'Approved' : 'Rejected'}`,
            message: `Your company "${company.name}" has been ${decision === 'verified' ? 'verified' : 'rejected'}.${reason ? ` Reason: ${reason}` : ''}`,
            type: decision === 'verified' ? 'company_verified' : 'company_rejected',
            reference_id: companyId
          });
      }

      // Remove from pending list
      setPendingVerifications(prev => prev.filter(c => c.id !== companyId));
      
    } catch (error: any) {
      console.error('Error processing verification:', error);
      setError('Failed to process verification decision');
    } finally {
      setProcessing(null);
    }
  };

  const verifyWebsite = async (website: string) => {
    try {
      const response = await fetch(`/api/verify-website?url=${encodeURIComponent(website)}`);
      return response.ok;
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Company Verification Requests</h2>
        <Button variant="outline" onClick={fetchPendingVerifications}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {pendingVerifications.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Pending Verifications</h3>
          <p className="text-gray-500">
            All company verification requests have been processed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingVerifications.map(company => (
            <div key={company.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <Building2 className="h-8 w-8 text-gray-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{company.name}</h3>
                    <p className="text-sm text-gray-500">
                      Requested by {company.created_by_name} ({company.created_by_email})
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(company.verification_requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-yellow-600">
                  <Clock className="h-4 w-4 mr-1" />
                  <span className="text-sm">Pending Review</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {company.industry && (
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="h-4 w-4 mr-2" />
                    <span>{company.industry}</span>
                  </div>
                )}
                
                {company.website && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2" />
                    <a 
                      href={company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      {company.website}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}
                
                {company.address && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>{company.address}</span>
                  </div>
                )}
                
                {company.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    <span>{company.phone}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Company Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{company.member_count}</p>
                    <p className="text-xs text-gray-500">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">
                      {Math.floor((Date.now() - new Date(company.verification_requested_at).getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                    <p className="text-xs text-gray-500">Days Old</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">
                      {company.website ? 'Yes' : 'No'}
                    </p>
                    <p className="text-xs text-gray-500">Website</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={() => handleVerificationDecision(company.id, 'verified')}
                  disabled={processing === company.id}
                  leftIcon={<CheckCircle className="h-4 w-4" />}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Verify Company
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    const reason = prompt('Enter reason for rejection (optional):');
                    if (reason !== null) {
                      handleVerificationDecision(company.id, 'rejected', reason);
                    }
                  }}
                  disabled={processing === company.id}
                  leftIcon={<AlertCircle className="h-4 w-4" />}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  Reject
                </Button>
                
                <Button
                  variant="outline"
                  leftIcon={<Mail className="h-4 w-4" />}
                  onClick={() => {
                    window.location.href = `mailto:${company.created_by_email}?subject=Company Verification: ${company.name}`;
                  }}
                >
                  Contact
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};