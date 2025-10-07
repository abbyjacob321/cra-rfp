import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { JoinCompanyFlow } from '../components/bidder/JoinCompanyFlow';

export const JoinCompanyFlowPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <Link to="/profile" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-5 w-5 mr-2" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Join or Create a Company</h1>
        </div>
        <p className="text-gray-500">
          Associate your account with your company to collaborate with team members and simplify NDA management
        </p>
      </div>
      
      <JoinCompanyFlow />
    </div>
  );
};