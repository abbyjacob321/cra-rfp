import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Document, RFP } from '../../types';
import { FileUp, Download, Trash2, RefreshCw, Lock, FileText, File, Loader2, AlertCircle, CheckCircle, FolderTree } from 'lucide-react';
import { Button } from '../ui/Button';
import { DocumentUploader } from './DocumentUploader';
import { format } from 'date-fns';

interface DocumentManagerProps {
  rfpId: string;
  showOrganizer?: boolean;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ rfpId, showOrganizer = false }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ndaStatus, setNdaStatus] = useState<{[key: string]: boolean}>({});
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (rfpId === 'new') {
        setDocuments([]);
        setLoading(false);
        return;
      }

      console.log('Fetching documents for RFP:', rfpId);
      
      let query = supabase
        .from('documents')
        .select(`
          *,
          rfps (
            title,
            client_name
          )
        `);
        
      // Filter by RFP if specified
      if (rfpId !== 'all') {
        query = query.eq('rfp_id', rfpId);
      }
      
      // Filter by folder if selected
      if (selectedFolder) {
        query = query.eq('parent_folder', selectedFolder);
      } else if (showOrganizer) {
        query = query.is('parent_folder', null);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching documents:', error);
        throw error;
      }

      console.log('Fetched documents:', data);
      setDocuments(data as Document[] || []);
      
      // Fetch NDA status for documents
      if (rfpId !== 'new' && rfpId !== 'all') {
        try {
          // Fixed: Don't use .single() as it throws an error if no records found
          // Instead, just handle empty data gracefully
          const { data: ndaData, error: ndaError } = await supabase
            .from('rfp_nda_access')
            .select('*')
            .eq('rfp_id', rfpId);
            
          if (ndaError) throw ndaError;
          
          if (ndaData && ndaData.length > 0) {
            const ndaMap: {[key: string]: boolean} = {};
            documents.forEach(doc => {
              ndaMap[doc.id] = doc.requires_nda;
            });
            setNdaStatus(ndaMap);
          }
        } catch (ndaError) {
          // Just log the NDA error but don't fail the whole document fetch
          console.error('Error fetching NDA status:', ndaError);
        }
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      setError('Failed to load documents: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rfpId !== 'new') {
      fetchDocuments();
    } else {
      setDocuments([]);
      setLoading(false);
    }
  }, [rfpId, selectedFolder]);

  const handleDocumentUploaded = (document: Document) => {
    // Add the new document to state
    setDocuments([document, ...documents]);
    
    // Show success message
    setSuccessMessage(`Document "${document.title}" uploaded successfully`);
    
    // Clear the success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
      // Only close the uploader after the success message has been shown
      setShowUploader(false);
    }, 3000);
  };

  const handleDownload = async (document: Document) => {
    try {
      // Get a signed URL for the file
      const { data, error } = await supabase.storage
        .from('rfp-documents')
        .createSignedUrl(document.file_path, 60); // URL valid for 60 seconds

      if (error) {
        console.error('Error getting signed URL:', error);
        throw error;
      }

      // Open the download URL
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Error downloading document:', error);
      alert('Failed to download document: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      setDeletingId(documentId);
      setError(null);

      // First, get the document to find its file path
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
      console.log('Document deleted successfully');
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

  if (loading && documents.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          {showOrganizer ? 'Document Management' : 'RFP Documents'}
        </h2>
        {rfpId !== 'new' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchDocuments}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              leftIcon={<FileUp className="h-4 w-4" />}
              onClick={() => setShowUploader(true)}
            >
              Upload Document
            </Button>
          </div>
        )}
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
          rfpId={rfpId}
          parentFolder={selectedFolder}
          onUploadComplete={handleDocumentUploaded} 
          onCancel={() => setShowUploader(false)}
        />
      )}

      {/* Folder Navigation */}
      {showOrganizer && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 flex items-center gap-4">
          <FolderTree className="h-5 w-5 text-gray-400" />
          <div className="flex-grow">
            <div className="text-sm font-medium text-gray-700">
              {selectedFolder ? 'Current Folder' : 'Root'}
            </div>
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Back to Root
              </button>
            )}
          </div>
        </div>
      )}

      {rfpId === 'new' ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Save RFP First</h3>
          <p className="text-gray-500 mb-4">
            Please save the RFP before adding documents.
          </p>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No documents uploaded yet</h3>
          <p className="text-gray-500 mb-4">
            Upload RFP documents like forms, templates, and supporting materials
          </p>
          <Button
            leftIcon={<FileUp className="h-4 w-4" />}
            onClick={() => setShowUploader(true)}
          >
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {documents.map((document) => {
              const isUsersQuestion = true;
              const hasAnswer = false;
              
              return (
                <li key={document.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-2">
                      {getFileIcon(document.file_type)}
                      <div>
                        <h4 className="font-medium text-gray-900">{document.title}</h4>
                        <div className="flex items-center mt-1 space-x-2">
                          {document.requires_nda && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 inline-flex items-center">
                              <Lock className="h-3 w-3 mr-1" />
                              Requires NDA
                            </span>
                          )}
                          
                          <span className="text-xs text-gray-500">
                            Version {document.version}
                          </span>
                          
                          <span className="text-xs text-gray-500">
                            Added {formatDate(document.created_at)}
                          </span>
                          
                          {showOrganizer && document.rfps && (
                            <span className="text-xs text-gray-500">
                              {document.rfps.title}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 flex items-center space-x-2">
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
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};