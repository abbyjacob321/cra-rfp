import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RFP, RFPComponent, Document, Question } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatDate, getUSTimezones } from '../utils/dateUtils';
import { QuestionForm } from '../components/rfp/QuestionForm';
import { QuestionList } from '../components/rfp/QuestionList';
import { RegisterInterestButton } from '../components/rfp/RegisterInterestButton';
import { ProposalSubmissionButton } from '../components/rfp/ProposalSubmissionButton';
import { SubmissionInstructions } from '../components/rfp/SubmissionInstructions';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Download,
  FileText,
  Users,
  MessageSquare,
  Bookmark,
  BookmarkCheck,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  AlertCircle,
  Loader2,
  Milestone,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DocumentViewer } from '../components/rfp/DocumentViewer';

const categoryMap = {
  'power_generation': 'Power Generation',
  'transmission': 'Transmission',
  'energy_capacity': 'Energy & Capacity',
  'renewable_credits': 'Renewable Credits',
  'other': 'Other'
};

export const RFPDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [rfp, setRFP] = useState<RFP | null>(null);
  const [components, setComponents] = useState<RFPComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'qa'>('overview');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [accessStatus, setAccessStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  
  // Fetch questions for this RFP
  const fetchQuestions = async () => {
    if (!id) return;
    
    try {
      console.log('Fetching questions for RFP:', id);
      
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('rfp_id', id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      console.log('Fetched questions:', data);
      
      // For public viewing, only show published questions unless they're the user's questions
      const filteredQuestions = data.filter((q: Question) => 
        q.status === 'published' || (user && q.user_id === user.id)
      );
      
      setQuestions(filteredQuestions);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };
  
  // Check if the user has access to this RFP
  const checkUserAccess = async () => {
    if (!id || !user) return;
    
    // Skip access check for public RFPs
    if (rfp && rfp.visibility === 'public') {
      setHasAccess(true);
      return;
    }
    
    try {
      // Admin users always have access
      if (user.role === 'admin') {
        setHasAccess(true);
        return;
      }
      
      // For client reviewers, check rfp_access table
      if (user.role === 'client_reviewer') {
        const { data, error } = await supabase
          .from('rfp_access')
          .select('status')
          .eq('rfp_id', id)
          .eq('user_id', user.id)
          .single();
          
        if (error) {
          // User likely doesn't have any access record
          setHasAccess(false);
          setAccessStatus(null);
        } else if (data) {
          setAccessStatus(data.status);
          setHasAccess(data.status === 'approved');
        }
      } else {
        // For bidders, access is controlled differently
        // This depends on your specific rules
        setHasAccess(true); // Default to true for now
      }
    } catch (error) {
      console.error('Error checking access permissions:', error);
      // Default to no access on error
      setHasAccess(false);
    }
  };
  
  useEffect(() => {
    if (activeTab === 'qa' && id) {
      fetchQuestions();
    }
  }, [activeTab, id, user]);
  
  useEffect(() => {
    const fetchRFPDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching RFP with ID:', id);
        
        // Fetch RFP details from Supabase
        const { data: rfpData, error: rfpError } = await supabase
          .from('rfps')
          .select('*')
          .eq('id', id)
          .single();
        
        if (rfpError) {
          console.error('Error fetching RFP:', rfpError);
          throw rfpError;
        }
        
        if (!rfpData) {
          console.error('RFP not found');
          setError('RFP not found');
          setLoading(false);
          return;
        }
        
        console.log('Fetched RFP data:', rfpData);
        setRFP(rfpData);
        
        // Fetch RFP components
        const { data: componentsData, error: componentsError } = await supabase
          .from('rfp_components')
          .select('*')
          .eq('rfp_id', id)
          .order('sort_order', { ascending: true });
        
        if (componentsError) {
          console.error('Error fetching RFP components:', componentsError);
          throw componentsError;
        }
        
        console.log('Fetched components:', componentsData);
        
        // Initialize expanded sections
        const initialExpandedState: {[key: string]: boolean} = {};
        if (componentsData) {
          componentsData.forEach((component: RFPComponent) => {
            initialExpandedState[component.id] = true;
          });
          
          setComponents(componentsData);
          setExpandedSections(initialExpandedState);
        } else {
          setComponents([]);
        }
        
        // Check user access for this RFP
        await checkUserAccess();
        
      } catch (error: any) {
        console.error('Error fetching RFP details:', error);
        setError(error.message || 'Failed to load RFP details');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchRFPDetails();
    }
  }, [id, user]);
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  const toggleSaved = async () => {
    if (!user) {
      navigate('/login', { state: { returnUrl: `/rfps/${id}` } });
      return;
    }

    try {
      setIsSaving(true);
      
      if (saved) {
        // Delete from saved_rfps
        const { error } = await supabase
          .from('saved_rfps')
          .delete()
          .eq('user_id', user.id)
          .eq('rfp_id', id);
          
        if (error) throw error;
      } else {
        // Add to saved_rfps
        const { error } = await supabase
          .from('saved_rfps')
          .insert({
            user_id: user.id,
            rfp_id: id
          });
          
        if (error) throw error;
      }
      
      setSaved(!saved);
    } catch (error: any) {
      console.error('Error toggling saved status:', error);
      setError('Failed to update saved status: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Check if RFP is saved
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (!user || !id) return;
      
      try {
        // Use the proper query pattern - don't use single() when record might not exist
        const { data, error } = await supabase
          .from('saved_rfps')
          .select('id')
          .eq('user_id', user.id)
          .eq('rfp_id', id)
          .limit(1); // Limit to 1 row since we only need to know if any exist
          
        if (error) throw error;
        
        // Check if we have any matching saved RFPs
        setSaved(data && data.length > 0);
      } catch (error: any) {
        console.error('Error checking saved status:', error);
        // Don't show this error to the user, just default saved to false
        setSaved(false);
      }
    };
    
    checkSavedStatus();
  }, [user, id]);
  
  const handleRequestAccess = async () => {
    if (!user) {
      navigate('/login', { state: { returnUrl: `/rfps/${id}` } });
      return;
    }
    
    if (user.role !== 'client_reviewer') {
      alert('Only client reviewers can request access to confidential RFPs');
      return;
    }
    
    try {
      setIsRequestingAccess(true);
      setError(null);
      
      // Create access request record
      const { error } = await supabase
        .from('rfp_access')
        .insert({
          rfp_id: id,
          user_id: user.id,
          status: 'pending'
        });
        
      if (error) {
        // Check if it's a duplicate request error
        if (error.code === '23505') {
          setError('You have already requested access to this RFP');
        } else {
          throw error;
        }
      } else {
        setAccessStatus('pending');
        
        // Notify admins about the access request
        await supabase
          .from('notifications')
          .insert({
            title: 'RFP Access Request',
            message: `${user.first_name} ${user.last_name} has requested access to RFP: ${rfp?.title}`,
            type: 'access_request',
            reference_id: id
          })
          .select('user_id')
          .eq('role', 'admin');
      }
    } catch (error: any) {
      console.error('Error requesting access:', error);
      setError('Failed to request access: ' + error.message);
    } finally {
      setIsRequestingAccess(false);
    }
  };
  
  // Format date for display
  // Get status badge styles
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          icon: <CheckCircle2 className="h-4 w-4 mr-1" />
        };
      case 'draft':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          icon: <Clock className="h-4 w-4 mr-1" />
        };
      case 'closed':
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          icon: <XCircle className="h-4 w-4 mr-1" />
        };
      default:
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          icon: null
        };
    }
  };
  
  const handleSubmitBid = () => {
    if (!user) {
      navigate('/login', { state: { returnUrl: `/rfps/${id}` } });
      return;
    }
    
    // Navigate to bid submission form
    navigate(`/rfps/${id}/submit`);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading RFP details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Error Loading RFP</h3>
        <p className="text-gray-500 mb-4">
          {error}
        </p>
        <Link to="/rfps">
          <Button variant="outline">
            Browse All RFPs
          </Button>
        </Link>
      </div>
    );
  }
  
  if (!rfp) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Info className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">RFP Not Found</h3>
        <p className="text-gray-500 mb-4">
          We couldn't find the RFP you're looking for.
        </p>
        <Link to="/rfps">
          <Button variant="outline">
            Browse All RFPs
          </Button>
        </Link>
      </div>
    );
  }

  // Show access denied message if the user doesn't have access
  if (rfp.visibility === 'confidential' && !hasAccess && user && user.role === 'client_reviewer') {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8 text-yellow-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Access Required</h3>
        <p className="text-gray-600 mb-6">
          This is a confidential RFP that requires special access permission.
        </p>

        {accessStatus === 'pending' ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg mb-6">
            <p>Your access request is pending approval. You'll be notified when it's approved.</p>
          </div>
        ) : accessStatus === 'rejected' ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
            <p>Your access request was denied. Please contact an administrator for assistance.</p>
          </div>
        ) : (
          <Button
            onClick={handleRequestAccess}
            disabled={isRequestingAccess}
            isLoading={isRequestingAccess}
          >
            Request Access
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Header with navigation and actions */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex items-start">
          <Link to="/rfps" className="mr-4 text-gray-500 hover:text-gray-700 flex-shrink-0 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {rfp.categories.map(category => (
                <span 
                  key={category} 
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                >
                  {categoryMap[category as keyof typeof categoryMap] || category}
                </span>
              ))}
              <span 
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center uppercase ${getStatusBadge(rfp.status).bg} ${getStatusBadge(rfp.status).text}`}
              >
                {getStatusBadge(rfp.status).icon}
                {rfp.status}
              </span>
              {rfp.visibility === 'confidential' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 inline-flex items-center">
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Confidential
                </span>
              )}
            </div>
            <div className="flex items-center mb-1">
              {rfp.logo_url && (
                <img 
                  src={rfp.logo_url} 
                  alt={`${rfp.client_name} logo`} 
                  className="h-10 max-w-[120px] object-contain mr-3"
                />
              )}
              <h1 className="text-2xl font-bold text-gray-900">{rfp.title}</h1>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 self-end md:self-start">
          {user && user.role === 'admin' && (
            <Link to={`/admin/rfps/${id}/edit`}>
              <Button
                variant="outline"
                leftIcon={<FileText className="h-4 w-4" />}
              >
                Edit RFP
              </Button>
            </Link>
          )}
          
          {/* Add Register for RFP button */}
          {user && user.role === 'bidder' && user.company_id && (
            <RegisterInterestButton
              rfpId={id || ''}
              rfpTitle={rfp.title}
            />
          )}
          
          <Button
            variant="outline"
            onClick={toggleSaved}
            disabled={isSaving}
            leftIcon={saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          >
            {isSaving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </Button>
          
          {rfp.status === 'active' && (
            <Button
              onClick={handleSubmitBid}
              leftIcon={<ExternalLink className="h-4 w-4" />}
            >
              Submit Proposal
            </Button>
          )}
        </div>
      </div>
      
      {/* Client info and key dates */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
            <div className="flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-gray-400" />
              <p className="text-lg font-medium text-gray-900">{rfp.client_name}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Issue Date</h3>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-gray-400" />
              <p className="text-lg font-medium text-gray-900">{formatDate(rfp.issue_date)}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Closing Date</h3>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-gray-400" />
              <p className="text-lg font-medium text-gray-900">{formatDate(rfp.closing_date)}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'qa'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('qa')}
          >
            Q&A
          </button>
        </nav>
      </div>
      
      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Timeline and Milestones section */}
            {rfp.milestones && rfp.milestones.length > 0 && (
              <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Milestone className="h-5 w-5 text-gray-400 mr-2" />
                    Timeline & Milestones
                  </h3>
                </div>
                
                <div className="p-6">
                  <div className="relative">
                    <div className="absolute top-0 bottom-0 left-[19px] w-0.5 bg-gray-200"></div>
                    <ul className="space-y-6">
                      {rfp.milestones.map((milestone, index) => (
                        <li key={milestone.id || index} className="relative pl-10">
                          <div className="absolute left-0 top-1 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center z-10">
                            <Calendar className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                              <h4 className="text-base font-medium text-gray-900">{milestone.title}</h4>
                              <div className="text-sm text-blue-600 font-medium">
                                <div>
                                  {formatDate(
                                    milestone.date,
                                    milestone.has_time ? 'PPpp' : 'PP',
                                    milestone.timezone
                                  )}
                                </div>
                                {milestone.timezone && (
                                  <div className="text-xs text-gray-500">
                                    {getUSTimezones().find(tz => tz.value === milestone.timezone)?.label || milestone.timezone}
                                  </div>
                                )}
                              </div>
                            </div>
                            {milestone.description && (
                              <p className="mt-1 text-sm text-gray-600">{milestone.description}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {components && components.length > 0 ? (
              components.map((component) => (
                <div key={component.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="flex justify-between items-center w-full p-5 text-left focus:outline-none bg-gray-50 border-b border-gray-200"
                    onClick={() => toggleSection(component.id)}
                  >
                    <h3 className="text-base font-medium text-gray-900 flex items-center">
                      {component.title}
                    </h3>
                    {expandedSections[component.id] ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedSections[component.id] && (
                    <div className="px-5 py-4">
                      <div 
                        className="prose prose-blue max-w-none" 
                        dangerouslySetInnerHTML={{ __html: component.content }}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : null }
            
            {/* Display description if no components */}
            {(!components || components.length === 0) && rfp.description && (
              <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Description</h3>
                <p className="text-gray-600">{rfp.description}</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'documents' && (
          <DocumentViewer rfpId={id || ''} />
        )}
        
        {activeTab === 'qa' && (
          <div className="space-y-6">
            {/* Question form */}
            <QuestionForm 
              rfpId={id!} 
              rfpTitle={rfp.title}
              onQuestionSubmitted={() => {
                // Refresh questions list after submission
                fetchQuestions();
              }}
            />
            
            {/* Questions list */}
            <QuestionList 
              questions={questions} 
              loading={loading}
              rfpId={id!}
              emptyMessage="No questions have been asked about this RFP yet."
              onAskQuestion={() => setActiveTab('qa')}
            />
          </div>
        )}
        
        {activeTab === 'submit' && (
          <div className="space-y-6">
            {rfp.submission_method === 'sharefile' ? (
              <ProposalSubmissionButton 
                rfp={rfp}
                onSubmissionUpdate={() => {
                  // Handle submission updates if needed
                  console.log('Submission updated');
                }}
              />
            ) : (
              <SubmissionInstructions rfp={rfp} />
            )}
          </div>
        )}
      </div>
      
      {/* Bottom action bar */}
      <div className="bg-white sticky bottom-0 border-t border-gray-200 p-4 rounded-t-xl shadow-lg z-10">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-6">
            <Link to={`/rfps/${id}/questions`} className="flex items-center text-gray-600 hover:text-blue-600">
              <MessageSquare className="h-5 w-5 mr-2" />
              <span>Q&A</span>
            </Link>
            
            <button 
              onClick={() => setActiveTab('submit')}
              className={`flex items-center ${
                activeTab === 'submit' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              <span>Submit Proposal</span>
            </button>
          </div>
          
          <div className="flex gap-3">
            {rfp.status === 'active' && (
              <Button
                variant="primary"
                onClick={handleSubmitBid}
                leftIcon={<ExternalLink className="h-4 w-4" />}
              >
                Submit Proposal
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};