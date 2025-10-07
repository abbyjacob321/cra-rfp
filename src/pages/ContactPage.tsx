import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  Building2, 
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type ContactFormValues = {
  name: string;
  email: string;
  company: string;
  phone: string;
  subject: string;
  message: string;
  projectType: string;
  timeline: string;
};

export const ContactPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ContactFormValues>();

  const onSubmit = async (data: ContactFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // In a real implementation, you would send this to your backend or email service
      // For now, we'll simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Contact form submitted:', data);
      setSubmitted(true);
      reset();
    } catch (error) {
      setError('Failed to send message. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Message Sent Successfully</h3>
          <p className="text-gray-600 mb-6">
            Thank you for contacting Charles River Associates. We'll review your inquiry and respond within 1-2 business days.
          </p>
          <Button onClick={() => setSubmitted(false)}>
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Charles River Associates</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Ready to discuss your next energy procurement project? Our team of experts is here to help you achieve optimal outcomes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Information */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <Phone className="h-6 w-6 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Phone</h3>
                  <p className="text-blue-100">+1 (617) 425-3000</p>
                  <p className="text-sm text-blue-200">Monday - Friday, 9 AM - 6 PM EST</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Mail className="h-6 w-6 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-blue-100">energy@crai.com</p>
                  <p className="text-sm text-blue-200">We respond within 24 hours</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <MapPin className="h-6 w-6 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Headquarters</h3>
                  <p className="text-blue-100">
                    200 Clarendon Street<br />
                    Boston, MA 02116
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Building2 className="h-6 w-6 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Global Offices</h3>
                  <p className="text-blue-100">
                    Boston, Chicago, New York, Washington DC, London, Brussels, and more
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-blue-500">
              <a 
                href="https://www.crai.com/contact/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-white hover:text-blue-200 transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                More contact options at CRAI.com
              </a>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Full Name"
                  error={errors.name?.message}
                  {...register('name', { required: 'Name is required' })}
                />
                
                <Input
                  label="Email Address"
                  type="email"
                  error={errors.email?.message}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Company/Organization"
                  error={errors.company?.message}
                  {...register('company', { required: 'Company is required' })}
                />
                
                <Input
                  label="Phone Number"
                  type="tel"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Type
                  </label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    {...register('projectType', { required: 'Please select a project type' })}
                  >
                    <option value="">Select project type</option>
                    <option value="rfp-management">RFP Management & Procurement</option>
                    <option value="economic-analysis">Economic Analysis & Modeling</option>
                    <option value="utility-planning">Utility Planning & Strategy</option>
                    <option value="regulatory-support">Regulatory Support</option>
                    <option value="market-analysis">Market Analysis & Forecasting</option>
                    <option value="transaction-support">Transaction Support</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.projectType && (
                    <p className="mt-1 text-sm text-red-600">{errors.projectType.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timeline
                  </label>
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    {...register('timeline')}
                  >
                    <option value="">Select timeline</option>
                    <option value="immediate">Immediate (within 1 month)</option>
                    <option value="short-term">Short-term (1-3 months)</option>
                    <option value="medium-term">Medium-term (3-6 months)</option>
                    <option value="long-term">Long-term (6+ months)</option>
                    <option value="planning">Planning phase</option>
                  </select>
                </div>
              </div>

              <Input
                label="Subject"
                error={errors.subject?.message}
                {...register('subject', { required: 'Subject is required' })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={6}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Tell us about your project, timeline, and how we can help..."
                  {...register('message', { required: 'Message is required' })}
                />
                {errors.message && (
                  <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
                )}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Response Time</p>
                    <p>Our energy consulting team will review your inquiry and respond within 1-2 business days with next steps.</p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={isSubmitting}
                leftIcon={isSubmitting ? undefined : <Send className="h-5 w-5" />}
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'Sending Message...' : 'Send Message'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-gray-50 rounded-3xl p-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Additional Resources</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ExternalLink className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">CRAI.com</h3>
              <p className="text-gray-600 text-sm mb-4">
                Visit our main website for comprehensive information about all our services and expertise.
              </p>
              <a 
                href="https://www.crai.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Visit CRAI.com →
              </a>
            </div>
            
            <div className="text-center">
              <div className="bg-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Energy Practice</h3>
              <p className="text-gray-600 text-sm mb-4">
                Learn more about our energy consulting practice and recent case studies.
              </p>
              <a 
                href="https://www.crai.com/industries/energy/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Energy Practice →
              </a>
            </div>
            
            <div className="text-center">
              <div className="bg-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Phone className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Direct Contact</h3>
              <p className="text-gray-600 text-sm mb-4">
                For urgent matters or immediate assistance, call our main number.
              </p>
              <a 
                href="tel:+16174253000" 
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Call +1 (617) 425-3000 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};