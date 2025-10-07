import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RFP, Document, NDA } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  FileText, 
  Lock, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  Building2,
  Users,
  User,
  Briefcase
} from 'lucide-react';
import { Button } from '../components/ui/Button';

interface CompanyNDA {
  id: string;
  company_id: string;
  rfp_id: string;
  status: 'signed' | 'approved' | 'rejected';
  signed_at: string;
  signed_by: string;
  full_name: string;
  title: string;
  countersigned_at?: string;
  countersigner_name?: string;
  countersigner_title?: string;
  rejection_reason?: string;
  rejection_date?: string;
}

export const RFPNdaPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [rfp, setRFP] = useState<RFP | null>(null);
  const [ndaDocument, setNdaDocument] = useState<Document | null>(null);
  const [existingNda, setExistingNda] = useState<NDA | null>(null);
  const [existingCompanyNda, setExistingCompanyNda] = useState<CompanyNDA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [ndaType, setNdaType] = useState<'individual' | 'company'>('individual');
  
  useEffect(() => {
    const fetchRFPAndNdaData = async () => {
      try {
        if (!id) {
          setError('Invalid RFP ID');
          setLoading(false);
          return;
        }
        
        if (!user) {
          navigate('/login', { state: { returnUrl: `/rfps/${id}/nda` } });
          return;
        }
        
        setLoading(true);
        setError(null);
        
        // Fetch RFP details
        const { data: rfpData, error: rfpError } = await supabase
          .from('rfps')
          .select('*')
          .eq('id', id)
          .single();
          
        if (rfpError) throw rfpError;
        
        setRFP(rfpData);
        
        // Fetch NDA document
        const { data: ndaDocs, error: ndaDocsError } = await supabase
          .from('documents')
          .select('*')
          .eq('rfp_id', id)
          .eq('requires_nda', true)
          .limit(1);
          
        if (ndaDocsError) throw ndaDocsError;
        
        if (ndaDocs && ndaDocs.length > 0) {
          setNdaDocument(ndaDocs[0]);
        }
        
        // Check for existing individual NDA
        const { data: existingNdaData, error: existingNdaError } = await supabase
          .from('rfp_nda_access')
          .select('*')
          .eq('rfp_id', id)
          .eq('user_id', user.id)
          .single();
          
        if (existingNdaData && !existingNdaError) {
          setExistingNda(existingNdaData);
        }
        
        // If user has a company association, check for company NDA
        if (user.company_id) {
          const { data: companyNdaData, error: companyNdaError } = await supabase
            .from('company_ndas')
            .select('*')
            .eq('rfp_id', id)
            .eq('company_id', user.company_id)
            .single();
            
          if (companyNdaData && !companyNdaError) {
            setExistingCompanyNda(companyNdaData);
          }
          
          // Pre-fill name and title fields
          setFullName(`${user.first_name} ${user.last_name}`);
          setTitle(user.title || '');
        } else {
          // No company association, default to individual NDA
          setNdaType('individual');
          setFullName(`${user.first_name} ${user.last_name}`);
        }
        
      } catch (error) {
        console.error('Error fetching NDA data:', error);
        setError('Failed to load NDA information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRFPAndNdaData();
  }, [id, user, navigate]);
  
  const handleSignNda = async () => {
    if (!agreementChecked) {
      setError('You must agree to the terms of the NDA to continue');
      return;
    }
    
    if (!fullName.trim() || !title.trim()) {
      setError('Please enter your name and title');
      return;
    }
    
    if (!user || !rfp) {
      setError('Missing required information to sign NDA');
      return;
    }
    
    try {
      setSigning(true);
      setError(null);
      
      // Create signature data
      const signatureData = {
        type: 'text',
        name: fullName.trim(),
        title: title.trim(),
        timestamp: new Date().toISOString(),
        ip: null // This will be captured by the backend
      };
      
      if (ndaType === 'company') {
        // Check if user has company admin privileges
        if (!user.company_id || user.company_role !== 'admin') {
          throw new Error('You must be a company administrator to sign an NDA on behalf of your company');
        }
        
        // Sign company NDA
        const { data, error } = await supabase.rpc('sign_company_nda', {
          p_company_id: user.company_id,
          p_rfp_id: rfp.id,
          p_full_name: fullName.trim(),
          p_title: title.trim(),
          p_signature_data: signatureData
        });
        
        if (error) throw error;
        
        // Update company NDA state
        setExistingCompanyNda(data);
        
      } else {
        // Sign individual NDA
        await supabase
          .from('rfp_nda_access')
          .upsert({
            rfp_id: rfp.id,
            user_id: user.id,
            full_name: fullName.trim(),
            title: title.trim(),
            company: user.company,
            signature_data: signatureData
          });
        
        // Update individual NDA state
        setExistingNda({
          id: 'new-nda-' + Date.now(),
          rfp_id: rfp.id,
          user_id: user.id,
          document_id: ndaDocument?.id || null,
          status: 'signed',
          signed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          full_name: fullName.trim(),
          title: title.trim(),
          company: user.company,
          signature_data: signatureData
        });
      }
      
    } catch (error: any) {
      console.error('Error signing NDA:', error);
      setError(error.message || 'Failed to sign NDA. Please try again.');
    } finally {
      setSigning(false);
    }
  };
  
  const handleDownloadNda = async () => {
    if (!ndaDocument) return;
    
    try {
      // In production, get a signed URL from Supabase Storage
      const { data, error } = await supabase.storage
        .from('rfp-documents')
        .createSignedUrl(ndaDocument.file_path, 60);
      
      if (error) throw error;
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading NDA:', error);
      setError('Failed to download NDA document');
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading NDA information...</p>
        </div>
      </div>
    );
  }
  
  if (!rfp) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">RFP Not Found</h3>
        <p className="text-gray-500 mb-6">
          We couldn't find the RFP you're looking for.
        </p>
        <Link to="/rfps">
          <Button>Browse RFPs</Button>
        </Link>
      </div>
    );
  }
  
  // If the user or their company has already signed the NDA
  if ((existingNda && existingNda.signed_at) || existingCompanyNda) {
    const isCompanySigned = !!existingCompanyNda;
    const ndaData = isCompanySigned ? existingCompanyNda : existingNda;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Link to={`/rfps/${id}`} className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">NDA Status</h1>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isCompanySigned ? 'Company NDA Signed' : 'NDA Successfully Signed'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              {isCompanySigned
                ? `Your company has signed the Non-Disclosure Agreement for this RFP. All company members have access to protected content.`
                : `You have signed the Non-Disclosure Agreement for this RFP. You now have access to all protected content.`}
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-left mb-6">
              <div className="flex items-center mb-3">
                {isCompanySigned ? (
                  <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                ) : (
                  <User className="h-5 w-5 text-gray-400 mr-2" />
                )}
                
                <h4 className="font-medium text-gray-900">
                  {isCompanySigned 
                    ? `${user?.company} - Company NDA` 
                    : `Individual NDA`}
                </h4>
              </div>
              
              <p className="text-gray-700 text-sm mb-2">
                <span className="font-medium">RFP:</span> {rfp.title}
              </p>
              
              <p className="text-gray-700 text-sm mb-2">
                <span className="font-medium">Signed by:</span> {ndaData?.full_name}
              </p>
              
              <p className="text-gray-700 text-sm mb-2">
                <span className="font-medium">Title:</span> {ndaData?.title}
              </p>
              
              <p className="text-gray-700 text-sm">
                <span className="font-medium">Signed on:</span> {new Date(ndaData?.signed_at || '').toLocaleDateString()}
              </p>
              
              {ndaData?.countersigned_at && (
                <p className="text-gray-700 text-sm mt-2">
                  <span className="font-medium">Countersigned by:</span> {ndaData.countersigner_name} ({ndaData.countersigner_title}) on {new Date(ndaData.countersigned_at).toLocaleDateString()}
                </p>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={handleDownloadNda}
              >
                Download NDA Document
              </Button>
              <Link to={`/rfps/${id}`}>
                <Button>
                  Return to RFP Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // NDA signing form
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link to={`/rfps/${id}`} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Non-Disclosure Agreement</h1>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">NDA Document</h2>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={handleDownloadNda}
              >
                Download
              </Button>
            </div>
            
            <div className="p-6">
              <div className="prose prose-blue max-w-none">
                <h3>Non-Disclosure Agreement</h3>
                <p>This Non-Disclosure Agreement (this "Agreement") is made as of the date of electronic signature by and between:</p>
                <p><strong>{rfp.client_name}</strong> ("Disclosing Party"), and</p>
                <p><strong>{ndaType === 'company' ? user?.company : `${user?.first_name} ${user?.last_name}`}</strong> {ndaType === 'company' ? '(the "Company")' : `from <strong>${user?.company || 'Independent'}</strong>`} ("Receiving Party").</p>
                
                <p>WHEREAS, the Disclosing Party intends to disclose certain confidential information (the "Confidential Information") to the Receiving Party in connection with potential bidding on the "<strong>{rfp.title}</strong>" Request for Proposals (the "RFP").</p>
                
                <h4>1. Definition of Confidential Information</h4>
                <p>For purposes of this Agreement, "Confidential Information" means any data or information that is proprietary to the Disclosing Party and not generally known to the public, whether in tangible or intangible form, including, but not limited to:</p>
                <ul>
                  <li>Technical specifications and requirements</li>
                  <li>Site-specific information and data</li>
                  <li>Business strategies and plans</li>
                  <li>Financial projections and models</li>
                  <li>Customer information</li>
                  <li>Any other information marked as "confidential" or which should reasonably be understood to be confidential</li>
                </ul>
                
                <h4>2. Obligations of Receiving Party</h4>
                <p>The Receiving Party shall:</p>
                <ol type="a">
                  <li>Maintain the confidentiality of the Confidential Information;</li>
                  <li>Not disclose any Confidential Information to any person or entity other than employees, agents, or representatives who need to know such information and who have agreed to maintain its confidentiality;</li>
                  <li>Use the Confidential Information solely for the purpose of evaluating and preparing a bid in response to the RFP;</li>
                  <li>Return or destroy all Confidential Information upon request by the Disclosing Party or upon termination of this Agreement.</li>
                </ol>
                
                <h4>3. Term</h4>
                <p>This Agreement shall remain in effect for a period of three (3) years from the date of signature, or until the Confidential Information becomes publicly available through no fault of the Receiving Party, whichever occurs first.</p>
                
                <h4>4. Governing Law</h4>
                <p>This Agreement shall be governed by and construed in accordance with the laws of the state of Washington, without regard to conflicts of law principles.</p>
                
                <h4>5. Electronic Signature</h4>
                <p>By checking the acceptance box and clicking "Sign NDA" below, the Receiving Party acknowledges that they have read, understand, and agree to be bound by the terms of this Agreement. This electronic signature shall have the same legal effect as a handwritten signature.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Accept Agreement</h3>
            
            {/* NDA Type Selection (Individual or Company) */}
            {user?.company_id && user?.company_role === 'admin' && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Sign NDA as:</h4>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 border-gray-300">
                    <input
                      type="radio"
                      name="nda-type"
                      value="individual"
                      checked={ndaType === 'individual'}
                      onChange={() => setNdaType('individual')}
                      className="h-4 w-4 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900">Individual NDA</span>
                      <span className="block text-xs text-gray-500">Sign as {user?.first_name} {user?.last_name}</span>
                      <span className="block text-xs text-gray-500">Access limited to your account only</span>
                    </div>
                  </label>
                  
                  <label className="flex items-start p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 border-gray-300">
                    <input
                      type="radio"
                      name="nda-type"
                      value="company"
                      checked={ndaType === 'company'}
                      onChange={() => setNdaType('company')}
                      className="h-4 w-4 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900">Company NDA</span>
                      <span className="block text-xs text-gray-500">Sign on behalf of {user?.company}</span>
                      <span className="block text-xs text-gray-500">All company members will have access</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
              <div className="flex items-center space-x-3 mb-3">
                <Lock className="h-5 w-5 text-blue-500" />
                <h4 className="font-medium text-gray-900">Protected Content</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                This RFP contains confidential information that requires a signed NDA to access. By signing, you'll gain access to:
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                  <span>Confidential technical specifications</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                  <span>Protected documents and files</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                  <span>Sensitive business information</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title / Position
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              {ndaType === 'company' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={user?.company || ''}
                    disabled
                    className="block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    You're signing this NDA on behalf of your company.
                  </p>
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementChecked}
                  onChange={(e) => setAgreementChecked(e.target.checked)}
                  className="h-5 w-5 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-600">
                  I have read and agree to the terms of the Non-Disclosure Agreement. I understand that checking this box constitutes a legal signature.
                </span>
              </label>
            </div>
            
            <Button
              fullWidth
              onClick={handleSignNda}
              disabled={!agreementChecked || signing || !fullName.trim() || !title.trim()}
              leftIcon={signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              isLoading={signing}
            >
              {signing ? 'Signing...' : ndaType === 'company' ? 'Sign Company NDA' : 'Sign NDA'}
            </Button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              By signing this NDA, you agree to keep all confidential information secure and to use it only for the purpose of responding to this RFP.
              {ndaType === 'company' && ' This NDA will apply to all members of your company.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};