import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Question } from '../../types';
import { MessageSquare, Clock, CheckCircle, FileText, Tag, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';

interface QuestionListProps {
  questions: Question[];
  loading: boolean;
  rfpId: string;
  emptyMessage?: string;
  onAskQuestion?: () => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  loading,
  rfpId,
  emptyMessage = "No questions have been asked about this RFP yet.",
  onAskQuestion
}) => {
  const { user } = useAuth();
  
  // Helper function to get badge props based on question status
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'published':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          icon: <CheckCircle className="h-3.5 w-3.5 mr-1" />,
          label: 'Answered'
        };
      case 'in_review':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          icon: <Clock className="h-3.5 w-3.5 mr-1" />,
          label: 'In Review'
        };
      case 'pending':
      default:
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          icon: <Clock className="h-3.5 w-3.5 mr-1" />,
          label: 'Pending'
        };
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  // Get nice topic name
  const getTopicName = (topic: string) => {
    const topicMap: {[key: string]: string} = {
      'technical': 'Technical',
      'commercial': 'Commercial',
      'schedule': 'Schedule & Timeline',
      'requirements': 'Requirements',
      'eligibility': 'Eligibility',
      'submission': 'Submission Process',
      'other': 'Other'
    };
    
    return topicMap[topic] || 'Other';
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  if (questions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Questions Yet</h3>
        <p className="text-gray-500 mb-4">{emptyMessage}</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <ul className="divide-y divide-gray-200">
        {questions.map((question) => {
          const statusBadge = getStatusBadge(question.status);
          const isUsersQuestion = user && user.id === question.user_id;
          const hasAnswer = question.status === 'published' && question.answer;
          
          return (
            <li key={question.id} className="p-6 hover:bg-gray-50">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-gray-900">{question.question}</h4>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.icon}
                          {statusBadge.label}
                        </span>
                        
                        {question.topic && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 inline-flex items-center">
                            <Tag className="h-3 w-3 mr-1" />
                            {getTopicName(question.topic)}
                          </span>
                        )}
                        
                        {isUsersQuestion && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            Your Question
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Asked on {formatDate(question.created_at)}
                  </div>
                </div>
                
                {hasAnswer && (
                  <div className="pl-7 mt-3">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex justify-between mb-1">
                        <h5 className="text-sm font-medium text-blue-800">Response</h5>
                        <span className="text-xs text-blue-600">
                          Answered on {formatDate(question.answered_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{question.answer}</p>
                    </div>
                  </div>
                )}
                
                {!hasAnswer && question.status === 'pending' && isUsersQuestion && (
                  <div className="pl-7 mt-1">
                    <p className="text-xs text-gray-500 italic">
                      Your question is pending review. You'll be notified when it's answered.
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};