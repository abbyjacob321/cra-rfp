import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Filter, SlidersHorizontal, Plus, MoreHorizontal, Calendar, CheckCircle, Clock, XCircle, Eye, CreditCard as Edit, Trash2, ArrowUpDown, Download, Building2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { RFP } from '../../types';
import { format } from 'date-fns';

// Category map for display
const categoryMap = {
  'power_generation': 'Power Generation',
  'transmission': 'Transmission',
  'energy_capacity': 'Energy & Capacity',
  'renewable_credits': 'Renewable Credits',
  'other': 'Other'
};

export const RFPManagementPage: React.FC = () => {
  const [rfps, setRFPs] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('closing_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRFPs, setSelectedRFPs] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const fetchRFPs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase.from('rfps').select('*');
        
      // Apply status filter if set
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
        
      const { data, error } = await query.order('created_at', { ascending: false });
        
      if (error) throw error;
        
      console.log('Fetched RFPs from Supabase:', data);
      setRFPs(data || []);
    } catch (error: any) {
      console.error('Error fetching RFPs:', error);
      setError('Failed to load RFPs. Please try again.');
    } finally {
      setLoading(false);
    }
  };
    
  useEffect(() => {
    fetchRFPs();
  }, [statusFilter]);

  const handleDeleteRFP = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this RFP? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingId(id);
      
      // Delete the RFP
      const { error } = await supabase
        .from('rfps')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setRFPs(rfps.filter(rfp => rfp.id !== id));
      setSelectedRFPs(selectedRFPs.filter(rfpId => rfpId !== id));
      
    } catch (error: any) {
      console.error('Error deleting RFP:', error);
      alert('Failed to delete RFP. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };
  
  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedRFPs.length} RFPs? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete RFPs one by one
      for (const id of selectedRFPs) {
        const { error } = await supabase
          .from('rfps')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
      }
      
      // Update local state
      setRFPs(rfps.filter(rfp => !selectedRFPs.includes(rfp.id)));
      setSelectedRFPs([]);
      
    } catch (error: any) {
      console.error('Error during bulk delete:', error);
      alert('Failed to delete some RFPs. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Sort and filter RFPs
  const filteredAndSortedRFPs = rfps
    .filter(rfp => {
      const matchesSearch = !searchTerm || 
        rfp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfp.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfp.description.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesCategory = !categoryFilter || rfp.categories.includes(categoryFilter as any);
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const fieldA = String(a[sortField as keyof RFP]);
      const fieldB = String(b[sortField as keyof RFP]);
      
      if (sortDirection === 'asc') {
        return fieldA.localeCompare(fieldB);
      } else {
        return fieldB.localeCompare(fieldA);
      }
    });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  // Get status badge styles
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          icon: <CheckCircle className="h-3.5 w-3.5 mr-1" />
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
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRFPs(filteredAndSortedRFPs.map(rfp => rfp.id));
    } else {
      setSelectedRFPs([]);
    }
  };
  
  // Handle select one
  const handleSelectOne = (id: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedRFPs([...selectedRFPs, id]);
    } else {
      setSelectedRFPs(selectedRFPs.filter(rfpId => rfpId !== id));
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFP Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, edit, and manage Request for Proposals
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link to="/admin/rfps/new">
            <Button leftIcon={<Plus className="h-4 w-4" />}>
              Create New RFP
            </Button>
          </Link>
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
                placeholder="Search RFPs..."
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
              
              {selectedRFPs.length > 0 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    leftIcon={<Download className="h-4 w-4" />}
                  >
                    Export {selectedRFPs.length} selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    leftIcon={<Trash2 className="h-4 w-4" />} 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleBulkDelete}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
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
                  value={statusFilter || ''}
                  onChange={(e) => setStatusFilter(e.target.value || null)}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category-filter"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={categoryFilter || ''}
                  onChange={(e) => setCategoryFilter(e.target.value || null)}
                >
                  <option value="">All Categories</option>
                  {Object.entries(categoryMap).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
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
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    id="date-to"
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {/* RFP Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={handleSelectAll}
                    checked={selectedRFPs.length === filteredAndSortedRFPs.length && filteredAndSortedRFPs.length > 0}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    <span>Title</span>
                    {sortField === 'title' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('client_name')}
                >
                  <div className="flex items-center">
                    <span>Client</span>
                    {sortField === 'client_name' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('closing_date')}
                >
                  <div className="flex items-center">
                    <span>Closing Date</span>
                    {sortField === 'closing_date' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categories
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedRFPs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No RFPs found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredAndSortedRFPs.map((rfp) => (
                  <tr key={rfp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={selectedRFPs.includes(rfp.id)}
                        onChange={(e) => handleSelectOne(rfp.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {rfp.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-gray-400 mr-1.5" />
                        <div className="text-sm text-gray-500">
                          {rfp.client_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center ${getStatusBadge(rfp.status).bg} ${getStatusBadge(rfp.status).text}`}>
                        {getStatusBadge(rfp.status).icon}
                        {rfp.status.charAt(0).toUpperCase() + rfp.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1.5" />
                        {formatDate(rfp.closing_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {rfp.categories.slice(0, 2).map((category) => (
                          <span key={category} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {categoryMap[category as keyof typeof categoryMap]}
                          </span>
                        ))}
                        {rfp.categories.length > 2 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            +{rfp.categories.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link to={`/rfps/${rfp.id}`} className="text-gray-500 hover:text-gray-700">
                          <Eye className="h-5 w-5" />
                        </Link>
                        <Link to={`/admin/rfps/${rfp.id}/edit`} className="text-blue-500 hover:text-blue-700">
                          <Edit className="h-5 w-5" />
                        </Link>
                        <button 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteRFP(rfp.id)}
                          disabled={deletingId === rfp.id}
                        >
                          {deletingId === rfp.id ? 
                            <Loader2 className="h-5 w-5 animate-spin" /> : 
                            <Trash2 className="h-5 w-5" />
                          }
                        </button>
                      </div>
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
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredAndSortedRFPs.length}</span> of{' '}
              <span className="font-medium">{filteredAndSortedRFPs.length}</span> results
            </p>
          </div>
          <div className="flex-1 flex justify-between sm:justify-end">
            <button
              disabled
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-50 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-50 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};