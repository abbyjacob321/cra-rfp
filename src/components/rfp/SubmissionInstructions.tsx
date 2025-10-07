import React from 'react';
import { RFP } from '../../types';
import { FileText, Info, Calendar, Building2 } from 'lucide-react';

interface SubmissionInstructionsProps {
  rfp: RFP;
}

export const SubmissionInstructions: React.FC<SubmissionInstructionsProps> = ({ rfp }) => {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const isAfterDeadline = new Date() > new Date(rfp.closing_date);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Building2 className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div className="flex-grow">
            <h3 className="font-medium text-blue-800">Proposal Submission Instructions</h3>
            <p className="text-sm text-blue-600 mt-1">{rfp.title}</p>
            <div className="flex items-center mt-2 text-sm text-blue-600">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Deadline: {formatDate(rfp.closing_date)}</span>
              {isAfterDeadline && (
                <span className="ml-2 text-orange-600 font-medium">(Deadline Passed)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deadline Warning */}
      {isAfterDeadline && rfp.allow_late_submissions && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-orange-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">Late Submission Notice</h4>
              <p className="text-sm text-orange-700 mt-1">
                The submission deadline has passed, but late submissions are still being accepted. 
                Please follow the instructions below and clearly mark your submission as late.
              </p>
            </div>
          </div>
        </div>
      )}

      {isAfterDeadline && !rfp.allow_late_submissions && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Submission Closed</h4>
              <p className="text-sm text-red-700 mt-1">
                The submission deadline has passed and no late submissions are being accepted for this RFP.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Content */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center">
          <FileText className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">How to Submit Your Proposal</h3>
        </div>
        
        <div className="p-6">
          {rfp.submission_instructions ? (
            <div className="prose prose-blue max-w-none">
              <div dangerouslySetInnerHTML={{ __html: rfp.submission_instructions.replace(/\n/g, '<br>') }} />
            </div>
          ) : (
            <div className="text-gray-500 italic">
              No specific submission instructions have been provided for this RFP. 
              Please contact the RFP administrator for guidance.
            </div>
          )}
        </div>
      </div>

      {/* Default Instructions if none provided */}
      {!rfp.submission_instructions && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-3">Standard Submission Guidelines</h4>
          <div className="space-y-3 text-sm text-gray-700">
            <p>• Ensure all required documents are included in your submission</p>
            <p>• Submit proposals in PDF format when possible</p>
            <p>• Include a cover letter with your company information</p>
            <p>• Clearly label all files with your company name</p>
            <p>• Follow any specific formatting requirements mentioned in the RFP</p>
            <p>• Submit before the deadline to ensure consideration</p>
          </div>
        </div>
      )}

      {/* Contact Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">Questions?</h4>
            <p className="text-sm text-blue-700 mt-1">
              If you have questions about the submission process or requirements, 
              please use the Q&A section of this RFP or contact the RFP administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};