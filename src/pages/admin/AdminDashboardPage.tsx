import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  BarChart3, 
  Users, 
  FileText, 
  MessageSquare, 
  Calendar, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  FileQuestion,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface DashboardMetrics {
  totalRFPs: number;
  activeRFPs: number;
  totalUsers: number;
  totalQuestions: number;
  totalDocuments: number;
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
}

interface RecentActivity {
  id: string;
  type: string;
  user?: string;
  company?: string;
  title?: string;
  client?: string;
  rfp?: string;
  created_at: string;
}

interface UpcomingDeadline {
  id: string;
  title: string;
  client_name: string;
  status: string;
  closing_date: string;
  days_remaining: number;
}

// Format numbers with commas
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Calculate days remaining
const calculateDaysRemaining = (closingDate: string) => {
  const now = new Date();
  const targetDate = new Date(closingDate);
  
  // Reset time part for accurate day calculation
  targetDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  // Calculate difference in milliseconds and convert to days
  const diffInTime = targetDate.getTime() - now.getTime();
  const diffInDays = Math.ceil(diffInTime / (1000 * 3600 * 24));
  
  console.log('Days remaining:', diffInDays);
  return diffInDays;
};

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export const AdminDashboardPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRFPs: 0,
    activeRFPs: 0,
    totalUsers: 0,
    totalQuestions: 0,
    totalDocuments: 0,
    rfpGrowth: 0,
    userGrowth: 0,
    questionGrowth: 0,
    rfpsByStatus: {
      active: 0,
      draft: 0,
      closed: 0
    },
    rfpsByCategory: {}
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Note: Removed auto-close functionality per user request
        // RFPs will remain in their current status until manually changed
        
        // Fetch total RFPs and status counts
        const { data: rfpData, error: rfpError } = await supabase
          .from('rfps')
          .select('id, status, categories, closing_date, title, client_name');
          
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
        
        // Fetch total users
        const { count: userCount, error: userError } = await supabase
          .from('profiles')
          .select('id', { count: 'exact' });
          
        if (userError) throw userError;
        
        // Fetch total questions
        const { count: questionCount, error: questionError } = await supabase
          .from('questions')
          .select('id', { count: 'exact' });
          
        if (questionError) throw questionError;
        
        // Fetch total documents
        const { count: documentCount, error: documentError } = await supabase
          .from('documents')
          .select('id', { count: 'exact' });
          
        if (documentError) throw documentError;
        
        // Calculate growth rates (last 30 days vs previous 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        // RFP growth
        const { data: recentRFPs } = await supabase
          .from('rfps')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString());
          
        const { data: previousRFPs } = await supabase
          .from('rfps')
          .select('created_at')
          .gte('created_at', sixtyDaysAgo.toISOString())
          .lt('created_at', thirtyDaysAgo.toISOString());
          
        const rfpGrowth = previousRFPs?.length 
          ? ((recentRFPs?.length || 0) - previousRFPs.length) / previousRFPs.length * 100 
          : 100;
        
        // User growth
        const { data: recentUsers } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString());
          
        const { data: previousUsers } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', sixtyDaysAgo.toISOString())
          .lt('created_at', thirtyDaysAgo.toISOString());
          
        const userGrowth = previousUsers?.length 
          ? ((recentUsers?.length || 0) - previousUsers.length) / previousUsers.length * 100 
          : 100;
        
        // Question growth
        const { data: recentQuestions } = await supabase
          .from('questions')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString());
          
        const { data: previousQuestions } = await supabase
          .from('questions')
          .select('created_at')
          .gte('created_at', sixtyDaysAgo.toISOString())
          .lt('created_at', thirtyDaysAgo.toISOString());
          
        const questionGrowth = previousQuestions?.length 
          ? ((recentQuestions?.length || 0) - previousQuestions.length) / previousQuestions.length * 100 
          : 100;
        
        // Prepare upcoming deadlines
        const upcomingRFPs = rfpData
          ?.filter(rfp => rfp.status === 'active')
          .map(rfp => ({
            id: rfp.id,
            title: rfp.title,
            client_name: rfp.client_name,
            status: rfp.status,
            closing_date: rfp.closing_date,
            days_remaining: calculateDaysRemaining(rfp.closing_date)
          }))
          .filter(rfp => rfp.days_remaining >= 0) // Include today's deadlines
          .sort((a, b) => a.days_remaining - b.days_remaining)
          .slice(0, 3);
        
        setUpcomingDeadlines(upcomingRFPs || []);
        
        // Fetch recent activity from analytics_events
        // Fetch recent activity from multiple sources
        const recentActivityPromises = [
          // Recent RFP activities
          supabase
            .from('rfps')
            .select('id, title, client_name, status, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(5),
          
          // Recent user registrations
          supabase
            .from('profiles')
            .select('id, first_name, last_name, company, email, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          
          // Recent questions
          supabase
            .from('questions')
            .select(`
              id, question, status, created_at, answered_at,
              rfps!inner(title, client_name),
              profiles!inner(first_name, last_name, company)
            `)
            .order('created_at', { ascending: false })
            .limit(5),
          
          // Recent companies
          supabase
            .from('companies')
            .select(`
              id, name, created_at,
              profiles!companies_created_by_fkey(first_name, last_name)
            `)
            .order('created_at', { ascending: false })
            .limit(3)
        ];
        
        const [rfpResults, userResults, questionResults, companyResults] = await Promise.all(recentActivityPromises);
        
        // Combine and transform all activities
        const allActivities: RecentActivity[] = [];
        
        // Add RFP activities
        if (rfpResults.data) {
          rfpResults.data.forEach(rfp => {
            allActivities.push({
              id: `rfp-${rfp.id}`,
              type: 'rfp_created',
              title: rfp.title,
              client: rfp.client_name,
              created_at: rfp.created_at
            });
          });
        }
        
        // Add user registrations
        if (userResults.data) {
          userResults.data.forEach(user => {
            allActivities.push({
              id: `user-${user.id}`,
              type: 'user_join',
              user: `${user.first_name} ${user.last_name}`,
              company: user.company || 'Independent',
              created_at: user.created_at
            });
          });
        }
        
        // Add question activities
        if (questionResults.data) {
          questionResults.data.forEach(question => {
            if (question.status === 'published' && question.answered_at) {
              allActivities.push({
                id: `question-${question.id}`,
                type: 'question_answered',
                title: question.rfps?.title || 'Unknown RFP',
                user: question.profiles ? `${question.profiles.first_name} ${question.profiles.last_name}` : 'Unknown User',
                created_at: question.answered_at
              });
            }
          });
        }
        
        // Add company activities
        if (companyResults.data) {
          companyResults.data.forEach(company => {
            allActivities.push({
              id: `company-${company.id}`,
              type: 'company_created',
              title: company.name,
              user: company.profiles ? `${company.profiles.first_name} ${company.profiles.last_name}` : 'Unknown User',
              created_at: company.created_at
            });
          });
        }
        
        // Sort all activities by date and take most recent
        const transformedActivity = allActivities
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);
        
        // Update state with all metrics
        setMetrics({
          totalRFPs: rfpData?.length || 0,
          activeRFPs: rfpsByStatus.active,
          totalUsers: userCount || 0,
          totalQuestions: questionCount || 0,
          totalDocuments: documentCount || 0,
          rfpGrowth,
          userGrowth: userGrowth,
          questionGrowth: questionGrowth,
          rfpsByStatus,
          rfpsByCategory: categoryCount
        });
        
        setRecentActivity(transformedActivity);
        
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">Overview and management of the RFP platform</p>
        </div>
        <Link to="/admin/rfps/new">
          <Button leftIcon={<FileText className="h-4 w-4" />}>
            Create New RFP
          </Button>
        </Link>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total RFPs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(metrics.totalRFPs)}</p>
            </div>
            <div className="bg-blue-50 rounded-md p-2">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${metrics.rfpGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.rfpGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              <span className="font-medium">{Math.abs(metrics.rfpGrowth).toFixed(1)}%</span>
            </div>
            <span className="text-gray-500 ml-1.5">from last month</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Registered Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(metrics.totalUsers)}</p>
            </div>
            <div className="bg-indigo-50 rounded-md p-2">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${metrics.userGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.userGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              <span className="font-medium">{Math.abs(metrics.userGrowth).toFixed(1)}%</span>
            </div>
            <span className="text-gray-500 ml-1.5">from last month</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Questions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(metrics.totalQuestions)}</p>
            </div>
            <div className="bg-purple-50 rounded-md p-2">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className={`flex items-center ${metrics.questionGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.questionGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              <span className="font-medium">{Math.abs(metrics.questionGrowth).toFixed(1)}%</span>
            </div>
            <span className="text-gray-500 ml-1.5">from last month</span>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Active RFPs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(metrics.activeRFPs)}</p>
            </div>
            <div className="bg-green-50 rounded-md p-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <div className="flex items-center text-blue-600">
              <Calendar className="h-4 w-4 mr-1" />
              <span className="font-medium">{metrics.rfpsByStatus.draft}</span>
            </div>
            <span className="text-gray-500 ml-1.5">drafts pending</span>
          </div>
        </div>
      </div>
      
      {/* Charts and Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RFP Status Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-medium text-gray-900">RFPs by Status</h3>
            <Link to="/admin/rfps">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-500 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  Active
                </span>
                <span className="text-sm font-medium text-gray-700">{metrics.rfpsByStatus.active}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${metrics.totalRFPs ? (metrics.rfpsByStatus.active / metrics.totalRFPs) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-500 flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                  Draft
                </span>
                <span className="text-sm font-medium text-gray-700">{metrics.rfpsByStatus.draft}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-yellow-500 h-2.5 rounded-full" 
                  style={{ width: `${metrics.totalRFPs ? (metrics.rfpsByStatus.draft / metrics.totalRFPs) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-500 flex items-center">
                  <div className="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
                  Closed
                </span>
                <span className="text-sm font-medium text-gray-700">{metrics.rfpsByStatus.closed}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gray-500 h-2.5 rounded-full" 
                  style={{ width: `${metrics.totalRFPs ? (metrics.rfpsByStatus.closed / metrics.totalRFPs) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-base font-medium text-gray-900 mb-4">RFPs by Category</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-500">Power Generation</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{metrics.rfpsByCategory.power_generation || 0}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-500">Transmission</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{metrics.rfpsByCategory.transmission || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-500">Energy Capacity</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{metrics.rfpsByCategory.energy_capacity || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-500">Renewable Credits</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{metrics.rfpsByCategory.renewable_credits || 0}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-medium text-gray-900">Recent Activity</h3>
            <Link to="/admin/analytics">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
          
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No recent activity to display</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  {activity.type === 'user_join' && (
                    <div className="bg-indigo-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                  )}
                  {activity.type === 'rfp_publish' && (
                    <div className="bg-green-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                  )}
                  {activity.type === 'question_submitted' && (
                    <div className="bg-orange-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-orange-600" />
                    </div>
                  )}
                  {activity.type === 'question_answered' && (
                    <div className="bg-blue-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                  {activity.type === 'rfp_close' && (
                    <div className="bg-gray-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <XCircle className="h-5 w-5 text-gray-600" />
                    </div>
                  )}
                  {activity.type === 'company_created' && (
                    <div className="bg-purple-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                  )}
                  {(activity.type === 'rfp_created' || activity.type === 'rfp_publish') && (
                    <div className="bg-green-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                  )}
                  {(activity.type === 'rfp_close' || activity.type === 'rfp_closed') && (
                    <div className="bg-gray-100 rounded-full p-2 h-10 w-10 flex items-center justify-center flex-shrink-0">
                      <XCircle className="h-5 w-5 text-gray-600" />
                    </div>
                  )}
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between">
                      <h4 className="font-medium text-gray-900 truncate">
                        {activity.type === 'user_join' && `New User: ${activity.user}`}
                        {(activity.type === 'rfp_publish' || activity.type === 'rfp_created') && `RFP Created: ${activity.title}`}
                        {activity.type === 'question_submitted' && `Question Submitted: ${activity.title}`}
                        {activity.type === 'question_answered' && `Question Answered: ${activity.title}`}
                        {activity.type === 'company_created' && `Company Created: ${activity.title}`}
                        {(activity.type === 'rfp_close' || activity.type === 'rfp_closed') && `RFP Closed: ${activity.title}`}
                      </h4>
                      <span className="text-sm text-gray-500 ml-2 flex-shrink-0">{formatRelativeTime(activity.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      {activity.type === 'user_join' && `${activity.user} from ${activity.company} has joined the platform`}
                      {(activity.type === 'rfp_publish' || activity.type === 'rfp_created') && `New RFP created for ${activity.client || 'Unknown Client'}`}
                      {activity.type === 'question_submitted' && `${activity.user} submitted a question about ${activity.title}`}
                      {activity.type === 'question_answered' && `Response provided for question on ${activity.title || 'Unknown RFP'}`}
                      {activity.type === 'company_created' && `${activity.user || 'Unknown User'} created a new company`}
                      {(activity.type === 'rfp_close' || activity.type === 'rfp_closed') && `${activity.title} for ${activity.client || 'Unknown Client'} has been closed`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center mb-4">
            <FileText className="h-6 w-6 mr-3" />
            <h3 className="text-lg font-semibold">Manage RFPs</h3>
          </div>
          <p className="text-blue-100 mb-4">Create, edit, and publish RFPs. Review draft RFPs before publishing.</p>
          <Link to="/admin/rfps">
            <Button className="mt-2 bg-white text-blue-700 hover:bg-blue-50">
              Go to RFPs
            </Button>
          </Link>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center mb-4">
            <Users className="h-6 w-6 mr-3" />
            <h3 className="text-lg font-semibold">User Management</h3>
          </div>
          <p className="text-indigo-100 mb-4">View and manage users. Approve new accounts and adjust role permissions.</p>
          <Link to="/admin/users">
            <Button className="mt-2 bg-white text-indigo-700 hover:bg-indigo-50">
              Manage Users
            </Button>
          </Link>
        </div>
        
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center mb-4">
            <FileQuestion className="h-6 w-6 mr-3" />
            <h3 className="text-lg font-semibold">Q&A Management</h3>
          </div>
          <p className="text-purple-100 mb-4">Review and answer questions. Moderate and publish responses to bidders.</p>
          <Link to="/admin/questions">
            <Button className="mt-2 bg-white text-purple-700 hover:bg-purple-50">
              View Questions
            </Button>
          </Link>
        </div>
        
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center mb-4">
            <TrendingUp className="h-6 w-6 mr-3" />
            <h3 className="text-lg font-semibold">Analytics</h3>
          </div>
          <p className="text-green-100 mb-4">View detailed platform analytics, usage metrics, and engagement statistics.</p>
          <Link to="/admin/analytics">
            <Button className="mt-2 bg-white text-green-700 hover:bg-green-50">
              View Reports
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-medium text-gray-900">Upcoming Deadlines</h3>
          <Button variant="outline" size="sm">View Calendar</Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RFP Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Closing Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Remaining
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {upcomingDeadlines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No upcoming deadlines found
                  </td>
                </tr>
              ) : (
                upcomingDeadlines.map((rfp) => (
                  <tr key={rfp.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{rfp.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{rfp.client_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {rfp.status.charAt(0).toUpperCase() + rfp.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(rfp.closing_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock className={`h-4 w-4 mr-2 ${
                          rfp.days_remaining <= 7 ? 'text-red-500' : 
                          rfp.days_remaining <= 14 ? 'text-amber-500' : 
                          'text-green-500'
                        }`} />
                        <span className={`text-sm font-medium ${
                          rfp.days_remaining <= 7 ? 'text-red-500' : 
                          rfp.days_remaining <= 14 ? 'text-amber-500' : 
                          'text-green-500'
                        }`}>
                          {rfp.days_remaining} days
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/admin/rfps/${rfp.id}/edit`} className="text-indigo-600 hover:text-indigo-900">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};