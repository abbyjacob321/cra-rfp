import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Loader2, MessageSquare, Send } from 'lucide-react';
import { Button } from '../ui/Button';

interface QuestionFormProps {
  rfpId: string;
  rfpTitle: string;
  onQuestionSubmitted?: () => void;
}

export const QuestionForm: React.FC<QuestionFormProps> = ({
  rfpId,
  rfpTitle,
  onQuestionSubmitted
}) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const topicOptions = [
    { value: 'technical', label: 'Technical' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'schedule', label: 'Schedule & Timeline' },
    { value: 'requirements', label: 'Requirements' },
    { value: 'eligibility', label: 'Eligibility' },
    { value: 'submission', label: 'Submission Process' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to submit a question');
      return;
    }
    
    if (!question.trim()) {
      setError('Please enter your question');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(false);
      
      // Send the question to Supabase
      const { error } = await supabase
        .from('questions')
        .insert({
          rfp_id: rfpId,
          user_id: user.id,
          question: question.trim(),
          topic: topic || 'other', // Default to 'other' if no topic selected
          status: 'pending'
        });
      
      if (error) throw error;
      
      // Analytics tracking for question submission
      await supabase.from('analytics_events').insert({
        event_type: 'question_submitted',
        user_id: user.id,
        rfp_id: rfpId,
        metadata: {
          topic: topic || 'other',
          question_length: question.trim().length,
          rfp_title: rfpTitle
        }
      });
      
      // Success
      setSuccess(true);
      setQuestion('');
      setTopic('');
      
      // Call the callback if provided
      if (onQuestionSubmitted) {
        onQuestionSubmitted();
      }
      
      // Reset success message after a delay
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error submitting question:', error);
      setError('Failed to submit your question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
        Ask a Question
      </h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md mb-4">
          <p className="text-sm">Your question has been submitted successfully and will be reviewed by the RFP administrators.</p>
        </div>
      )}
      
      {!user ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md">
          <p className="text-sm mb-3">Please log in to submit questions about this RFP.</p>
          <div className="flex gap-3">
            <Button size="sm" onClick={() => window.location.href = '/login'}>Log In</Button>
            <Button size="sm" variant="outline" onClick={() => window.location.href = '/signup'}>Create Account</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
              Topic (Optional)
            </label>
            <select
              id="topic"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">Select a topic</option>
              {topicOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Selecting a topic helps direct your question to the appropriate expert.
            </p>
          </div>
          
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">
              Your Question
            </label>
            <textarea
              id="question"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              rows={4}
              placeholder={`Ask a question about "${rfpTitle}"...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Be specific to receive the most helpful response. Questions and answers may be visible to all bidders.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || !question.trim()}
              leftIcon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Question'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};