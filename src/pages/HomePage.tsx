import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RFP } from '../types';
import { Button } from '../components/ui/Button';
import { 
  ArrowRight,
  BarChart3,
  Calendar,
  Filter, 
  Search,
  Zap,
  FileText, 
  Users, 
  MessageSquare, 
  Shield, 
  Building,
  Building2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

// Helper function to determine RFP display status
const getRFPDisplayStatus = (rfp: RFP) => {
  // If RFP is marked as closed in database, show closed
  if (rfp.status === 'closed') {
    return 'closed';
  }
  
  // If RFP is draft, show draft
  if (rfp.status === 'draft') {
    return 'draft';
  }
  
  // If RFP is active and past closing date, show closed
  const now = new Date();
  const closingDate = new Date(rfp.closing_date);
  
  if (rfp.status === 'active' && closingDate.getTime() < now.getTime()) {
    return 'closed';
  }
  
  // Otherwise show active
  return 'active';
};

// Helper function to sort RFPs by priority: Active → Closed → Draft
const sortRFPsByPriority = (rfps: RFP[]) => {
  return rfps.sort((a, b) => {
    const statusA = getRFPDisplayStatus(a);
    const statusB = getRFPDisplayStatus(b);
    
    const statusPriority = {
      'active': 1,
      'closed': 2,
      'draft': 3
    };
    
    const priorityA = statusPriority[statusA] || 4;
    const priorityB = statusPriority[statusB] || 4;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // If same status, sort by closing date (earliest first for active, latest first for closed)
    if (statusA === 'closed') {
      return new Date(b.closing_date).getTime() - new Date(a.closing_date).getTime();
    }
    return new Date(a.closing_date).getTime() - new Date(b.closing_date).getTime();
  });
};

// Category map for display
const categoryMap = {
  'power_generation': 'Power Generation',
  'transmission': 'Transmission',
  'energy_capacity': 'Energy & Capacity',
  'renewable_credits': 'Renewable Credits',
  'other': 'Other'
};

export const HomePage: React.FC = () => {
  const [rfps, setRFPs] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchRFPs = async () => {
      try {
        // Fetch RFPs with simpler query for current schema
        const { data, error } = await supabase
          .from('rfps')
          .select('*')
          .eq('visibility', 'public')
          .in('status', ['active', 'closed']) // Include both active and closed RFPs
          .order('closing_date', { ascending: true })
          .limit(8); // Get more to allow for proper sorting
        
        if (error) {
          console.error('Supabase error fetching RFPs:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          console.log('Fetched RFPs for homepage:', data);
          // Sort by Extended, Active, Closed priority and take top 4
          const sortedRFPs = sortRFPsByPriority(data);
          setRFPs(sortedRFPs.slice(0, 4));
        } else {
          console.log('No active RFPs found in database');
          setRFPs([]);
        }
      } catch (error: any) {
        console.error('Error fetching RFPs:', error);
        setError('Failed to load RFPs. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRFPs();
  }, []);
  
  // Filter RFPs by search term and category
  const filteredRFPs = rfps.filter(rfp => {
    const matchesSearch = !searchTerm || 
      rfp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfp.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesFilter = !activeFilter || rfp.categories.includes(activeFilter as any);
    
    return matchesSearch && matchesFilter;
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  };
  
  // Get display status badge for RFPs
  const getStatusBadge = (rfp: RFP) => {
    const status = getRFPDisplayStatus(rfp);
    
    switch(status) {
      case 'active':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          label: 'Active'
        };
      case 'closed':
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          label: 'Closed'
        };
      case 'draft':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          label: 'Draft'
        };
      default:
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          label: 'Active'
        };
    }
  };
  
  return (
    <div className="space-y-12">
      {/* Hero section with RFP focus */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-600 rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-800/40 to-transparent"></div>
        <div className="relative px-8 py-20 sm:px-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full px-4 py-1 w-fit mb-6">
              <FileText className="h-4 w-4" />
              <span>Central Hub for Energy RFPs</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl mb-6">
              Find Energy RFPs <span className="text-blue-200">in One Place</span>
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mb-10">
              Access all active RFPs managed by Charles River Associates for utilities across North America. 
              Register to receive notifications about new opportunities in your area of expertise.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg shadow-blue-900/20 w-full sm:w-auto">
                  Register for Updates
                </Button>
              </Link>
              <Link to="/rfps/browse">
                <Button size="lg" variant="outline" className="text-white border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 w-full sm:w-auto">
                  Browse Active RFPs
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-gradient-to-tl from-blue-400/30 to-transparent rounded-full blur-2xl"></div>
      </div>

      {/* RFP Browse Section */}
      <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50 to-transparent rounded-full"></div>
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Active RFPs</h2>
              <p className="text-gray-500 mt-1">Browse current opportunities</p>
            </div>
            
            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search RFPs..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                {['power_generation', 'transmission', 'energy_capacity', 'renewable_credits'].map(category => (
                  <button
                    key={category}
                    className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium ${
                      activeFilter === category 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveFilter(activeFilter === category ? null : category)}
                  >
                    {categoryMap[category as keyof typeof categoryMap]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* RFP Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-3 flex justify-center py-12">
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                  <p className="text-gray-600">Loading RFPs...</p>
                </div>
              </div>
            ) : error ? (
              <div className="col-span-3 bg-red-50 rounded-xl p-12 text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-medium text-red-900 mb-1">Error Loading RFPs</h3>
                <p className="text-red-600 mb-4">{error}</p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            ) : filteredRFPs.length === 0 ? (
              <div className="col-span-3 bg-gray-50 rounded-xl p-12 text-center">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No RFPs Available</h3>
                <p className="text-sm text-gray-500">
                  {searchTerm || activeFilter
                    ? "No RFPs match your search criteria."
                    : "There are currently no active RFPs. Check back soon for new opportunities."}
                </p>
              </div>
            ) : (
              filteredRFPs.map((rfp) => {
                const statusBadge = getStatusBadge(rfp);
                return (
                <div 
                  key={rfp.id} 
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  <div className="p-6">
                    {rfp.logo_url && (
                      <div className="mb-4 h-12 flex items-center">
                        <img 
                          src={rfp.logo_url} 
                          alt={`${rfp.client_name} logo`}
                          className="max-h-12 object-contain"
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2 flex-wrap">
                        {rfp.categories.map(category => (
                          <span 
                            key={category} 
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                          >
                            {categoryMap[category as keyof typeof categoryMap]}
                          </span>
                        ))}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {rfp.title}
                    </h3>
                    
                    <p className="text-gray-600 mb-4 line-clamp-1">
                      {rfp.client_name}
                    </p>
                    
                    <div className="flex items-center text-sm text-gray-500 mb-6 gap-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1.5 text-gray-400" />
                        <span>Closes: {formatDate(rfp.closing_date)}</span>
                      </div>
                    </div>
                    
                    <Link to={`/rfps/${rfp.id}`}>
                      <Button fullWidth className="mt-auto flex justify-center items-center gap-2">
                        <span>View Details</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                );
              })
            )}
          </div>
          
          {/* View all link */}
          <div className="flex justify-center mt-8">
            <Link to="/rfps/browse" className="flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700">
              <span>View all active RFPs</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 rounded-3xl p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent"></div>
        <div className="relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How the RFP Platform Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A streamlined process for discovering and responding to energy RFP opportunities
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">1</div>
              <div className="pt-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Discover Opportunities</h3>
                <p className="text-gray-600">
                  Browse active RFPs from utilities across North America. Filter by category, location, and closing dates to find relevant opportunities.
                </p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">2</div>
              <div className="pt-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Access Documents & Ask Questions</h3>
                <p className="text-gray-600">
                  Download RFP documents, specifications, and requirements. Submit questions through our structured Q&A system and receive official responses.
                </p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">3</div>
              <div className="pt-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Submit Your Proposal</h3>
                <p className="text-gray-600">
                  Prepare and submit your proposals following the RFP guidelines. Track submission status and receive updates throughout the evaluation process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Registration Section */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/30 to-transparent rounded-full blur-3xl"></div>
        <div className="relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center space-x-2 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full px-4 py-1 w-fit mx-auto mb-6">
              <Users className="h-4 w-4" />
              <span>For Energy Developers & Contractors</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Never Miss an RFP Opportunity</h2>
            <p className="text-green-100 text-lg mb-8 max-w-2xl mx-auto">
              Register to receive email notifications when new RFPs are published that match your expertise. 
              Get early access to opportunities in your sectors and regions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-green-200" />
                <h3 className="font-semibold mb-2">Instant Notifications</h3>
                <p className="text-sm text-green-100">Get alerts when new RFPs match your criteria</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-green-200" />
                <h3 className="font-semibold mb-2">Company Profiles</h3>
                <p className="text-sm text-green-100">Create team accounts and manage proposals together</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-green-200" />
                <h3 className="font-semibold mb-2">Direct Communication</h3>
                <p className="text-sm text-green-100">Direct communication with utility procurement teams</p>
              </div>
            </div>
            <Link to="/signup">
              <Button size="lg" className="bg-white text-green-700 hover:bg-green-50 shadow-lg">
                Register for Free RFP Updates
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-purple-500/30 to-transparent rounded-full blur-3xl"></div>
        <div className="relative md:flex md:items-center md:justify-between">
          <div className="mb-6 md:mb-0">
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full px-4 py-1 w-fit mb-4">
              <Building className="h-4 w-4" />
              <span>For Utilities & Energy Companies</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Need expert RFP management?</h2>
            <p className="text-purple-100 text-lg">
              Charles River Associates offers comprehensive procurement consulting services with 40+ years of energy market expertise.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/contact">
              <Button size="lg" className="bg-white text-purple-700 hover:bg-purple-50 shadow-lg w-full sm:w-auto">
                Contact CRA Consulting
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 w-full sm:w-auto">
                Learn About CRA
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Platform Features for Energy Professionals
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-blue-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Comprehensive RFP Database</h3>
            <p className="text-gray-600">
              Access current and historical RFPs from utilities across North America. Filter by project type, capacity, and region to find relevant opportunities.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-purple-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Structured Q&A System</h3>
            <p className="text-gray-600">
              Submit questions directly to utility procurement teams. View all Q&A exchanges to better understand project requirements and expectations.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-orange-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Timeline Management</h3>
            <p className="text-gray-600">
              Track important dates, milestones, and deadlines. Receive notifications about closing dates and key events in the procurement process.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-green-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Team Collaboration</h3>
            <p className="text-gray-600">
              Collaborate with your team members on proposal development. Share access to documents and coordinate responses across your organization.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-red-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Document Access</h3>
            <p className="text-gray-600">
              Access technical specifications, contract templates, and confidential documents through secure, role-based permissions and digital agreements.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-indigo-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional Management</h3>
            <p className="text-gray-600">
              RFPs are professionally managed by Charles River Associates, ensuring fair process, timely communication, and regulatory compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};