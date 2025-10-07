import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Notification } from '../../types';
import { Building2, File, FileText, Bell, LogOut, Menu, User, X, ChevronDown, Lightbulb, Info as InfoIcon, PieChart, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

export const MainLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (error) throw error;
        
        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.read_at).length || 0);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotifications();
    
    // Subscribe to notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Mark notifications as read
  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      const { error } = await supabase
        .rpc('mark_notifications_read', { notification_ids: notificationIds });
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.id) 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

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

  // Function to check if a path is active
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link to="/" className="flex items-center gap-2">
                  <div className="flex flex-col items-start space-y-1">
                    <img 
                      src="/image copy copy.png" 
                      alt="Charles River Associates" 
                      className="h-9 object-contain"
                    />
                    <span className="text-xs font-bold text-blue-700 tracking-widest uppercase letterspacing-wide">
                      Power Procurement
                    </span>
                  </div>
                </Link>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                <Link 
                  to="/" 
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive('/') 
                      ? 'text-blue-700 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                  }`}
                >
                  Home
                </Link>
                <Link 
                  to="/rfps" 
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive('/rfps') 
                      ? 'text-blue-700 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                  }`}
                >
                  RFPs
                </Link>
                <Link 
                  to="/about" 
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive('/about') 
                      ? 'text-blue-700 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                  }`}
                >
                  About
                </Link>
                <Link 
                  to="/contact" 
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive('/contact') 
                      ? 'text-blue-700 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                  }`}
                >
                  Contact
                </Link>
                {user && user.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive('/admin') 
                        ? 'text-blue-700 bg-blue-50' 
                        : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                    }`}
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center gap-2">
              {user ? (
                <>
                  {/* Notification bell */}
                  <div className="relative">
                    <button
                      className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                      onClick={() => setNotificationsOpen(!notificationsOpen)}
                    >
                      <span className="sr-only">View notifications</span>
                      <Bell className="h-6 w-6" aria-hidden="true" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-xs text-white">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    
                    {notificationsOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 z-10 border border-gray-200">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {loading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="px-4 py-3 text-center text-sm text-gray-500">
                              No notifications
                            </div>
                          ) : (
                            notifications.map(notification => (
                              <div 
                                key={notification.id} 
                                className={`px-4 py-3 hover:bg-gray-50 ${!notification.read_at ? 'bg-blue-50' : ''}`}
                                onClick={() => {
                                  if (!notification.read_at) {
                                    handleMarkAsRead([notification.id]);
                                  }
                                  // Handle navigation based on notification type
                                  if (notification.reference_id) {
                                    switch (notification.type) {
                                      case 'rfp_published':
                                      case 'rfp_updated':
                                      case 'rfp_closed':
                                        navigate(`/rfps/${notification.reference_id}`);
                                        break;
                                      case 'question_answered':
                                        navigate(`/rfps/${notification.reference_id}/questions`);
                                        break;
                                      // Add more cases as needed
                                    }
                                  }
                                  setNotificationsOpen(false);
                                }}
                              >
                                <div className="flex justify-between">
                                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                  <p className="text-xs text-gray-500">{formatRelativeTime(notification.created_at)}</p>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="px-4 py-2 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <Link 
                              to="/notifications" 
                              className="text-xs font-medium text-blue-600 hover:text-blue-500"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              View all notifications
                            </Link>
                            {unreadCount > 0 && (
                              <button
                                onClick={() => handleMarkAsRead(notifications.filter(n => !n.read_at).map(n => n.id))}
                                className="text-xs font-medium text-gray-600 hover:text-gray-800"
                              >
                                Mark all as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* User profile dropdown */}
                  <div className="relative ml-3">
                    <button
                      className="flex items-center gap-2 max-w-xs rounded-full bg-white text-sm focus:outline-none"
                      onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                        {user.first_name.charAt(0)}
                      </div>
                      <span className="hidden md:block text-sm font-medium text-gray-700">
                        {user.first_name} {user.last_name}
                      </span>
                      <ChevronDown className="hidden md:block h-4 w-4 text-gray-400" />
                    </button>
                    
                    {profileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-10 border border-gray-200">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Your Profile
                        </Link>
                        <Link to="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Settings
                        </Link>
                        <div className="border-t border-gray-200 mt-1 pt-1">
                          <button
                            onClick={() => signOut()}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                          >
                            Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-x-2">
                  <Link to="/login">
                    <Button variant="outline" size="sm">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm">
                      Sign up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden divide-y divide-gray-200">
            <div className="space-y-1 px-2 pb-3 pt-2">
              <Link
                to="/"
                className={`block rounded-md px-3 py-2 text-base font-medium ${
                  isActive('/') 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/rfps"
                className={`block rounded-md px-3 py-2 text-base font-medium ${
                  isActive('/rfps') 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                RFPs
              </Link>
              <Link
                to="/about"
                className={`block rounded-md px-3 py-2 text-base font-medium ${
                  isActive('/about') 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/contact"
                className={`block rounded-md px-3 py-2 text-base font-medium ${
                  isActive('/contact') 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              {user && user.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`block rounded-md px-3 py-2 text-base font-medium ${
                    isActive('/admin') 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
            </div>
            
            <div className="pt-4 pb-3">
              {user ? (
                <>
                  <div className="flex items-center px-4 py-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                      {user.first_name.charAt(0)}
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-gray-800">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm font-medium text-gray-500">{user.email}</div>
                    </div>
                    <button
                      className="ml-auto flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-500"
                    >
                      <Bell className="h-5 w-5" />
                      <span className="absolute h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-xs text-white">
                        2
                      </span>
                    </button>
                  </div>
                  <div className="mt-3 space-y-1 px-2">
                    <Link
                      to="/profile"
                      className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Your Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-red-600 hover:bg-gray-50"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-3 space-y-1 px-4">
                  <Link
                    to="/login"
                    className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-grow mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="mb-4">
                <img 
                  src="/image copy copy.png"
                  alt="Charles River Associates"
                  className="h-10 object-contain mb-3"
                />
                <div className="text-sm font-bold text-blue-700 tracking-[0.2em] uppercase leading-relaxed">
                  Power Procurement
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6 max-w-xs">
                Leading energy consulting and RFP management services for utilities across North America.
              </p>
              <div className="flex space-x-4">
                <a href="https://linkedin.com/company/charles-river-associates" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-1.214 2.34-2.785 2.72-4.56h.06c.39 1.775 1.334 3.346 2.72 4.56h.06v5.604z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};