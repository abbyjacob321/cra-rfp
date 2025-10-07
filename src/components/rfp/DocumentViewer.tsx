import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Document, NDA } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FileText, Download, Lock, File, Loader2, AlertCircle, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface DocumentViewerProps {
  rfpId: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ rfpId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [ndaStatus, setNdaStatus] = useState<{[key: string]: NDA | null}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocumentsAndNdaStatus = async () => {
      if (!rfpId) return;

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching documents for RFP:', rfpId);
        
        // Fetch documents from Supabase
        const { data: documentData, error: documentError } = await supabase
          .from('documents')
          .select(`
            id,
            rfp_id,
            title,
            file_path,
            file_type,
            requires_nda,
            version,
            created_at,
            updated_at
          `)
          .eq('rfp_id', rfpId)
          .order('created_at', { ascending: false });
        
        if (documentError) {
          console.error('Error fetching documents:', documentError);
          throw documentError;
        }
        
        console.log(`Fetched ${documentData?.length || 0} documents:`, documentData);
        setDocuments(documentData || []);
        
        // For authenticated users, check NDA status
        if (user) {
          try {
            // Check individual NDA status
            const { data: ndaData, error: ndaError } = await supabase
              .from('rfp_nda_access')
              .select('*')
              .eq('rfp_id', rfpId)
              .eq('user_id', user.id);
            
            if (ndaError) {
              console.warn('Error checking NDA status:', ndaError);
            } else {
              // For each document that requires NDA, check if the user has access
              const protectedDocIds = (documentData || [])
                .filter(doc => doc.requires_nda)
                .map(doc => doc.id);
              
              const ndaStatusMap: {[key: string]: NDA | null} = {};
              
              if (ndaData && ndaData.length > 0) {
                // User has an NDA for this RFP
                const userNda = ndaData[0];
                
                // Apply the NDA to all protected documents
                protectedDocIds.forEach(docId => {
                  ndaStatusMap[docId] = userNda;
                });
              }
              
              // Also check for company NDA if user has a company
              if (user.company_id) {
                const { data: companyNdaData, error: companyNdaError } = await supabase
                  .from('company_ndas')
                  .select('*')
                  .eq('rfp_id', rfpId)
                  .eq('company_id', user.company_id)
                  .eq('status', 'approved');
                
                if (!companyNdaError && companyNdaData && companyNdaData.length > 0) {
                  // Company has an approved NDA for this RFP
                  protectedDocIds.forEach(docId => {
                    // Only set if not already set by individual NDA
                    if (!ndaStatusMap[docId]) {
                      ndaStatusMap[docId] = companyNdaData[0] as unknown as NDA;
                    }
                  });
                }
              }
              
              setNdaStatus(ndaStatusMap);
            }
          } catch (ndaCheckError) {
            console.warn('Error checking NDA status:', ndaCheckError);
            // Don't fail the whole component if just NDA status check fails
          }
        }
      } catch (error: any) {
        console.error('Error in fetchDocumentsAndNdaStatus:', error);
        setError('Failed to load documents. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentsAndNdaStatus();
  }, [rfpId, user]);

  const handleDownload = async (document: Document) => {
    try {
      if (document.requires_nda && (!user || !ndaStatus[document.id]?.signed_at)) {
        // If document requires NDA and user hasn't signed it, redirect to NDA page
        if (!user) {
          navigate('/login', { state: { returnUrl: `/rfps/${rfpId}` } });
          return;
        }
        navigate(`/rfps/${rfpId}/nda`);
        return;
      }

      // Get signed URL from Supabase Storage
      const { data, error } = await supabase.storage
        .from('rfp-documents')
        .createSignedUrl(document.file_path, 60); // URL valid for 60 seconds

      if (error) {
        console.error('Error getting download URL:', error);
        throw error;
      }

      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Error downloading document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <File className="h-5 w-5 text-red-500" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <File className="h-5 w-5 text-green-500" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <File className="h-5 w-5 text-blue-500" />;
    } else if (fileType.includes('image')) {
      return <File className="h-5 w-5 text-purple-500" />;
    } else {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="flex flex-col items-center">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
          <p className="text-sm text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">No documents available for this RFP.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Documents</h3>
      </div>
      
      <div className="p-6">
        <ul className="space-y-4">
          {documents.map((document) => {
            const requiresNda = document.requires_nda;
            const requiresApproval = document.requires_approval;
            const hasSignedNda = ndaStatus[document.id]?.signed_at;
            
            return (
              <li key={document.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getFileIcon(document.file_type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {document.title}
                        </p>
                        {requiresNda && (
                          <Lock className="h-4 w-4 text-amber-500" title="Requires NDA" />
                        )}
                        {requiresApproval && (
                          <Users className="h-4 w-4 text-purple-500" title="Requires Access Approval" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {document.file_type} • Version {document.version} • {formatDate(document.created_at)}
                      </p>
                      {requiresNda && !hasSignedNda && (
                        <p className="text-xs text-amber-600 mt-1">
                          NDA signature required to access this document
                        </p>
                      )}
                      {requiresApproval && (
                        <p className="text-xs text-purple-600 mt-1">
                          Company registration approval required
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 sm:mt-0 sm:ml-4">
                    {requiresNda && !hasSignedNda ? (
                      !user ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Link to="/login" state={{ returnUrl: `/rfps/${rfpId}` }}>
                            <Button variant="outline" size="sm">
                              Log in
                            </Button>
                          </Link>
                          <Link to={`/rfps/${rfpId}/nda`}>
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Lock className="h-4 w-4" />}
                            >
                              Sign NDA to access
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <Link to={`/rfps/${rfpId}/nda`}>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Lock className="h-4 w-4" />}
                          >
                            Sign NDA to access
                          </Button>
                        </Link>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Download className="h-4 w-4" />}
                        onClick={() => handleDownload(document)}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};