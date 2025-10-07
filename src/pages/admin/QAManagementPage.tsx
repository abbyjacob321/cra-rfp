import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  SlidersHorizontal, 
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  User,
  ArrowUpDown,
  FileText,
  MessageSquareText,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { RFP, Question } from '../../types';
import { AnswerQuestionModal } from '../../components/admin/AnswerQuestionModal';

// Status display configuration
const statusDisplay = {
  'published': { label: 'Answered', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3.5 w-3.5 mr-1" /> },
  'in_review': { label: 'In Review', color: 'bg-blue-100 text-blue-800', icon: <Clock className="h-3.5 w-3.5 mr-1" /> },
  'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3.5 w-3.5 mr-1" /> }
};

// Filter set type
type FilterSet = {
  searchTerm: string;
  statusFilter: string | null;
  rfpFilter: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export const QAManagementPage: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [rfps, setRFPs] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterSet>({
    searchTerm: '',
    statusFilter: null,
    rfpFilter: null,
    dateFrom: null,
    dateTo: null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [isPublishingBulk, setIsPublishingBulk] = useState(false);
  
  // Fetch questions and RFPs
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch questions with related RFP data
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          *,
          rfps (
            id,
            title,
            client_name,
            categories,
            visibility,
            status,
            issue_date,
            closing_date,
            description,
            created_at,
            updated_at
          ),
          profiles (
            id, 
            email,
            first_name,
            last_name,
            company
          )
        `)
        .order('created_at', { ascending: false });

      if (questionsError) throw questionsError;

      // Fetch RFPs for the filter dropdown
      const { data: rfpsData, error: rfpsError } = await supabase
        .from('rfps')
        .select('*')
        .order('created_at', { ascending: false });

      if (rfpsError) throw rfpsError;

      // Process questions data to include user information
      const processedQuestions = questionsData?.map(q => ({
        ...q,
        user_name: q.profiles ? `${q.profiles.first_name} ${q.profiles.last_name}` : 'Unknown',
        user_email: q.profiles?.email || 'Unknown',
        user_company: q.profiles?.company || 'Unknown',
        rfp_title: q.rfps?.title || 'Unknown RFP'
      })) || [];

      setQuestions(processedQuestions);
      setRFPs(rfpsData || []);
    } catch (error: any) {
      console.error('Error fetching questions:', error);
      setError(`Failed to load questions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchQuestions();
  }, []);
  
  // Apply filters to questions
  const filteredQuestions = questions.filter(q => {
    // Search term filter
    const matchesSearch = !filters.searchTerm || 
      q.question.toLowerCase().includes(filters.searchTerm.toLowerCase()) || 
      (q.answer && q.answer.toLowerCase().includes(filters.searchTerm.toLowerCase()));
      
    // Status filter
    const matchesStatus = !filters.statusFilter || q.status === filters.statusFilter;
    
    // RFP filter
    const matchesRFP = !filters.rfpFilter || q.rfp_id === filters.rfpFilter;
    
    // Date range filter
    let matchesDateRange = true;
    if (filters.dateFrom) {
      matchesDateRange = matchesDateRange && new Date(q.created_at) >= new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      matchesDateRange = matchesDateRange && new Date(q.created_at) <= new Date(filters.dateTo);
    }
    
    return matchesSearch && matchesStatus && matchesRFP && matchesDateRange;
  });
  
  // Sort filtered questions
  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    if (sortField === 'created_at' || sortField === 'answered_at') {
      const dateA = new Date(a[sortField as keyof Question] || '1970-01-01').getTime();
      const dateB = new Date(b[sortField as keyof Question] || '1970-01-01').getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      const fieldA = String(a[sortField as keyof Question] || '');
      const fieldB = String(b[sortField as keyof Question] || '');
      
      return sortDirection === 'asc' 
        ? fieldA.localeCompare(fieldB) 
        : fieldB.localeCompare(fieldA);
    }
  });
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle answer modal
  const handleOpenAnswerModal = (question: Question) => {
    setSelectedQuestion(question);
  };
  
  const handleCloseAnswerModal = () => {
    setSelectedQuestion(null);
  };
  
  // Handle bulk operations
  const handleBulkSelect = (questionId: string, isSelected: boolean) => {
    if (isSelected) {
      setBulkSelectedIds(prev => [...prev, questionId]);
    } else {
      setBulkSelectedIds(prev => prev.filter(id => id !== questionId));
    }
  };
  
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setBulkSelectedIds(filteredQuestions.map(q => q.id));
    } else {
      setBulkSelectedIds([]);
    }
  };
  
  const handleQuestionUpdated = async (updatedQuestion: Question) => {
    try {
      console.log('Question updated successfully:', updatedQuestion);
      
      // Update questions list
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.id === updatedQuestion.id ? updatedQuestion : q
        )
      );
      
      // Close the modal
      setSelectedQuestion(null);
    } catch (error) {
      console.error('Error handling updated question:', error);
      setError('Failed to update question in UI state. Please refresh the page.');
    }
  };

  // Bulk publish function
  const handleBulkPublish = async () => {
    if (bulkSelectedIds.length === 0) return;
    
    try {
      setIsPublishingBulk(true);
      
      // Fetch selected questions to get current data
      const { data: selectedQuestions } = await supabase
        .from('questions')
        .select('*')
        .in('id', bulkSelectedIds);
      
      if (!selectedQuestions || selectedQuestions.length === 0) {
        throw new Error('Failed to fetch selected questions');
      }
      
      // Prepare batch updates
      const now = new Date().toISOString();
      const updates = selectedQuestions.map(q => ({
        id: q.id,
        status: 'published',
        answered_at: q.answered_at || now
      }));
      
      // Perform bulk update
      const { error } = await supabase
        .from('questions')
        .upsert(updates);
      
      if (error) throw error;
      
      // Refresh questions
      await fetchQuestions();
      
      // Clear selection
      setBulkSelectedIds([]);
      
    } catch (error: any) {
      console.error('Error publishing questions in bulk:', error);
      setError(`Failed to publish questions: ${error.message}`);
    } finally {
      setIsPublishingBulk(false);
    }
  };
  
  // Filter handlers
  const handleFilterChange = (filterName: keyof FilterSet, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      statusFilter: null,
      rfpFilter: null,
      dateFrom: null,
      dateTo: null
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Q&A Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review, answer, and publish responses to bidder questions
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchQuestions}
            >
              Refresh
            </Button>
            {bulkSelectedIds.length > 0 && (
              <>
                <Button 
                  variant="outline" 
                  leftIcon={<MessageSquareText className="h-4 w-4" />}
                  onClick={handleBulkPublish}
                  disabled={isPublishingBulk}
                  className={isPublishingBulk ? 'opacity-75' : ''}
                >
                  {isPublishingBulk ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    `Publish ${bulkSelectedIds.length} selected`
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search questions..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              />
            </div>
            
            <Button 
              variant="outline" 
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : ''}
            >
              Filters
            </Button>
          </div>
          
          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status-filter"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={filters.statusFilter || ''}
                  onChange={(e) => handleFilterChange('statusFilter', e.target.value || null)}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="published">Answered</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="rfp-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  RFP
                </label>
                <select
                  id="rfp-filter"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={filters.rfpFilter || ''}
                  onChange={(e) => handleFilterChange('rfpFilter', e.target.value || null)}
                >
                  <option value="">All RFPs</option>
                  {rfps.map(rfp => (
                    <option key={rfp.id} value={rfp.id}>{rfp.title}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    id="date-from"
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filters.dateFrom || ''}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value || null)}
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    id="date-to"
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filters.dateTo || ''}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value || null)}
                  />
                </div>
              </div>
              
              <div className="md:col-span-3 flex justify-end">
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Questions Table */}
        <div className="overflow-x-auto">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <div className="flex items-center text-red-700">
                <AlertCircle className="h-5 w-5 mr-2" />
                <p>{error}</p>
              </div>
            </div>
          )}
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={handleSelectAll}
                    checked={bulkSelectedIds.length > 0 && bulkSelectedIds.length === filteredQuestions.length}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('question')}
                >
                  <div className="flex items-center">
                    <span>Question</span>
                    {sortField === 'question' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('rfp_id')}
                >
                  <div className="flex items-center">
                    <span>RFP</span>
                    {sortField === 'rfp_id' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Asked By
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    <span>Asked Date</span>
                    {sortField === 'created_at' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('answered_at')}
                >
                  <div className="flex items-center">
                    <span>Answered</span>
                    {sortField === 'answered_at' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin h-6 w-6 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                  </td>
                </tr>
              ) : sortedQuestions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No questions found matching your criteria
                  </td>
                </tr>
              ) : (
                sortedQuestions.map((question) => (
                  <tr key={question.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={bulkSelectedIds.includes(question.id)}
                        onChange={(e) => handleBulkSelect(question.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center ${statusDisplay[question.status as keyof typeof statusDisplay].color}`}>
                        {statusDisplay[question.status as keyof typeof statusDisplay].icon}
                        {statusDisplay[question.status as keyof typeof statusDisplay].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{question.question}</div>
                      {question.answer && (
                        <div className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {question.answer}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-gray-400 mr-1.5" />
                        <div className="text-sm text-gray-900">
                          {question.rfps?.title || 'Unknown RFP'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-1.5" />
                        <div>
                          <div className="text-sm text-gray-900">
                            {question.user_name || `User ID: ${question.user_id}`}
                          </div>
                          {question.user_company && (
                            <div className="text-xs text-gray-500">
                              {question.user_company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(question.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(question.answered_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        size="sm"
                        variant={question.status !== 'published' ? 'primary' : 'outline'}
                        onClick={() => handleOpenAnswerModal(question)}
                      >
                        {question.status === 'pending' ? 'Answer' : 
                         question.status === 'in_review' ? 'Review & Publish' : 
                         'Edit Response'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <nav
          className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6"
          aria-label="Pagination"
        >
          <div className="hidden sm:block">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{sortedQuestions.length}</span> of{' '}
              <span className="font-medium">{sortedQuestions.length}</span> results
            </p>
          </div>
          <div className="flex-1 flex justify-between sm:justify-end">
            <button
              disabled
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </nav>
      </div>
      
      {/* Answer Question Modal */}
      {selectedQuestion && (
        <AnswerQuestionModal
          question={selectedQuestion}
          onClose={handleCloseAnswerModal}
          onSaved={handleQuestionUpdated}
        />
      )}
    </div>
  );
};