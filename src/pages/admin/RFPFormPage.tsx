import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { RFP, RFPComponent, Milestone } from '../../types';
import { LogoUploader } from '../../components/admin/LogoUploader';
import { RFPTimeline } from '../../components/admin/RFPTimeline';
import { RFPComponentEditor } from '../../components/admin/RFPComponentEditor';
import { DocumentManager } from '../../components/admin/DocumentManager';
import { RFPAccessManager } from '../../components/admin/RFPAccessManager';
import { NDAManagement } from '../../components/admin/NDAManagement';
import { RFPInterestList } from '../../components/admin/RFPInterestList';
import { RFPInvitationManager } from '../../components/admin/RFPInvitationManager';
import { toUTCString, toLocalInputString } from '../../utils/dateUtils';
import { 
  Save, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Plus, 
  Trash2,
  ArrowLeft,
  Calendar,
  FileText,
  Users,
  MessageSquare,
  Lock,
  Building2,
  Upload,
  Star,
  Globe
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type RFPFormValues = {
  title: string;
  client_name: string;
  categories: string[];
  visibility: 'public' | 'confidential';
  status: 'draft' | 'active' | 'closed';
  issue_date: string;
  closing_date: string;
  description: string;
  submission_method: 'sharefile' | 'instructions';
  submission_instructions?: string;
  allow_late_submissions: boolean;
  display_on_homepage: boolean;
  featured_until?: string;
  featured_priority: number;
};

export const RFPFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = id !== 'new';
  
  const [loading, setLoading] = useState(false);
  const [loadingRFP, setLoadingRFP] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [components, setComponents] = useState<RFPComponent[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'components' | 'documents' | 'access' | 'ndas' | 'registrations' | 'invitations'>('details');
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);
  const [componentSaving, setComponentSaving] = useState<{[key: string]: boolean}>({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty }
  } = useForm<RFPFormValues>({
    defaultValues: {
      categories: [],
      visibility: 'public',
      status: 'draft',
      submission_method: 'instructions',
      allow_late_submissions: true,
      display_on_homepage: true,
      featured_priority: 0
    }
  });

  // Load RFP data for editing
  useEffect(() => {
    const loadRFP = async () => {
      if (!isEditing) return;
      
      try {
        setLoadingRFP(true);
        
        console.log('Loading RFP for editing:', id);
        
        const { data, error } = await supabase
          .from('rfps')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) {
          console.error('Error loading RFP:', error);
          throw error;
        }
        
        console.log('Loaded RFP data:', data);
        
        // Populate form with RFP data
        setValue('title', data.title);
        setValue('client_name', data.client_name);
        setValue('categories', data.categories || []);
        setValue('visibility', data.visibility);
        setValue('status', data.status);
        setValue('issue_date', toLocalInputString(data.issue_date, undefined, true));
        setValue('closing_date', toLocalInputString(data.closing_date, undefined, true));
        setValue('description', data.description);
        setValue('submission_method', data.submission_method || 'instructions');
        setValue('submission_instructions', data.submission_instructions || '');
        setValue('allow_late_submissions', data.allow_late_submissions ?? true);
        setValue('display_on_homepage', data.display_on_homepage ?? true);
        setValue('featured_until', data.featured_until ? toLocalInputString(data.featured_until, undefined, true) : '');
        setValue('featured_priority', data.featured_priority || 0);
        
        setLogoUrl(data.logo_url);
        setMilestones(data.milestones || []);
        
        // Load components
        const { data: componentsData, error: componentsError } = await supabase
          .from('rfp_components')
          .select('*')
          .eq('rfp_id', id)
          .order('sort_order', { ascending: true });
          
        if (componentsError) {
          console.error('Error loading components:', componentsError);
        } else {
          setComponents(componentsData || []);
        }
        
      } catch (error: any) {
        console.error('Error loading RFP:', error);
        setError(`Failed to load RFP: ${error.message}`);
      } finally {
        setLoadingRFP(false);
      }
    };
    
    loadRFP();
  }, [id, isEditing, setValue]);

  const onSubmit = async (data: RFPFormValues) => {
    if (id && id !== 'new' && id !== 'undefined') {
      await handleUpdateRFP(data);
    } else {
      await handleCreateRFP(data);
    }
  };

  const handleCreateRFP = async (data: RFPFormValues) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('Creating new RFP with data:', data);
      
      const rfpData = {
        title: data.title,
        client_name: data.client_name,
        categories: data.categories,
        visibility: data.visibility,
        status: data.status,
        issue_date: toUTCString(data.issue_date),
        closing_date: toUTCString(data.closing_date),
        description: data.description,
        milestones,
        logo_url: logoUrl,
        submission_method: data.submission_method,
        submission_instructions: data.submission_instructions || null,
        allow_late_submissions: data.allow_late_submissions,
        display_on_homepage: data.display_on_homepage,
        featured_until: data.featured_until ? toUTCString(data.featured_until) : null,
        featured_priority: data.featured_priority
      };
      
      console.log('Inserting RFP data:', rfpData);
      
      const { data: insertedRFP, error } = await supabase
        .from('rfps')
        .insert(rfpData)
        .select()
        .single();
        
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('RFP created successfully:', insertedRFP);
      
      // Save components if any exist
      if (components.length > 0) {
        await saveComponents(insertedRFP.id);
      }
      
      setSuccess('RFP created successfully!');
      
      setTimeout(() => {
        navigate(`/admin/rfps/${insertedRFP.id}/edit`);
      }, 1000);
      
    } catch (error: any) {
      console.error('Error creating RFP:', error);
      setError(`Failed to create RFP: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRFP = async (data: RFPFormValues) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('Updating RFP with data:', data);
      
      const updateData = {
        title: data.title,
        client_name: data.client_name,
        categories: data.categories,
        visibility: data.visibility,
        status: data.status,
        issue_date: toUTCString(data.issue_date),
        closing_date: toUTCString(data.closing_date),
        description: data.description,
        milestones,
        logo_url: logoUrl,
        submission_method: data.submission_method,
        submission_instructions: data.submission_instructions || null,
        allow_late_submissions: data.allow_late_submissions,
        display_on_homepage: data.display_on_homepage,
        featured_until: data.featured_until ? toUTCString(data.featured_until) : null,
        featured_priority: data.featured_priority,
        updated_at: new Date().toISOString()
      };
      
      console.log('Update payload:', updateData);
      
      const { error } = await supabase
        .from('rfps')
        .update(updateData)
        .eq('id', id);
        
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      
      // Save components
      await saveComponents(id!);
      
      setSuccess('RFP updated successfully!');
      
    } catch (error: any) {
      console.error('Error updating RFP:', error);
      setError(`Failed to update RFP: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveComponents = async (rfpId: string) => {
    try {
      console.log('Saving components for RFP:', rfpId);
      
      // Remove existing components
      await supabase
        .from('rfp_components')
        .delete()
        .eq('rfp_id', rfpId);
      
      // Save new components
      if (components.length > 0) {
        const componentsToSave = components.map((component, index) => ({
          rfp_id: rfpId,
          title: component.title,
          content: component.content,
          requires_approval: component.requires_approval,
          requires_nda: false, // Feature removed - always false
          sort_order: index + 1
        }));
        
        const { error } = await supabase
          .from('rfp_components')
          .insert(componentsToSave);
          
        if (error) {
          console.error('Error saving components:', error);
          throw error;
        }
      }
      
      console.log('Components saved successfully');
    } catch (error) {
      console.error('Error in saveComponents:', error);
      throw error;
    }
  };

  const addComponent = () => {
    const newComponent: RFPComponent = {
      id: `temp-${Date.now()}`,
      rfp_id: id || '',
      title: `Section ${components.length + 1}`,
      content: '<p>Enter section content here...</p>',
      requires_approval: false,
      requires_nda: false,
      sort_order: components.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setComponents([...components, newComponent]);
    setExpandedComponent(newComponent.id);
  };

  const removeComponent = (componentId: string) => {
    setComponents(components.filter(c => c.id !== componentId));
    if (expandedComponent === componentId) {
      setExpandedComponent(null);
    }
  };

  const updateComponent = (updatedComponent: RFPComponent) => {
    setComponents(components.map(c => 
      c.id === updatedComponent.id ? updatedComponent : c
    ));
  };

  if (loadingRFP) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading RFP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin/rfps')}
            className="mr-4 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit RFP' : 'Create New RFP'}
            </h1>
            <p className="text-gray-500 mt-1">
              {isEditing ? 'Update RFP details and settings' : 'Create a new Request for Proposal'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {isEditing && (
            <a 
              href={`/rfps/${id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <Button variant="outline" leftIcon={<Eye className="h-4 w-4" />}>
                Preview
              </Button>
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              type="button"
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('details')}
            >
              RFP Details
            </button>
            <button
              type="button"
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'components'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('components')}
            >
              Content Sections
            </button>
            {isEditing && (
              <>
                <button
                  type="button"
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
                  type="button"
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'access'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('access')}
                >
                  Access Control
                </button>
                <button
                  type="button"
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'ndas'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('ndas')}
                >
                  NDAs
                </button>
                <button
                  type="button"
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'registrations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('registrations')}
                >
                  Company Interest
                </button>
                <button
                  type="button"
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'invitations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('invitations')}
                >
                  Invitations
                </button>
              </>
            )}
          </nav>
        </div>

        {activeTab === 'details' && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">RFP Information</h2>
              <p className="mt-1 text-sm text-gray-500">
                Basic details and configuration for the RFP
              </p>
            </div>
            
            <div className="px-4 py-5 sm:p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-6">
                <Input
                  label="RFP Title"
                  required
                  error={errors.title?.message}
                  {...register('title', { required: 'Title is required' })}
                />
                
                <Input
                  label="Client Name"
                  required
                  error={errors.client_name?.message}
                  {...register('client_name', { required: 'Client name is required' })}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Provide a detailed description of the RFP..."
                    {...register('description', { required: 'Description is required' })}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>
              </div>
              
              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: 'power_generation', label: 'Power Generation' },
                    { value: 'transmission', label: 'Transmission' },
                    { value: 'energy_capacity', label: 'Energy & Capacity' },
                    { value: 'renewable_credits', label: 'Renewable Credits' },
                    { value: 'other', label: 'Other' }
                  ].map(category => (
                    <label key={category.value} className="flex items-center">
                      <input
                        type="checkbox"
                        value={category.value}
                        {...register('categories')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{category.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Issue Date"
                  type="date"
                  required
                  error={errors.issue_date?.message}
                  {...register('issue_date', { required: 'Issue date is required' })}
                />
                
                <Input
                  label="Closing Date"
                  type="date"
                  required
                  error={errors.closing_date?.message}
                  {...register('closing_date', { required: 'Closing date is required' })}
                />
              </div>
              
              {/* Settings Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visibility
                  </label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    {...register('visibility')}
                  >
                    <option value="public">Public</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    {...register('status')}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Homepage Display Control */}
              {/* Note: Homepage display control will be added after database migration */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start">
                  <Star className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Homepage Display</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Homepage display controls will be available after database migration. 
                      Currently all public RFPs are shown on the homepage, sorted by Extended → Active → Closed status.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Submission Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Submission Method
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  {...register('submission_method')}
                >
                  <option value="instructions">Instructions Only</option>
                  <option value="sharefile">ShareFile Integration</option>
                </select>
              </div>
              
              {watch('submission_method') === 'instructions' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Submission Instructions
                  </label>
                  <textarea
                    rows={6}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Provide detailed instructions for how bidders should submit their proposals..."
                    {...register('submission_instructions')}
                  />
                </div>
              )}
              
              {/* Settings */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allow_late_submissions"
                    {...register('allow_late_submissions')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="allow_late_submissions" className="ml-2 block text-sm text-gray-700">
                    Allow late submissions after closing date
                  </label>
                </div>
              </div>
              
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Logo
                </label>
                <LogoUploader
                  onUploadComplete={(url) => setLogoUrl(url)}
                  currentLogo={logoUrl}
                />
              </div>
              
              {/* Milestones */}
              <RFPTimeline
                milestones={milestones}
                onChange={setMilestones}
              />
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Content Sections</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Add structured content sections to your RFP
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={addComponent}
              >
                Add Section
              </Button>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              {components.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No content sections yet</h3>
                  <p className="text-gray-500 mb-4">
                    Add structured content sections to organize your RFP information
                  </p>
                  <Button
                    type="button"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={addComponent}
                  >
                    Add First Section
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {components.map((component, index) => (
                    <div key={component.id} className="border border-gray-200 rounded-lg">
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-900">
                          Section {index + 1}: {component.title || 'Untitled'}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedComponent(
                              expandedComponent === component.id ? null : component.id
                            )}
                          >
                            {expandedComponent === component.id ? 'Collapse' : 'Expand'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            leftIcon={<Trash2 className="h-4 w-4" />}
                            onClick={() => removeComponent(component.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      
                      {expandedComponent === component.id && (
                        <div className="p-4">
                          <RFPComponentEditor
                            component={component}
                            onChange={updateComponent}
                            isSaving={componentSaving[component.id]}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'documents' && isEditing && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Document Management</h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload and manage documents for this RFP
              </p>
            </div>
            
            <div className="p-6">
              <DocumentManager rfpId={id!} />
            </div>
          </div>
        )}

        {activeTab === 'access' && isEditing && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Access Control</h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage user access permissions for this RFP
              </p>
            </div>
            
            <div className="p-6">
              <RFPAccessManager rfpId={id!} rfpTitle={watch('title') || 'Untitled RFP'} />
            </div>
          </div>
        )}

        {activeTab === 'ndas' && isEditing && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">NDA Management</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review and manage Non-Disclosure Agreements
              </p>
            </div>
            
            <div className="p-6">
              <NDAManagement rfpId={id!} />
            </div>
          </div>
        )}

        {activeTab === 'registrations' && isEditing && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Company Interest</h2>
              <p className="mt-1 text-sm text-gray-500">
                View companies that have registered interest in this RFP
              </p>
            </div>
            
            <div className="p-6">
              <RFPInterestList rfpId={id!} />
            </div>
          </div>
        )}

        {activeTab === 'invitations' && isEditing && (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">RFP Invitations</h2>
              <p className="mt-1 text-sm text-gray-500">
                Invite specific users or companies to participate in this RFP
              </p>
            </div>
            
            <div className="p-6">
              <RFPInvitationManager rfpId={id!} rfpTitle={watch('title') || 'Untitled RFP'} />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end sticky bottom-0 bg-white p-4 border-t border-gray-200 rounded-t-xl shadow-lg z-10">
          <Button
            type="submit"
            disabled={loading}
            isLoading={loading}
            leftIcon={loading ? undefined : <Save className="h-4 w-4" />}
          >
            {loading ? 'Saving...' : isEditing ? 'Update RFP' : 'Create RFP'}
          </Button>
        </div>
      </form>
    </div>
  );
};