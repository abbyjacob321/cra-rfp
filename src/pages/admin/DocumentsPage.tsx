import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Document, RFP } from '../../types';
import { 
  FileUp, 
  Download, 
  Trash2, 
  RefreshCw, 
  Lock,
  FileText,
  File,
  Loader2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  Building2,
  CheckCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DocumentUploader } from '../../components/admin/DocumentUploader';
import { format } from 'date-fns';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [rfps, setRFPs] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [rfpFilter, setRfpFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [ndaFilter, setNdaFilter] = useState<boolean | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents'>('documents');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRFPs = async () => {
    try {
      const { data, error } = await supabase
        .from('rfps')
        .select('id, title, client_name')
        .order('title', { ascending: true });
        
      if (error) throw error;
      
      setRFPs(data || []);
    } catch (error) {
      console.error('Error fetching RFPs:', error);
      // Don't display this error to the user
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch RFPs for the filter dropdown
      await fetchRFPs();

      // Fetch documents with related RFP data
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          rfps (
            title,
            client_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDocuments(data as Document[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDocumentUploaded = (document: Document) => {
    setDocuments([document, ...documents]);
    
    // Show success message
    setSuccessMessage(`Document "${document.title}" uploaded successfully`);
    
    // Clear the success message and close uploader after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
      setShowUploader(false);
    }, 3000);
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('rfp-documents')
        .createSignedUrl(document.file_path, 60);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Failed to download document. Please try again.');
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      setDeletingId(documentId);
      setError(null);

      // Get the document to find its file path
      const { data: documentData, error: fetchError } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError) {
        console.error('Error fetching document for deletion:', fetchError);
        throw fetchError;
      }

      // Delete the document record from the database
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        console.error('Error deleting document record:', deleteError);
        throw deleteError;
      }

      // Delete the file from storage
      if (documentData && documentData.file_path) {
        const { error: storageError } = await supabase.storage
          .from('rfp-documents')
          .remove([documentData.file_path]);

        if (storageError) {
          console.warn('File deleted from database but not from storage:', storageError);
        }
      }

      // Update the UI
      setDocuments(documents.filter(doc => doc.id !== documentId));
      
      // Show success message
      setSuccessMessage(`Document deleted successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error deleting document:', error);
      setError('Failed to delete document: ' + (error.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <File className="h-6 w-6 text-red-500" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <File className="h-6 w-6 text-green-500" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <File className="h-6 w-6 text-blue-500" />;
    } else if (fileType.includes('image')) {
      return <File className="h-6 w-6 text-purple-500" />;
    } else {
      return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.rfps?.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRfp = !rfpFilter || doc.rfp_id === rfpFilter;
    const matchesType = !typeFilter || doc.file_type.includes(typeFilter);
    const matchesNda = ndaFilter === null || doc.requires_nda === ndaFilter;
    
    return matchesSearch && matchesRfp && matchesType && matchesNda;
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage RFP documents and attachments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {activeTab === 'documents' && (
            <Button
              size="sm"
              leftIcon={<FileUp className="h-4 w-4" />}
              onClick={() => setShowUploader(true)}
            >
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{successMessage}</p>
        </div>
      )}

      {showUploader && (
        <DocumentUploader
          rfpId={rfpFilter || 'all'} // Use 'all' to indicate no specific RFP is selected
          onUploadComplete={handleDocumentUploaded}
          onCancel={() => setShowUploader(false)}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            className="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-blue-500 text-blue-600"
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
        </nav>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {/* Search and filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search documents..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : ''}
              >
                Filters
              </Button>
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={fetchDocuments}
              >
                Refresh
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RFP
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={rfpFilter || ''}
                  onChange={(e) => setRfpFilter(e.target.value || null)}
                >
                  <option value="">All RFPs</option>
                  {rfps.map(rfp => (
                    <option key={rfp.id} value={rfp.id}>
                      {rfp.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Type
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={typeFilter || ''}
                  onChange={(e) => setTypeFilter(e.target.value || null)}
                >
                  <option value="">All Types</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="word">Word</option>
                  <option value="image">Images</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NDA Required
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={ndaFilter === null ? '' : ndaFilter.toString()}
                  onChange={(e) => setNdaFilter(e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">All Documents</option>
                  <option value="true">NDA Required</option>
                  <option value="false">No NDA Required</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Documents list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
              <p className="text-gray-600">Loading documents...</p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || rfpFilter || typeFilter || ndaFilter !== null
                ? "No documents match your search criteria"
                : "Upload documents to get started"}
            </p>
            <Button
              leftIcon={<FileUp className="h-4 w-4" />}
              onClick={() => setShowUploader(true)}
            >
              Upload First Document
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RFP
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Version
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getFileIcon(document.file_type)}
                        <div className="ml-4">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{document.title}</div>
                            {document.requires_nda && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <Lock className="h-3 w-3 mr-1" />
                                NDA Required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm text-gray-900">{document.rfps?.title || 'Unknown RFP'}</div>
                          <div className="text-sm text-gray-500">{document.rfps?.client_name || 'Unknown Client'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {document.file_type.split('/').pop()?.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      v{document.version}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(document.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Download className="h-4 w-4" />}
                          onClick={() => handleDownload(document)}
                        >
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          leftIcon={
                            deletingId === document.id ? 
                            <Loader2 className="h-4 w-4 animate-spin" /> : 
                            <Trash2 className="h-4 w-4" />
                          }
                          onClick={() => handleDelete(document.id)}
                          disabled={deletingId === document.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};