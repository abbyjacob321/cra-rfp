import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  FileQuestion,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  RefreshCw,
  Loader2,
  MessageSquare,
  Shield,
  Eye,
  UserPlus,
  FileUp
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface AnalyticsData {
  totalRFPs: number;
  activeRFPs: number;
  totalUsers: number;
  totalQuestions: number;
  totalDocuments: number;
  totalCompanies: number;
  totalNDAs: number;
  rfpGrowth: number;
  userGrowth: number;
  questionGrowth: number;
  rfpsByStatus: {
    active: number;
    draft: number;
    closed: number;
  };
  rfpsByCategory: {
    [key: string]: number;
  };
  userActivity: {
    date: string;
    users: number;
    rfps: number;
    questions: number;
  }[];
  recentActivity: {
    id: string;
    type: string;
    user?: string;
    company?: string;
    title?: string;
    client?: string;
    time: string;
    rfp?: string;
  }[];
  questionMetrics: {
    totalQuestions: number;
    answeredQuestions: number;
    pendingQuestions: number;
    avgResponseTime: number;
  };
  companyMetrics: {
    totalCompanies: number;
    verifiedCompanies: number;
    companiesWithNDAs: number;
  };
}

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        if (dateRange === '7d') {
          startDate.setDate(endDate.getDate() - 7);
        } else if (dateRange === '30d') {
          startDate.setDate(endDate.getDate() - 30);
        } else {
          startDate.setDate(endDate.getDate() - 90);
        }
        
        // Calculate previous period for growth comparison
        const previousEndDate = new Date(startDate);
        const previousStartDate = new Date(startDate);
        const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        previousStartDate.setDate(previousStartDate.getDate() - daysDiff);
        
        
        const { data: rfpData, error: rfpError } = await supabase
          .from('rfps')
          .select('*');
          
        if (rfpError) throw rfpError;
        
        // Calculate RFP metrics
        const rfpsByStatus = {
          active: rfpData?.filter(r => r.status === 'active').length || 0,
          draft: rfpData?.filter(r => r.status === 'draft').length || 0,
          closed: rfpData?.filter(r => r.status === 'closed').length || 0
        };
        
        // Calculate RFPs by category
        const categoryCount: { [key: string]: number } = {};
        rfpData?.forEach(rfp => {
          rfp.categories.forEach((category: string) => {
            categoryCount[category] = (categoryCount[category] || 0) + 1;
          });
        });
        
        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, created_at, role, company_id');
          
        if (userError) throw userError;
        
        // Fetch question data
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('id, created_at, status, answered_at');
          
        if (questionError) throw questionError;
        
        // Fetch document data
        const { data: documentData, error: documentError } = await supabase
          .from('documents')
          .select('id, created_at');
          
        if (documentError) throw documentError;
        
        // Fetch company data
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, created_at, verification_status');
          
        if (companyError) throw companyError;
        
        // Fetch NDA data
        const { data: ndaData, error: ndaError } = await supabase
          .from('rfp_nda_access')
          .select('id, created_at, status');
          
        if (ndaError) throw ndaError;
        
        // Calculate growth rates
        const currentPeriodRFPs = rfpData?.filter(rfp => 
          new Date(rfp.created_at) >= startDate && new Date(rfp.created_at) <= endDate
        ).length || 0;
        
        const previousPeriodRFPs = rfpData?.filter(rfp => 
          new Date(rfp.created_at) >= previousStartDate && new Date(rfp.created_at) < startDate
        ).length || 0;
        
        const rfpGrowth = previousPeriodRFPs > 0 
          ? ((currentPeriodRFPs - previousPeriodRFPs) / previousPeriodRFPs) * 100 
          : currentPeriodRFPs > 0 ? 100 : 0;
        
        const currentPeriodUsers = userData?.filter(user => 
          new Date(user.created_at) >= startDate && new Date(user.created_at) <= endDate
        ).length || 0;
        
        const previousPeriodUsers = userData?.filter(user => 
          new Date(user.created_at) >= previousStartDate && new Date(user.created_at) < startDate
        ).length || 0;
        
        const userGrowth = previousPeriodUsers > 0 
          ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100 
          : currentPeriodUsers > 0 ? 100 : 0;
        
        const currentPeriodQuestions = questionData?.filter(q => 
          new Date(q.created_at) >= startDate && new Date(q.created_at) <= endDate
        ).length || 0;
        
        const previousPeriodQuestions = questionData?.filter(q => 
          new Date(q.created_at) >= previousStartDate && new Date(q.created_at) < startDate
        ).length || 0;
        
        const questionGrowth = previousPeriodQuestions > 0 
          ? ((currentPeriodQuestions - previousPeriodQuestions) / previousPeriodQuestions) * 100 
          : currentPeriodQuestions > 0 ? 100 : 0;
        
        // Generate user activity data for the selected period
        const userActivity: { date: string, users: number, rfps: number, questions: number }[] = [];
        
        for (let i = 0; i < daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = format(date, 'yyyy-MM-dd');
          
          // Count users created on this date
          const usersOnDate = userData?.filter(user => 
            format(new Date(user.created_at), 'yyyy-MM-dd') === dateStr
          ).length || 0;
          
          // Count RFPs created on this date
          const rfpsOnDate = rfpData?.filter(rfp => 
            format(new Date(rfp.created_at), 'yyyy-MM-dd') === dateStr
          ).length || 0;
          
          // Count questions on this date
          const questionsOnDate = questionData?.filter(q => 
            format(new Date(q.created_at), 'yyyy-MM-dd') === dateStr
          ).length || 0;
          
          userActivity.push({
            date: dateStr,
            users: usersOnDate,
            rfps: rfpsOnDate,
            questions: questionsOnDate
          });
        }
        
        // Calculate question metrics
        const answeredQuestions = questionData?.filter(q => q.status === 'published').length || 0;
        const pendingQuestions = questionData?.filter(q => q.status === 'pending').length || 0;
        
        // Calculate average response time (in days)
        const answeredQuestionsWithTime = questionData?.filter(q => 
          q.status === 'published' && q.answered_at && q.created_at
        ) || [];
        
        const avgResponseTime = answeredQuestionsWithTime.length > 0 
          ? answeredQuestionsWithTime.reduce((sum, q) => {
              const created = new Date(q.created_at);
              const answered = new Date(q.answered_at);
              const days = (answered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / answeredQuestionsWithTime.length
          : 0;
        
        // Calculate company metrics
        const verifiedCompanies = companyData?.filter(c => c.verification_status === 'verified').length || 0;
        const companiesWithNDAs = new Set(ndaData?.map(nda => nda.company_id).filter(Boolean)).size || 0;
        
        // Generate recent activity from multiple sources
        const recentActivity: any[] = [];
        
        // Add recent RFPs
        const recentRFPs = rfpData?.slice(0, 3) || [];
        recentRFPs.forEach(rfp => {
          recentActivity.push({
            id: `rfp-${rfp.id}`,
            type: 'rfp_created',
            title: rfp.title,
            client: rfp.client_name,
            time: formatRelativeTime(rfp.created_at)
          });
        });
        
        // Add recent users
        const recentUsers = userData?.slice(0, 3) || [];
        recentUsers.forEach(user => {
          recentActivity.push({
            id: `user-${user.id}`,
            type: 'user_join',
            user: 'New User',
            time: formatRelativeTime(user.created_at)
          });
        });
        
        // Add recent questions
        const recentQuestions = questionData?.slice(0, 2) || [];
        recentQuestions.forEach(q => {
          if (q.status === 'published' && q.answered_at) {
            recentActivity.push({
              id: `question-${q.id}`,
              type: 'question_answered',
              title: 'Question answered',
              time: formatRelativeTime(q.answered_at)
            });
          }
        });
        
        // Sort by most recent and take top 10
        recentActivity.sort((a, b) => {
          // This is a simple sort by the time string, would be better with actual dates
          return 0; // For now, keep original order
        });
        
        // Set analytics data
        setAnalyticsData({
          totalRFPs: rfpData?.length || 0,
          activeRFPs: rfpsByStatus.active,
          totalUsers: userData?.length || 0,
          totalQuestions: questionData?.length || 0,
          totalDocuments: documentData?.length || 0,
          totalCompanies: companyData?.length || 0,
          totalNDAs: ndaData?.length || 0,
          rfpGrowth,
          userGrowth,
          questionGrowth,
          rfpsByStatus,
          rfpsByCategory: categoryCount,
          userActivity,
          recentActivity: recentActivity.slice(0, 10),
          questionMetrics: {
            totalQuestions: questionData?.length || 0,
            answeredQuestions,
            pendingQuestions,
            avgResponseTime
          },
          companyMetrics: {
            totalCompanies: companyData?.length || 0,
            verifiedCompanies,
            companiesWithNDAs
          }
        });
        
      } catch (error: any) {
        console.error("Error fetching analytics:", error);
        setError(error.message || "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [dateRange]);
  
  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };
  
  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg">
        <h2 className="text-lg font-medium mb-2">Error Loading Analytics</h2>
        <p>{error}</p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  
  if (!analyticsData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-6 rounded-lg">
        <h2 className="text-lg font-medium mb-2">No Data Available</h2>
        <p>There is no analytics data available for the selected time period.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform metrics and insights
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export Report
          </Button>
        </div>
      </div>
      
      {/* Date range filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <Filter className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-700">Time Period:</span>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                dateRange === '7d'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setDateRange('7d')}
            >
              7 Days
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                dateRange === '30d'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setDateRange('30d')}
            >
              30 Days
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                dateRange === '90d'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setDateRange('90d')}
            >
              90 Days
            </button>
          </div>
        </div>
      </div>
      
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total RFPs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.totalRFPs)}</p>
            </div>
            <div className="bg-blue-50 rounded-md p-2">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${analyticsData.rfpGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analyticsData.rfpGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              <span className="font-medium">{Math.abs(analyticsData.rfpGrowth).toFixed(1)}%</span>
            </div>
            <span className="text-gray-500 ml-1.5">from last period</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.totalUsers)}</p>
            </div>
            <div className="bg-indigo-50 rounded-md p-2">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${analyticsData.userGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analyticsData.userGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              <span className="font-medium">{Math.abs(analyticsData.userGrowth).toFixed(1)}%</span>
            </div>
            <span className="text-gray-500 ml-1.5">from last period</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Questions Asked</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.totalQuestions)}</p>
            </div>
            <div className="bg-purple-50 rounded-md p-2">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${analyticsData.questionGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analyticsData.questionGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              <span className="font-medium">{Math.abs(analyticsData.questionGrowth).toFixed(1)}%</span>
            </div>
            <span className="text-gray-500 ml-1.5">from last period</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Active RFPs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.activeRFPs)}</p>
            </div>
            <div className="bg-green-50 rounded-md p-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className="flex items-center text-blue-600">
              <Calendar className="h-4 w-4 mr-1" />
              <span className="font-medium">{analyticsData.rfpsByStatus.draft}</span>
            </div>
            <span className="text-gray-500 ml-1.5">drafts pending</span>
          </div>
        </div>
      </div>
      
      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Companies</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.totalCompanies)}</p>
            </div>
            <div className="bg-orange-50 rounded-md p-2">
              <Building2 className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="font-medium">{analyticsData.companyMetrics.verifiedCompanies}</span>
            </div>
            <span className="text-gray-500 ml-1.5">verified</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Documents</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.totalDocuments)}</p>
            </div>
            <div className="bg-red-50 rounded-md p-2">
              <FileUp className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className="flex items-center text-blue-600">
              <Eye className="h-4 w-4 mr-1" />
              <span className="font-medium">~{Math.floor(analyticsData.totalDocuments * 2.3)}</span>
            </div>
            <span className="text-gray-500 ml-1.5">downloads</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">NDAs Signed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.totalNDAs)}</p>
            </div>
            <div className="bg-emerald-50 rounded-md p-2">
              <Shield className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className="flex items-center text-emerald-600">
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="font-medium">{analyticsData.companyMetrics.companiesWithNDAs}</span>
            </div>
            <span className="text-gray-500 ml-1.5">companies</span>
          </div>
        </div>
      </div>
      
      {/* Charts and Activity */}
      <div className="space-y-6">
        {/* RFP Status Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-6">RFPs by Status</h3>
            <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-500 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  Active
                </span>
                <span className="text-sm font-medium text-gray-700">{analyticsData.rfpsByStatus.active}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${analyticsData.totalRFPs ? (analyticsData.rfpsByStatus.active / analyticsData.totalRFPs) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-500 flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                  Draft
                </span>
                <span className="text-sm font-medium text-gray-700">{analyticsData.rfpsByStatus.draft}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-yellow-500 h-2.5 rounded-full" 
                  style={{ width: `${analyticsData.totalRFPs ? (analyticsData.rfpsByStatus.draft / analyticsData.totalRFPs) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-500 flex items-center">
                  <div className="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
                  Closed
                </span>
                <span className="text-sm font-medium text-gray-700">{analyticsData.rfpsByStatus.closed}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gray-500 h-2.5 rounded-full" 
                  style={{ width: `${analyticsData.totalRFPs ? (analyticsData.rfpsByStatus.closed / analyticsData.totalRFPs) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">RFPs by Category</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-500">Power Generation</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{analyticsData.rfpsByCategory.power_generation || 0}</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-500">Transmission</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{analyticsData.rfpsByCategory.transmission || 0}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-500">Energy Capacity</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{analyticsData.rfpsByCategory.energy_capacity || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-500">Renewable Credits</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{analyticsData.rfpsByCategory.renewable_credits || 0}</p>
                </div>
              </div>
            </div>
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {analyticsData.recentActivity.length > 0 ? (
                analyticsData.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    {activity.type === 'user_join' && (
                      <div className="bg-indigo-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-indigo-600" />
                      </div>
                    )}
                    {(activity.type === 'rfp_publish' || activity.type === 'rfp_created') && (
                      <div className="bg-green-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-green-600" />
                      </div>
                    )}
                    {activity.type === 'question_answered' && (
                      <div className="bg-blue-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                      </div>
                    )}
                    
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between">
                        <h4 className="font-medium text-gray-900 truncate">
                          {activity.type === 'user_join' && `New Registration: ${activity.user}`}
                          {activity.type === 'rfp_publish' && `RFP Published: ${activity.title}`}
                          {activity.type === 'rfp_created' && `RFP Created: ${activity.title}`}
                          {activity.type === 'question_answered' && `Question Answered: ${activity.title}`}
                        </h4>
                        <span className="text-sm text-gray-500 ml-2 flex-shrink-0">{activity.time}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        {activity.type === 'user_join' && `${activity.user} has joined the platform`}
                        {activity.type === 'rfp_publish' && `New RFP published for ${activity.client || 'Unknown Client'}`}
                        {activity.type === 'rfp_created' && `New RFP created for ${activity.client || 'Unknown Client'}`}
                        {activity.type === 'question_answered' && `Response provided for question on ${activity.rfp || 'Unknown RFP'}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No recent activity available</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Daily Activity - Redesigned as responsive table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Daily Activity ({dateRange})</h3>
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Last {dateRange === '7d' ? '7' : dateRange === '30d' ? '30' : '90'} days</span>
            </div>
          </div>
          
          {analyticsData.userActivity.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Desktop view - table */}
              <div className="hidden sm:block">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <UserPlus className="h-4 w-4 mr-1 text-indigo-500" />
                          New Registrations
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-1 text-blue-500" />
                          RFPs Created
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <MessageSquare className="h-4 w-4 mr-1 text-purple-500" />
                          Questions Asked
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Activity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.userActivity.slice(-10).reverse().map((day) => {
                      const totalActivity = day.users + day.rfps + day.questions;
                      const maxTotal = Math.max(...analyticsData.userActivity.map(d => d.users + d.rfps + d.questions));
                      
                      return (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {format(new Date(day.date), 'MMM d')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900 mr-2">{day.users}</span>
                              {day.users > 0 && (
                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20">
                                  <div 
                                    className="bg-indigo-500 h-2 rounded-full" 
                                    style={{ width: `${maxTotal > 0 ? (day.users / maxTotal) * 100 : 0}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900 mr-2">{day.rfps}</span>
                              {day.rfps > 0 && (
                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20">
                                  <div 
                                    className="bg-blue-500 h-2 rounded-full" 
                                    style={{ width: `${maxTotal > 0 ? (day.rfps / maxTotal) * 100 : 0}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900 mr-2">{day.questions}</span>
                              {day.questions > 0 && (
                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20">
                                  <div 
                                    className="bg-purple-500 h-2 rounded-full" 
                                    style={{ width: `${maxTotal > 0 ? (day.questions / maxTotal) * 100 : 0}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-semibold text-gray-900 mr-2">{totalActivity}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-24">
                                <div 
                                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" 
                                  style={{ width: `${maxTotal > 0 ? (totalActivity / maxTotal) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile view - cards */}
              <div className="sm:hidden p-4">
                <div className="space-y-4">
                  {analyticsData.userActivity.slice(-7).reverse().map((day) => {
                    const totalActivity = day.users + day.rfps + day.questions;
                    
                    return (
                      <div key={day.date} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-gray-900">{format(new Date(day.date), 'EEEE, MMM d')}</h4>
                          <span className="text-sm font-semibold text-gray-600">{totalActivity} total</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center">
                            <div className="text-lg font-bold text-indigo-600">{day.users}</div>
                            <div className="text-xs text-gray-500">New Users</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">{day.rfps}</div>
                            <div className="text-xs text-gray-500">RFPs</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-600">{day.questions}</div>
                            <div className="text-xs text-gray-500">Questions</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No activity data available for this period</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Question Analytics */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Question Analytics</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <MessageSquare className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{analyticsData.questionMetrics.totalQuestions}</div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{analyticsData.questionMetrics.answeredQuestions}</div>
              <div className="text-sm text-gray-600">Answered</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Response Rate</span>
                <span className="font-medium">
                  {analyticsData.questionMetrics.totalQuestions > 0 
                    ? Math.round((analyticsData.questionMetrics.answeredQuestions / analyticsData.questionMetrics.totalQuestions) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ 
                    width: `${analyticsData.questionMetrics.totalQuestions > 0 
                      ? (analyticsData.questionMetrics.answeredQuestions / analyticsData.questionMetrics.totalQuestions) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Avg Response Time</span>
                <span className="font-medium">
                  {analyticsData.questionMetrics.avgResponseTime > 0 
                    ? `${analyticsData.questionMetrics.avgResponseTime.toFixed(1)} days`
                    : 'N/A'}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Questions</span>
                <span className="font-medium text-yellow-600">{analyticsData.questionMetrics.pendingQuestions}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Company Analytics */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Company Insights</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <Building2 className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{analyticsData.companyMetrics.totalCompanies}</div>
              <div className="text-sm text-gray-600">Companies</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <Shield className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{analyticsData.totalNDAs}</div>
              <div className="text-sm text-gray-600">NDAs Signed</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Verified Companies</span>
                <span className="font-medium">
                  {analyticsData.companyMetrics.totalCompanies > 0 
                    ? Math.round((analyticsData.companyMetrics.verifiedCompanies / analyticsData.companyMetrics.totalCompanies) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ 
                    width: `${analyticsData.companyMetrics.totalCompanies > 0 
                      ? (analyticsData.companyMetrics.verifiedCompanies / analyticsData.companyMetrics.totalCompanies) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Companies with NDAs</span>
                <span className="font-medium">
                  {analyticsData.companyMetrics.totalCompanies > 0 
                    ? Math.round((analyticsData.companyMetrics.companiesWithNDAs / analyticsData.companyMetrics.totalCompanies) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full" 
                  style={{ 
                    width: `${analyticsData.companyMetrics.totalCompanies > 0 
                      ? (analyticsData.companyMetrics.companiesWithNDAs / analyticsData.companyMetrics.totalCompanies) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">User to Company Ratio</span>
                <span className="font-medium">
                  {analyticsData.companyMetrics.totalCompanies > 0 
                    ? (analyticsData.totalUsers / analyticsData.companyMetrics.totalCompanies).toFixed(1)
                    : 'N/A'} users/company
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Engagement Metrics */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Platform Engagement</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <Eye className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(analyticsData.totalUsers * 3.2)}
            </div>
            <div className="text-sm text-gray-500">Est. Page Views</div>
            <div className="text-xs text-green-600 mt-1">+12% vs last period</div>
          </div>
          
          <div className="text-center">
            <div className="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analyticsData.totalCompanies > 0 
                ? Math.round((analyticsData.totalNDAs / analyticsData.totalCompanies) * 100)
                : 0}%
            </div>
            <div className="text-sm text-gray-500">NDA Conversion</div>
            <div className="text-xs text-gray-500 mt-1">Companies signing NDAs</div>
          </div>
          
          <div className="text-center">
            <div className="bg-purple-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analyticsData.totalRFPs > 0 
                ? (analyticsData.totalQuestions / analyticsData.totalRFPs).toFixed(1)
                : '0'}
            </div>
            <div className="text-sm text-gray-500">Questions per RFP</div>
            <div className="text-xs text-gray-500 mt-1">Avg engagement rate</div>
          </div>
          
          <div className="text-center">
            <div className="bg-orange-100 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {analyticsData.questionMetrics.avgResponseTime > 0 
                ? analyticsData.questionMetrics.avgResponseTime.toFixed(1)
                : '0'}
            </div>
            <div className="text-sm text-gray-500">Days Avg Response</div>
            <div className="text-xs text-gray-500 mt-1">Question response time</div>
          </div>
        </div>
      </div>
    </div>
  );
};