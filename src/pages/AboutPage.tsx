import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Award, 
  TrendingUp, 
  Zap, 
  Shield, 
  BarChart3, 
  FileText,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  Calendar,
  DollarSign,
  Globe,
  Target
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-600 rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
        <div className="relative px-8 py-16 sm:px-16 sm:py-20">
          <div className="max-w-4xl mx-auto text-center text-white">
            <div className="flex items-center justify-center space-x-2 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full px-4 py-1 w-fit mx-auto mb-6">
              <Building2 className="h-4 w-4" />
              <span>Leading Energy Consulting Since 1983</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl mb-6">
              About Charles River Associates
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              We are a leading global consulting firm that provides economic, financial, and business management expertise to utilities, energy companies, and government agencies worldwide.
            </p>
          </div>
        </div>
      </div>

      {/* Company Overview */}
      <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 p-8 relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                40+ Years of Energy Market Excellence
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Charles River Associates has been at the forefront of energy consulting since 1983, helping utilities navigate complex market challenges, regulatory requirements, and strategic planning initiatives.
              </p>
              <p className="text-lg text-gray-600 mb-8">
                Our deep expertise in utility planning and procurement has made us the trusted advisor for some of North America's largest energy companies, managing billions of dollars in energy transactions and infrastructure investments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/contact">
                  <Button size="lg" leftIcon={<ArrowRight className="h-5 w-5" />}>
                    Discuss Your Project
                  </Button>
                </Link>
                <a 
                  href="https://www.crai.com/industries/energy/utility-planning-procurement/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="outline" leftIcon={<ExternalLink className="h-5 w-5" />}>
                    Learn More at CRAI.com
                  </Button>
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">40+</div>
                <div className="text-sm text-gray-600">Years of Experience</div>
              </div>
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">$50B+</div>
                <div className="text-sm text-gray-600">Managed Procurement</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-6 text-center">
                <Users className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">500+</div>
                <div className="text-sm text-gray-600">Utility Clients</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-6 text-center">
                <Globe className="h-8 w-8 text-orange-600 mx-auto mb-3" />
                <div className="text-2xl font-bold text-gray-900">Global</div>
                <div className="text-sm text-gray-600">Reach & Presence</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Our Services */}
      <div>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Energy Consulting Services</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We provide comprehensive consulting services to utilities and energy companies across North America
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-blue-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-6">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">RFP Management & Procurement</h3>
            <p className="text-gray-600 mb-4">
              End-to-end RFP management from strategic planning through vendor selection. We handle the entire procurement process to ensure competitive, fair, and efficient outcomes.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Strategic procurement planning
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                RFP design and development
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Vendor qualification and management
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Bid evaluation and selection
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-green-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-6">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Economic Analysis & Modeling</h3>
            <p className="text-gray-600 mb-4">
              Advanced economic modeling and market analysis to support strategic decision-making and regulatory proceedings.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Market price forecasting
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Cost-benefit analysis
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Risk assessment modeling
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Investment optimization
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-purple-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Utility Planning & Strategy</h3>
            <p className="text-gray-600 mb-4">
              Strategic planning support for resource adequacy, transmission expansion, and integrated resource planning.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Integrated resource planning
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Transmission planning
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Renewable integration studies
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Grid modernization planning
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-orange-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-6">
              <Shield className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Regulatory Support</h3>
            <p className="text-gray-600 mb-4">
              Expert testimony and regulatory support for rate cases, resource planning proceedings, and policy development.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Expert witness testimony
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Rate case support
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Policy analysis
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Compliance consulting
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-red-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-6">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Market Analysis & Forecasting</h3>
            <p className="text-gray-600 mb-4">
              Comprehensive market analysis and forecasting to support business strategy and investment decisions.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Energy price forecasting
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Demand analysis
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Technology assessments
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Competitive intelligence
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="bg-indigo-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-6">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Transaction Support</h3>
            <p className="text-gray-600 mb-4">
              Support for mergers, acquisitions, asset valuations, and other complex energy transactions.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Asset valuation
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Due diligence support
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Contract negotiation
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Risk mitigation strategies
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Industry Expertise */}
      <div className="bg-gray-50 rounded-3xl p-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Industry Expertise</h2>
          <p className="text-xl text-gray-600 mb-10">
            Our team combines deep energy market knowledge with cutting-edge analytical capabilities
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <Zap className="h-8 w-8 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Power Generation</h3>
              <p className="text-sm text-gray-600">Conventional and renewable generation resource planning and procurement</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <Shield className="h-8 w-8 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Transmission</h3>
              <p className="text-sm text-gray-600">Transmission planning, expansion studies, and interconnection analysis</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Energy Markets</h3>
              <p className="text-sm text-gray-600">Wholesale and retail market analysis, price forecasting, and risk management</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <Award className="h-8 w-8 text-orange-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Regulatory</h3>
              <p className="text-sm text-gray-600">Rate case support, regulatory proceedings, and compliance consulting</p>
            </div>
          </div>
        </div>
      </div>

      {/* Why Work With CRA */}
      <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 p-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Utilities Choose CRA</h2>
            <p className="text-xl text-gray-600">
              We deliver results that matter to your organization and stakeholders
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Proven Track Record</h3>
                  <p className="text-gray-600">Successfully managed over $50 billion in energy procurement for utilities of all sizes</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-green-100 p-2 rounded-lg mr-4">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Expert Team</h3>
                  <p className="text-gray-600">PhD-level economists, engineers, and energy market specialists with decades of experience</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-purple-100 p-2 rounded-lg mr-4">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Regulatory Expertise</h3>
                  <p className="text-gray-600">Deep understanding of utility regulations and compliance requirements across all jurisdictions</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="bg-orange-100 p-2 rounded-lg mr-4">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Data-Driven Insights</h3>
                  <p className="text-gray-600">Advanced analytics and modeling capabilities to optimize procurement outcomes</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-red-100 p-2 rounded-lg mr-4">
                  <Zap className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Technology Innovation</h3>
                  <p className="text-gray-600">Cutting-edge platform technology to streamline the RFP process and improve transparency</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-indigo-100 p-2 rounded-lg mr-4">
                  <Award className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Stakeholder Management</h3>
                  <p className="text-gray-600">Professional facilitation and communication with all stakeholders throughout the process</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
        <div className="relative text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to Optimize Your Procurement Process?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Let's discuss how CRA's expertise can help you achieve better outcomes for your next RFP. 
            Our team is ready to provide a consultation tailored to your specific needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
                Schedule a Consultation
              </Button>
            </Link>
            <a 
              href="https://www.crai.com/industries/energy/utility-planning-procurement/" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="text-white border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20">
                Visit CRAI.com
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};