import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RFP, Question } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  FileText, 
  MessageSquare, 
  Search, 
  AlertCircle,
  Filter,
  SlidersHorizontal,
  CheckCircle,
  Loader2,
  Clock,
  Plus
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { QuestionForm } from '../components/rfp/QuestionForm';
import { QuestionList } from '../components/rfp/QuestionList';

export const RFPQuestionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [rfp, setRFP] = useState<RFP | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAskForm, setShowAskForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch RFP and questions data
  useEffect(() => {
    const fetchRFPAndQuestions = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the RFP data first - using maybeSingle() instead of single() to handle not found case
        const { data: rfpData, error: rfpError } = await supabase
          .from('rfps')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (rfpError) {
          throw rfpError;
        }
        
        if (!rfpData) {
          console.log(`RFP with id ${id} not found`);
          setError(`The RFP you're looking for could not be found. It may have been deleted or you might not have permission to view it.`);
          setLoading(false);
          return;
        }
        
        setRFP(rfpData);
        
        // Now fetch the questions for this RFP
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('rfp_id', id)
          .order('created_at', { ascending: false });
        
        if (questionsError) throw questionsError;
        
        // For public viewing, only show published questions unless they're the user's questions
        const filteredQuestions = (questionsData || []).filter((q: Question) => 
          q.status === 'published' || (user && q.user_id === user.id)
        );
        
        setQuestions(filteredQuestions);
      } catch (error: any) {
        console.error('Error fetching RFP and questions:', error);
        setError(`Failed to load RFP information: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRFPAndQuestions();
  }, [id, user]);
  
  // Apply filters to questions
  const filteredQuestions = questions.filter(q => {
    // Search term filter
    const matchesSearch = !searchTerm || 
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.answer && q.answer.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Status filter  
    const matchesStatus = !statusFilter || q.status === statusFilter;
    
    // Mine only filter
    const matchesMineOnly = !showMineOnly || (user && q.user_id === user.id);
    
    return matchesSearch && matchesStatus && matchesMineOnly;
  });
  
  // Handle question submission
  const handleQuestionSubmitted = () => {
    // Close the form
    setShowAskForm(false);
    
    // In a real app, we would refresh from the database
    // For the demo, we'll just simulate adding a new question
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      rfp_id: id!,
      user_id: user?.id || '',
      question: 'Your new question has been submitted and is pending review.',
      topic: 'Other',
      status: 'pending',
      answer: null,
      created_at: new Date().toISOString(),
      answered_at: null
    };
    
    setQuestions([newQuestion, ...questions]);
  };
  
  if (loading && !rfp) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading Q&A information...</p>
        </div>
      </div>
    );
  }
  
  if (!rfp && error) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">RFP Not Found</h3>
        <p className="text-gray-500 mb-6">
          {error}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/rfps">
            <Button>
              Browse All RFPs
            </Button>
          </Link>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link to={`/rfps/${id}`} className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <MessageSquare className="h-6 w-6 mr-2 text-blue-500" />
              Questions & Answers
            </h1>
            <p className="text-gray-500 mt-1">
              {rfp?.title}
            </p>
          </div>
        </div>
        
        <div>
          {showAskForm ? (
            <Button 
              variant="outline" 
              onClick={() => setShowAskForm(false)}
            >
              Cancel
            </Button>
          ) : (
            <Button 
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowAskForm(true)}
            >
              Ask a Question
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
      
      {/* Ask question form */}
      {showAskForm && (
        <QuestionForm 
          rfpId={id!} 
          rfpTitle={rfp?.title || 'RFP'}
          onQuestionSubmitted={handleQuestionSubmitted}
        />
      )}
      
      {/* Search and filters */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search questions & answers..."
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
          </div>
        </div>
        
        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status-filter"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
              >
                <option value="">All Statuses</option>
                <option value="published">Answered</option>
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
              </select>
            </div>
            
            {user && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show-mine"
                  checked={showMineOnly}
                  onChange={(e) => setShowMineOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="show-mine" className="ml-2 block text-sm text-gray-900">
                  Show only my questions
                </label>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Questions list */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            {filteredQuestions.length} {filteredQuestions.length === 1 ? 'Question' : 'Questions'}
          </h2>
          
          {/* Legend */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-green-100 rounded-full mr-1"></span>
              <span className="text-gray-600">Answered</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-yellow-100 rounded-full mr-1"></span>
              <span className="text-gray-600">Pending</span>
            </div>
          </div>
        </div>
        
        <QuestionList 
          questions={filteredQuestions} 
          loading={loading}
          rfpId={id!}
          onAskQuestion={() => setShowAskForm(true)}
          emptyMessage={
            searchTerm || statusFilter || showMineOnly
              ? "No questions match your filters."
              : "No questions have been asked about this RFP yet."
          }
        />
      </div>
      
      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
        <FileText className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-blue-800 mb-1">About the Q&A Process</h3>
          <p className="text-sm text-blue-700">
            Questions are reviewed by the RFP administrators before being answered and published. 
            All questions and answers are visible to all bidders to ensure equal access to information.
            You'll be notified when your question is answered.
          </p>
        </div>
      </div>
    </div>
  );
};