import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RFP } from '../types';
import { 
  ArrowRight, 
  Calendar, 
  Filter, 
  Search, 
  SlidersHorizontal, 
  Building2,
  XCircle,
  CheckCircle2,
  Clock,
  Tag,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { format } from 'date-fns';

// Category map for display
const categoryMap = {
  'power_generation': 'Power Generation',
  'transmission': 'Transmission',
  'energy_capacity': 'Energy & Capacity',
  'renewable_credits': 'Renewable Credits',
  'other': 'Other'
};

export const RFPListingPage: React.FC = () => {
  const [rfps, setRFPs] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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
  const sortRFPsByDisplayPriority = (rfps: RFP[]) => {
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

      // If same status, sort by closing date
      return new Date(a.closing_date).getTime() - new Date(b.closing_date).getTime();
    });
  };

  useEffect(() => {
    const fetchRFPs = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Fetching RFPs with status filter:', statusFilter || 'all');

        let query = supabase
          .from('rfps')
          .select('*');

        // Apply status filter if set
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }

        // By default, show active and extended RFPs (past deadline but not closed)
        if (!statusFilter) {
          query = query.in('status', ['active', 'closed']);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error fetching RFPs:', error);
          throw error;
        }

        console.log('Fetched RFPs:', data);
        setRFPs(data || []);
      } catch (error: any) {
        console.error('Error fetching RFPs:', error);
        setError('Failed to load RFPs. Please try again. Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRFPs();
  }, [statusFilter]);

  // Filter RFPs by search term, category, and status
  const filteredAndSortedRFPs = sortRFPsByDisplayPriority(rfps.filter(rfp => {
    const matchesSearch = !searchTerm ||
      rfp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfp.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfp.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !activeFilter || rfp.categories.includes(activeFilter as any);

    return matchesSearch && matchesCategory;
  }));
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy');
  };
  
  // Get status badge styles
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          icon: <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        };
      case 'draft':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          icon: <Clock className="h-3.5 w-3.5 mr-1" />
        };
      case 'closed':
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          icon: <XCircle className="h-3.5 w-3.5 mr-1" />
        };
      default:
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          icon: null
        };
    }
  };
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Request for Proposals</h1>
          <p className="text-gray-500 mt-1">Browse all available RFPs</p>
        </div>
        
        <div className="flex gap-3">
          <Link to="/rfps/saved">
            <Button variant="outline" leftIcon={<Tag className="h-4 w-4" />}>
              Saved
            </Button>
          </Link>
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
      
      {/* Search and filters */}
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 ${showFilters ? 'max-h-96' : 'max-h-20'}`}>
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by title, client, or description..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Button 
              variant="primary"
              leftIcon={<Search className="h-4 w-4" />}
            >
              Search
            </Button>
          </div>
        </div>
        
        {/* Advanced filters */}
        {showFilters && (
          <div className="p-5 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(categoryMap).map(([key, value]) => (
                    <button
                      key={key}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                        activeFilter === key 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => setActiveFilter(activeFilter === key ? null : key)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <div className="flex flex-wrap gap-2">
                  {['active', 'draft', 'closed'].map((status) => (
                    <button
                      key={status}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                        statusFilter === status 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Date Range</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-5">
              <Button 
                variant="outline" 
                className="mr-2"
                onClick={() => {
                  setSearchTerm('');
                  setActiveFilter(null);
                  setStatusFilter(null);
                }}
              >
                Clear All
              </Button>
              <Button>Apply Filters</Button>
            </div>
          </div>
        )}
      </div>
    
      {/* RFP Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
            <p className="text-gray-600">Loading RFPs...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading RFPs</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline" 
          >
            Try Again
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedRFPs.length > 0 ? (
            filteredAndSortedRFPs.map((rfp) => {
              const displayStatus = getRFPDisplayStatus(rfp);
              const statusBadge = getStatusBadge(displayStatus);
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
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center uppercase ${statusBadge.bg} ${statusBadge.text}`}>
                        {statusBadge.icon}
                        {displayStatus}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {rfp.title}
                  </h3>
                  
                  <div className="flex items-center text-gray-600 mb-3">
                    <Building2 className="h-4 w-4 mr-1.5 text-gray-400" />
                    <p className="line-clamp-1">{rfp.client_name}</p>
                  </div>
                  
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {rfp.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-5 border-t border-gray-100 pt-4 mt-4">
                    <div className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-gray-400" />
                      <span>Issued: {formatDate(rfp.issue_date)}</span>
                    </div>
                    <div className="flex items-center font-medium">
                      <Calendar className="h-3.5 w-3.5 mr-1 text-gray-400" />
                      <span>Closes: {formatDate(rfp.closing_date)}</span>
                    </div>
                  </div>
                  
                  <Link to={`/rfps/${rfp.id}`}>
                    <Button 
                      fullWidth 
                      variant={displayStatus === 'closed' ? 'outline' : 'primary'}
                      disabled={rfp.status === 'closed'}
                      rightIcon={<ArrowRight className="h-4 w-4" />}
                    >
                      <span>{displayStatus === 'closed' ? 'View Details' : 'View RFP'}</span>
                    </Button>
                  </Link>
                </div>
              </div>
              );
            })
          ) : (
            <div className="col-span-3 bg-gray-50 rounded-xl p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No RFPs found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || activeFilter || statusFilter
                  ? "We couldn't find any RFPs matching your search criteria."
                  : "There are currently no RFPs to display."}
              </p>
              {(searchTerm || activeFilter || statusFilter) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setActiveFilter(null);
                    setStatusFilter(null);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};