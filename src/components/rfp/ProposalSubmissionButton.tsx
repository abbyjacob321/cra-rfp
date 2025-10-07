import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { shareFileService } from '../../lib/shareFileService';
import { RFP } from '../../types';
import { 
  Upload, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  FileText,
  Building2,
  Calendar,
  Info
} from 'lucide-react';
import { Button } from '../ui/Button';

interface ProposalSubmissionButtonProps {
  rfp: RFP;
  onSubmissionUpdate?: () => void;
}

interface SubmissionStatus {
  can_submit: boolean;
  is_late: boolean;
  allow_late: boolean;
  closing_date: string;
  submission_method: string;
  reason?: string;
}

export const ProposalSubmissionButton: React.FC<ProposalSubmissionButtonProps> = ({ 
  rfp, 
  onSubmissionUpdate 
}) => {
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkSubmissionStatus();
    checkExistingSubmission();
  }, [rfp.id, user]);

  const checkSubmissionStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('can_submit_proposal', {
        p_rfp_id: rfp.id
      });

      if (error) throw error;
      setSubmissionStatus(data);
    } catch (error) {
      console.error('Error checking submission status:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSubmission = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('proposal_submissions')
        .select(`
          *,
          submission_files (
            id,
            file_name,
            file_size,
            upload_status,
            uploaded_at
          )
        `)
        .eq('rfp_id', rfp.id)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setExistingSubmission(data);
    } catch (error) {
      console.error('Error checking existing submission:', error);
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadFiles(files);
  };

  const handleSubmission = async () => {
    if (!user || !submissionStatus?.can_submit) return;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // Initialize ShareFile service
      const initialized = await shareFileService.initialize();
      if (!initialized) {
        throw new Error('ShareFile service not available. Please contact support.');
      }

      // Create submission record
      const submissionData = {
        rfp_id: rfp.id,
        user_id: user.id,
        company_id: user.company_id || null,
        submission_method: 'sharefile',
        is_late_submission: submissionStatus.is_late,
        file_count: uploadFiles.length,
        total_file_size: uploadFiles.reduce((sum, file) => sum + file.size, 0),
        metadata: {
          submitted_via: 'web_platform',
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      const { data: submission, error: submissionError } = await supabase
        .from('proposal_submissions')
        .insert(submissionData)
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Upload files to ShareFile
      const uploadResults = [];
      for (const file of uploadFiles) {
        const result = await shareFileService.uploadFile({
          rfpId: rfp.id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isLateSubmission: submissionStatus.is_late
        });

        uploadResults.push(result);

        // Track file in database
        await supabase
          .from('submission_files')
          .insert({
            submission_id: submission.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            sharefile_file_id: result.fileId,
            upload_status: result.success ? 'completed' : 'failed',
            uploaded_at: result.success ? new Date().toISOString() : null
          });
      }

      // Check if all uploads succeeded
      const failedUploads = uploadResults.filter(r => !r.success);
      if (failedUploads.length > 0) {
        throw new Error(`${failedUploads.length} files failed to upload`);
      }

      // Log submission event
      await supabase.from('analytics_events').insert({
        event_type: 'proposal_submitted',
        user_id: user.id,
        rfp_id: rfp.id,
        metadata: {
          submission_method: 'sharefile',
          file_count: uploadFiles.length,
          total_size: submissionData.total_file_size,
          is_late: submissionStatus.is_late
        }
      });

      setSuccess('Proposal submitted successfully!');
      setShowUploadDialog(false);
      setUploadFiles([]);
      
      // Refresh submission status
      await checkExistingSubmission();
      
      if (onSubmissionUpdate) {
        onSubmissionUpdate();
      }

    } catch (error: any) {
      console.error('Error submitting proposal:', error);
      setError(error.message || 'Failed to submit proposal');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span>Checking submission status...</span>
      </div>
    );
  }

  // Show existing submission status
  if (existingSubmission) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
          <div className="flex-grow">
            <h4 className="text-sm font-medium text-green-800">Proposal Submitted</h4>
            <p className="text-sm text-green-700 mt-1">
              Submitted on {formatDate(existingSubmission.submitted_at)}
              {existingSubmission.is_late_submission && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  Late Submission
                </span>
              )}
            </p>
            <div className="mt-2 text-sm text-green-600">
              <p>Files: {existingSubmission.file_count}</p>
              <p>Total size: {formatFileSize(existingSubmission.total_file_size)}</p>
            </div>
            
            {submissionStatus?.can_submit && submissionStatus.is_late && (
              <div className="mt-3">
                <Button 
                  size="sm" 
                  variant="outline"
                  leftIcon={<Upload className="h-4 w-4" />}
                  onClick={() => setShowUploadDialog(true)}
                >
                  Update Submission
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show submission status
  if (!submissionStatus?.can_submit) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center text-gray-600">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span className="text-sm">
            {submissionStatus?.reason || 'Submissions are currently not available'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Submission warning for late submissions */}
      {submissionStatus.is_late && submissionStatus.allow_late && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start">
            <Clock className="h-5 w-5 text-orange-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">Late Submission</h4>
              <p className="text-sm text-orange-700 mt-1">
                The deadline has passed ({formatDate(submissionStatus.closing_date)}), but late submissions are allowed.
                Your submission will be marked as late and may be reviewed separately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={() => setShowUploadDialog(true)}
        leftIcon={<Upload className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        Submit Proposal
      </Button>

      {/* Upload dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Submit Proposal</h3>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="text-gray-400 hover:text-gray-500"
                  disabled={uploading}
                >
                  <span className="sr-only">Close</span>
                  <span className="text-xl">&times;</span>
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md mb-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{success}</p>
                  </div>
                </div>
              )}

              {/* RFP Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <Building2 className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <div className="flex-grow">
                    <h4 className="font-medium text-blue-800">{rfp.title}</h4>
                    <p className="text-sm text-blue-600">{rfp.client_name}</p>
                    <div className="flex items-center mt-2 text-sm text-blue-600">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Deadline: {formatDate(submissionStatus.closing_date)}</span>
                      {submissionStatus.is_late && (
                        <span className="ml-2 text-orange-600 font-medium">(Late)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Proposal Files
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <div className="mb-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500 font-medium">
                        Choose files
                      </span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={handleFileSelection}
                      disabled={uploading}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    PDF, Word, Excel, PowerPoint files up to 100MB each
                  </p>
                </div>

                {/* Selected Files */}
                {uploadFiles.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Selected Files ({uploadFiles.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {uploadFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{file.name}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 mr-2">
                              {formatFileSize(file.size)}
                            </span>
                            <button
                              onClick={() => {
                                setUploadFiles(files => files.filter((_, i) => i !== index));
                              }}
                              className="text-red-500 hover:text-red-700"
                              disabled={uploading}
                            >
                              <span className="sr-only">Remove</span>
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Important Notes */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <h4 className="font-medium mb-1">Important Notes:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Files will be uploaded securely to ShareFile</li>
                      <li>You can modify files until the RFP deadline</li>
                      <li>All uploads are tracked and audited</li>
                      <li>You'll receive confirmation once upload is complete</li>
                      {submissionStatus.is_late && (
                        <li className="text-orange-700 font-medium">
                          This will be marked as a late submission
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadDialog(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmission}
                  disabled={uploading || uploadFiles.length === 0}
                  leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  isLoading={uploading}
                >
                  {uploading ? 'Submitting...' : `Submit ${uploadFiles.length} Files`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};