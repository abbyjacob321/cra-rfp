import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  FileQuestion,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
  Building2,
  Bell,
  ChevronDown,
  Search,
  Building,
  FileUp,
  Wrench
} from 'lucide-react';
import { Button } from '../ui/Button';

export const AdminLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'RFP Management', href: '/admin/rfps', icon: FileText },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Companies', href: '/admin/companies', icon: Building },
    { name: 'Q&A Management', href: '/admin/questions', icon: FileQuestion },
    { name: 'Documents', href: '/admin/documents', icon: FileUp },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
    // Add diagnostic tools link
    { name: 'Diagnostic Tools', href: '/admin/diagnostic-tools', icon: Wrench }
  ];

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-40 flex md:hidden ${
          sidebarOpen ? 'visible' : 'invisible'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div 
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ease-in-out duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
          onClick={closeSidebar}
        ></div>

        <div className={`relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white transition ease-in-out duration-300 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={closeSidebar}
            >
              <span className="sr-only">Close sidebar</span>
              <X className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-shrink-0 flex items-center px-4">
            <div className="flex flex-col items-start space-y-1.5">
              <img 
                src="/image copy copy.png" 
                alt="Charles River Associates" 
                className="h-6 object-contain"
              />
              <span className="text-xs font-bold text-blue-700 tracking-widest uppercase">
                Power Procurement
              </span>
            </div>
          </div>
          
          <div className="mt-5 flex-1 h-0 overflow-y-auto">
            <nav className="px-2 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.exact}
                  className={({ isActive }) =>
                    `group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                  onClick={closeSidebar}
                >
                  <item.icon
                    className="mr-3 h-6 w-6 flex-shrink-0"
                    aria-hidden="true"
                  />
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                  {user.first_name.charAt(0)}
                </div>
                <div className="ml-3">
                  <p className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                    Administrator
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 w-14" aria-hidden="true">
          {/* Dummy element to force sidebar to shrink to fit close icon */}
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1">
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-white border-r border-gray-200">
              <div className="flex flex-col items-start space-y-1.5">
                <img 
                  src="/image copy copy.png" 
                  alt="Charles River Associates" 
                  className="h-9 object-contain"
                />
                <span className="text-xs font-bold text-blue-700 tracking-widest uppercase">
                  Power Procurement
                </span>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-y-auto border-r border-gray-200 bg-white">
              <nav className="flex-1 px-4 py-4 space-y-1">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.exact}
                    className={({ isActive }) =>
                      `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon
                      className="mr-3 h-5 w-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>
            
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4 bg-white">
              <div className="flex-shrink-0 w-full group block">
                <div className="flex items-center">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                    {user.first_name.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <button 
                      onClick={() => signOut()}
                      className="text-xs font-medium text-gray-500 group-hover:text-gray-700 flex items-center"
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow-sm">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <form className="w-full flex md:ml-0" action="#" method="GET">
                <label htmlFor="search-field" className="sr-only">
                  Search
                </label>
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <Search className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <input
                    id="search-field"
                    className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent sm:text-sm"
                    placeholder="Search"
                    type="search"
                    name="search"
                  />
                </div>
              </form>
            </div>
            
            <div className="ml-4 flex items-center md:ml-6">
              <button
                type="button"
                className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <span className="sr-only">View notifications</span>
                <Bell className="h-6 w-6" aria-hidden="true" />
              </button>
              
              <div className="hidden md:ml-3 md:flex md:items-center md:space-x-2">
                <NavLink 
                  to="/"
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                >
                  View Site
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};