import React, { useState } from 'react';
import { Question } from '../../types';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Loader2, MessageSquare, Save, X, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';

interface AnswerQuestionModalProps {
  question: Question;
  onClose: () => void;
  onSaved: (updatedQuestion: Question) => void;
}

export const AnswerQuestionModal: React.FC<AnswerQuestionModalProps> = ({
  question,
  onClose,
  onSaved
}) => {
  const [answer, setAnswer] = useState(question.answer || '');
  const [status, setStatus] = useState<'in_review' | 'published'>(
    question.status === 'published' ? 'published' : 'in_review'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answer.trim() && status === 'published') {
      setError('Please provide an answer before publishing');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      // Prepare the update data
      const updateData: Partial<Question> = {
        status,
        answer: answer.trim() || null
      };
      
      // Add answered_at timestamp if publishing
      if (status === 'published') {
        updateData.answered_at = new Date().toISOString();
      }
      
      console.log('Updating question with data:', updateData);
      
      // Update the question in Supabase
      const { data, error } = await supabase
        .from('questions')
        .update(updateData)
        .eq('id', question.id)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error updating question:', error);
        throw new Error(`Failed to save answer: ${error.message}`);
      }
      
      console.log('Question updated successfully:', data);
      
      // Call the callback with the updated question
      if (data) {
        onSaved(data as Question);
      } else {
        // This shouldn't happen with a successful response, but just in case
        throw new Error('No data returned from update operation');
      }
    } catch (error: any) {
      console.error('Error updating question:', error);
      setError(error.message || 'Failed to save the answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not available';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} aria-hidden="true"></div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="sm:flex sm:items-start">
            <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-blue-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {question.status === 'published' ? 'Edit Answer' : 'Answer Question'}
              </h3>
              
              {error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Question:</span>
                  <span className="text-xs text-gray-500">Asked on {formatDate(question.created_at)}</span>
                </div>
                <p className="text-gray-900">{question.question}</p>
              </div>
              
              <form onSubmit={handleSubmit} className="mt-4">
                <div className="mb-4">
                  <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-1">
                    Response
                  </label>
                  <textarea
                    id="answer"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    rows={5}
                    placeholder="Provide a clear and thorough answer..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Your answer will be visible to all users once published.
                  </p>
                </div>
                
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    onClick={() => setStatus('published')}
                  >
                    {isSubmitting ? 'Saving...' : 'Publish Answer'}
                  </Button>
                  
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    onClick={() => setStatus('in_review')}
                  >
                    {isSubmitting ? 'Saving...' : 'Save as Draft'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="mr-auto"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};