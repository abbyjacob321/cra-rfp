import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Document, RFP } from '../../types';
import { FileUp, X, Loader2, FileText, File, Lock, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { Button } from '../ui/Button';

interface DocumentUploaderProps {
  rfpId?: string;
  parentFolder?: string | null;
  onUploadComplete: (document: Document) => void;
  onCancel: () => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  rfpId,
  parentFolder,
  onUploadComplete,
  onCancel
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [requiresNda, setRequiresNda] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRfpId, setSelectedRfpId] = useState<string>(rfpId || '');
  const [availableRfps, setAvailableRfps] = useState<RFP[]>([]);
  const [loadingRfps, setLoadingRfps] = useState(false);

  useEffect(() => {
    // If rfpId is provided, use it as the selected RFP
    if (rfpId && rfpId !== 'new' && rfpId !== 'all') {
      setSelectedRfpId(rfpId);
    }
    
    // If no rfpId is provided or it's 'all', fetch available RFPs
    if (!rfpId || rfpId === 'all') {
      fetchAvailableRfps();
    }
  }, [rfpId]);

  // Fetch available RFPs for the dropdown
  const fetchAvailableRfps = async () => {
    try {
      setLoadingRfps(true);
      
      const { data, error } = await supabase
        .from('rfps')
        .select('id, title, client_name, status')
        .order('title', { ascending: true });
        
      if (error) throw error;
      
      // Filter out draft RFPs for non-admin users
      const filteredRfps = data || [];
      
      console.log('Available RFPs:', filteredRfps);
      setAvailableRfps(filteredRfps);
    } catch (error) {
      console.error('Error fetching RFPs:', error);
      setError('Failed to load RFPs. Please refresh and try again.');
    } finally {
      setLoadingRfps(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Set a default title based on the filename (without extension)
      const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
      setTitle(fileName);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      // Set a default title based on the filename (without extension)
      const fileName = droppedFile.name.split('.').slice(0, -1).join('.');
      setTitle(fileName);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <File className="h-8 w-8 text-red-500" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <File className="h-8 w-8 text-green-500" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <File className="h-8 w-8 text-blue-500" />;
    } else if (fileType.includes('image')) {
      return <File className="h-8 w-8 text-purple-500" />;
    } else {
      return <FileText className="h-8 w-8 text-gray-500" />;
    }
  };

  const getFileTypeName = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return 'PDF Document';
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return 'Excel Spreadsheet';
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return 'Word Document';
    } else if (fileType.includes('image')) {
      return 'Image';
    } else {
      return 'Document';
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('Please select a file and provide a title');
      return;
    }

    // Validate rfpId is present
    const effectiveRfpId = selectedRfpId || rfpId;
    if (!effectiveRfpId || effectiveRfpId === 'new') {
      setError('Please select an RFP to associate this document with.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(false);

      console.log('Starting file upload for RFP:', effectiveRfpId);

      // 1. Upload the file to Supabase Storage
      const fileExt = file.name.split('.').pop() || '';
      const timestamp = Date.now();
      const filePath = `${effectiveRfpId}/${timestamp}.${fileExt}`;
      
      console.log('Uploading to path:', filePath);
      
      const { data: storageData, error: storageError } = await supabase.storage
        .from('rfp-documents')
        .upload(filePath, file);

      if (storageError) {
        console.error('Storage upload error:', storageError);
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      console.log('File uploaded successfully:', storageData);

      // 2. Create a record in the documents table
      const documentData: Partial<Document> = {
        title: title.trim(),
        file_path: filePath,
        file_type: file.type,
        requires_nda: requiresNda,
        requires_approval: requiresApproval,
        version: 1,
        parent_folder: parentFolder || null,
        rfp_id: effectiveRfpId
      };

      console.log('Creating document record:', documentData);

      const { data: insertedDoc, error: documentError } = await supabase
        .from('documents')
        .insert(documentData)
        .select('*')
        .single();

      if (documentError) {
        console.error('Document record creation error:', documentError);
        throw new Error(`Document record creation failed: ${documentError.message}`);
      }

      console.log('Document record created successfully:', insertedDoc);
      
      // Show success state
      setSuccess(true);
      
      // Allow user to see success message before completing (3 seconds)
      setTimeout(() => {
        // Call the callback with the updated document
        onUploadComplete(insertedDoc as Document);
      }, 3000);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      setError(`Failed to upload document: ${error.message || 'Unknown error'}`);
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Upload Document</h3>
        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-500"
          disabled={uploading}
        >
          <span className="sr-only">Close</span>
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md mb-4 flex items-start">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">Document uploaded successfully! Processing...</p>
        </div>
      )}
      
      <div className="space-y-4">
        {file ? (
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <div className="flex items-center">
              {getFileIcon(file.type)}
              <div className="ml-3 flex-grow">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {getFileTypeName(file.type)} • {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button 
                className="text-gray-400 hover:text-gray-500"
                onClick={() => setFile(null)}
                disabled={uploading || success}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:bg-gray-50"
            onClick={triggerFileInput}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <FileUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, Word, Excel, PowerPoint, and other document types supported
            </p>
          </div>
        )}
        
        <div>
          <label htmlFor="document-title" className="block text-sm font-medium text-gray-700 mb-1">
            Document Title
          </label>
          <input
            type="text"
            id="document-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter a descriptive title for this document"
            disabled={uploading || success}
          />
        </div>
        
        {/* Add RFP selection dropdown if rfpId is not provided or it's 'all' */}
        {(!rfpId || rfpId === 'all') && (
          <div>
            <label htmlFor="rfp-select" className="block text-sm font-medium text-gray-700 mb-1">
              Associated RFP
            </label>
            <select
              id="rfp-select"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={selectedRfpId}
              onChange={(e) => {
                console.log("Selected RFP ID:", e.target.value);
                setSelectedRfpId(e.target.value);
              }}
              required
              disabled={uploading || success || loadingRfps}
            >
              <option value="">Select an RFP</option>
              {loadingRfps ? (
                <option value="" disabled>Loading RFPs...</option>
              ) : (
                availableRfps.map(rfp => (
                  <option key={rfp.id} value={rfp.id}>
                    {rfp.title} ({rfp.client_name})
                  </option>
                ))
              )}
            </select>
            {loadingRfps && (
              <p className="mt-1 text-xs text-blue-500 flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Loading available RFPs...
              </p>
            )}
          </div>
        )}
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="requires-nda"
            checked={requiresNda}
            onChange={(e) => setRequiresNda(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={uploading || success}
          />
          <label htmlFor="requires-nda" className="ml-2 block text-sm text-gray-900 flex items-center">
            <Lock className="h-4 w-4 mr-1 text-gray-500" />
            Requires NDA to access
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="requires-approval"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={uploading || success}
          />
          <label htmlFor="requires-approval" className="ml-2 block text-sm text-gray-900 flex items-center">
            <Users className="h-4 w-4 mr-1 text-gray-500" />
            Requires company registration approval
          </label>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={uploading || success}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading || !title.trim() || success || (!rfpId && !selectedRfpId)}
            leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          >
            {uploading ? 'Uploading...' : success ? 'Uploaded!' : 'Upload Document'}
          </Button>
        </div>
      </div>
    </div>
  );
};