import React, { useState, useEffect } from 'react';
import { 
  Settings,
  Mail,
  Users,
  Key,
  Bell,
  FileText,
  Lock,
  Clock,
  Globe,
  Save,
  AlertCircle,
  Loader2,
  CheckCircle,
  RefreshCw,
  Send
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';

export const SettingsPage: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saveHistory, setSaveHistory] = useState<{key: string, timestamp: string}[]>([]);
  
  // Email test state
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string, troubleshooting?: string, details?: any} | null>(null);
  
  // Platform settings
  const [platformSettings, setPlatformSettings] = useState({
    siteName: 'CRA RFP Platform',
    defaultVisibility: 'public',
    maxFileSize: 50,
    allowedFileTypes: '.pdf,.doc,.docx,.xls,.xlsx',
    requireNdaByDefault: true
  });
  
  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    fromName: 'CRA RFP Platform',
    fromEmail: 'noreply@example.com',
    smtpHost: '',
    smtpPort: '',
    smtpUsername: '',
    smtpPassword: '',
    enableReminders: true,
    reminderDays: 7
  });
  
  // User settings
  const [userSettings, setUserSettings] = useState({
    defaultRole: 'bidder',
    minPasswordLength: 8,
    requireSpecialChars: true,
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    requireEmailVerification: true,
    adminsBypassVerification: true
  });
  
  // Integration settings
  const [integrationSettings, setIntegrationSettings] = useState({
    apiKey: '',
    webhookUrl: '',
    enableWebhooks: false
  });

  // Fetch settings on component mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch settings from the platform_settings table
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');
      
      if (error) throw error;
      
      console.log('Fetched settings:', data);
      
      if (data && data.length > 0) {
        // Process and group settings
        const platformGroup = {};
        const emailGroup = {};
        const userGroup = {};
        const integrationGroup = {};
        
        // Track the last save time for each setting
        const saveHistoryData: {key: string, timestamp: string}[] = [];
        
        data.forEach(setting => {
          // Extract the save history
          saveHistoryData.push({
            key: setting.key,
            timestamp: setting.updated_at
          });
          
          // Map settings to their respective groups
          if (setting.key.startsWith('site.') || setting.key.startsWith('upload.') || setting.key.startsWith('rfp.')) {
            mapSettingToGroup(setting, platformGroup);
          } else if (setting.key.startsWith('email.')) {
            mapSettingToGroup(setting, emailGroup);
          } else if (setting.key.startsWith('user.')) {
            mapSettingToGroup(setting, userGroup);
          } else if (setting.key.startsWith('integration.')) {
            mapSettingToGroup(setting, integrationGroup);
          }
        });
        
        // Update state with fetched settings
        if (Object.keys(platformGroup).length > 0) {
          setPlatformSettings(prev => ({ ...prev, ...platformGroup }));
        }
        
        if (Object.keys(emailGroup).length > 0) {
          setEmailSettings(prev => ({ ...prev, ...emailGroup }));
        }
        
        if (Object.keys(userGroup).length > 0) {
          setUserSettings(prev => ({ ...prev, ...userGroup }));
        }
        
        if (Object.keys(integrationGroup).length > 0) {
          setIntegrationSettings(prev => ({ ...prev, ...integrationGroup }));
        }
        
        // Set save history
        setSaveHistory(saveHistoryData);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      setError(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to map database settings to state object
  const mapSettingToGroup = (setting: any, group: any) => {
    // Extract the setting name from the key (e.g., "site.name" -> "name")
    const settingName = setting.key.split('.')[1];
    
    // Convert to camelCase (e.g., "site_name" -> "siteName")
    const camelCaseName = settingName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    
    // Parse the value from JSON if it's a string
    let value = setting.value;
    if (typeof value === 'string' && (value.startsWith('"') || value.startsWith('{'))) {
      try {
        value = JSON.parse(value);
      } catch (e) {
        console.warn(`Failed to parse setting value for ${setting.key}:`, e);
      }
    }
    
    // For booleans stored as strings
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    
    // For numbers stored as strings
    if (!isNaN(Number(value)) && typeof value !== 'boolean') {
      value = Number(value);
    }
    
    // Assign to the group
    group[camelCaseName] = value;
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Prepare settings to save
      const settingsToSave = [
        // Platform settings
        { key: 'site.name', value: JSON.stringify(platformSettings.siteName) },
        { key: 'site.default_visibility', value: JSON.stringify(platformSettings.defaultVisibility) },
        { key: 'upload.max_file_size', value: platformSettings.maxFileSize },
        { key: 'upload.allowed_types', value: JSON.stringify(platformSettings.allowedFileTypes) },
        { key: 'rfp.require_nda_default', value: platformSettings.requireNdaByDefault },
        
        // Email settings
        { key: 'email.from_name', value: JSON.stringify(emailSettings.fromName) },
        { key: 'email.from_email', value: JSON.stringify(emailSettings.fromEmail) },
        { key: 'email.smtp_host', value: JSON.stringify(emailSettings.smtpHost) },
        { key: 'email.smtp_port', value: JSON.stringify(emailSettings.smtpPort) },
        { key: 'email.smtp_username', value: JSON.stringify(emailSettings.smtpUsername) },
        { key: 'email.smtp_password', value: JSON.stringify(emailSettings.smtpPassword) },
        { key: 'email.enable_reminders', value: emailSettings.enableReminders },
        { key: 'email.reminder_days', value: emailSettings.reminderDays },
        
        // User settings
        { key: 'user.default_role', value: JSON.stringify(userSettings.defaultRole) },
        { key: 'user.min_password_length', value: userSettings.minPasswordLength },
        { key: 'user.require_special_chars', value: userSettings.requireSpecialChars },
        { key: 'user.session_timeout', value: userSettings.sessionTimeout },
        { key: 'user.max_login_attempts', value: userSettings.maxLoginAttempts },
        { key: 'user.require_email_verification', value: userSettings.requireEmailVerification },
        { key: 'user.admins_bypass_verification', value: userSettings.adminsBypassVerification },
        
        // Integration settings
        { key: 'integration.api_key', value: JSON.stringify(integrationSettings.apiKey) },
        { key: 'integration.webhook_url', value: JSON.stringify(integrationSettings.webhookUrl) },
        { key: 'integration.enable_webhooks', value: integrationSettings.enableWebhooks }
      ];
      
      console.log('Saving settings:', settingsToSave);
      
      // Save each setting using upsert
      for (const setting of settingsToSave) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ 
            key: setting.key, 
            value: setting.value,
            updated_at: new Date().toISOString(),
            updated_by: (await supabase.auth.getUser()).data.user?.id
          }, { onConflict: 'key' });
          
        if (error) throw error;
      }
      
      // Log the save event
      await supabase.from('analytics_events').insert({
        event_type: 'settings_updated',
        metadata: {
          email_settings_updated: true,
          platform_settings_updated: true,
          user_settings_updated: true,
          integration_settings_updated: true
        }
      });
      
      // Update save history
      setSaveHistory(settingsToSave.map(setting => ({
        key: setting.key,
        timestamp: new Date().toISOString()
      })));
      
      setSuccess('Settings saved successfully');
      
      // Refresh settings from the database
      await fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setError(`Failed to save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setError('Please enter a valid email address for testing');
      return;
    }
    
    try {
      setTestingEmail(true);
      setError(null);
      setTestResult(null);
      
      // Call the test-email edge function
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-email`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          testEmail
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setTestResult({
          success: false,
          message: result.error || 'Failed to send test email',
          troubleshooting: result.troubleshooting,
          details: result.technical_details
        });
      } else {
        setTestResult({
          success: true,
          message: 'Test email sent successfully! Please check your inbox.',
          details: result.details
        });
      }
      
    } catch (error: any) {
      console.error('Error testing email:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to send test email'
      });
    } finally {
      setTestingEmail(false);
    }
  };
  
  // Show last save time for a specific setting group
  const getLastSaveTime = (prefix: string) => {
    const relevantSettings = saveHistory.filter(item => item.key.startsWith(prefix));
    if (relevantSettings.length === 0) return 'Never';
    
    const latestSetting = relevantSettings.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });
    
    return new Date(latestSetting.timestamp).toLocaleString();
  };
  
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure global settings for the RFP platform
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchSettings}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Settings'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
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
      
      {loading ? (
        <div className="bg-white shadow-sm rounded-lg p-12 text-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Platform Settings */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center text-lg font-medium text-gray-900 mb-4">
                <Settings className="h-5 w-5 mr-2 text-gray-400" />
                Platform Settings
              </div>
              
              {saveHistory.length > 0 && (
                <div className="text-xs text-gray-500 mb-4">
                  Last updated: {getLastSaveTime('site.')}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Site Name"
                  value={platformSettings.siteName}
                  onChange={(e) => setPlatformSettings({
                    ...platformSettings,
                    siteName: e.target.value
                  })}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default RFP Visibility
                  </label>
                  <select
                    value={platformSettings.defaultVisibility}
                    onChange={(e) => setPlatformSettings({
                      ...platformSettings,
                      defaultVisibility: e.target.value
                    })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="public">Public</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </div>
                
                <Input
                  label="Maximum File Size (MB)"
                  type="number"
                  value={platformSettings.maxFileSize}
                  onChange={(e) => setPlatformSettings({
                    ...platformSettings,
                    maxFileSize: parseInt(e.target.value)
                  })}
                />
                
                <Input
                  label="Allowed File Types"
                  value={platformSettings.allowedFileTypes}
                  onChange={(e) => setPlatformSettings({
                    ...platformSettings,
                    allowedFileTypes: e.target.value
                  })}
                />
                
                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={platformSettings.requireNdaByDefault}
                      onChange={(e) => setPlatformSettings({
                        ...platformSettings,
                        requireNdaByDefault: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Require NDA by default for new RFPs
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Email Settings */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center text-lg font-medium text-gray-900 mb-4">
                <Mail className="h-5 w-5 mr-2 text-gray-400" />
                Email Settings
              </div>
              
              {saveHistory.length > 0 && (
                <div className="text-xs text-gray-500 mb-4">
                  Last updated: {getLastSaveTime('email.')}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="From Name"
                  value={emailSettings.fromName}
                  onChange={(e) => setEmailSettings({
                    ...emailSettings,
                    fromName: e.target.value
                  })}
                />
                
                <Input
                  label="From Email"
                  type="email"
                  value={emailSettings.fromEmail}
                  onChange={(e) => setEmailSettings({
                    ...emailSettings,
                    fromEmail: e.target.value
                  })}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="text"
                      value={emailSettings.smtpHost}
                      onChange={(e) => setEmailSettings({
                        ...emailSettings,
                        smtpHost: e.target.value
                      })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., sandbox.smtp.mailtrap.io"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    For Mailtrap, use: sandbox.smtp.mailtrap.io
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type="text"
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings({
                        ...emailSettings,
                        smtpPort: e.target.value
                      })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., 2525, 587, or 465"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    For Mailtrap, use port 2525
                  </p>
                </div>
                
                <Input
                  label="SMTP Username"
                  value={emailSettings.smtpUsername}
                  onChange={(e) => setEmailSettings({
                    ...emailSettings,
                    smtpUsername: e.target.value
                  })}
                />
                
                <Input
                  label="SMTP Password"
                  type="password"
                  value={emailSettings.smtpPassword}
                  onChange={(e) => setEmailSettings({
                    ...emailSettings,
                    smtpPassword: e.target.value
                  })}
                />
                
                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={emailSettings.enableReminders}
                      onChange={(e) => setEmailSettings({
                        ...emailSettings,
                        enableReminders: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Enable automated reminder emails
                    </span>
                  </label>
                </div>
                
                {emailSettings.enableReminders && (
                  <div>
                    <Input
                      label="Send reminders (days before deadline)"
                      type="number"
                      value={emailSettings.reminderDays}
                      onChange={(e) => setEmailSettings({
                        ...emailSettings,
                        reminderDays: parseInt(e.target.value)
                      })}
                    />
                  </div>
                )}
                
                {/* Email Test Section */}
                <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Test Email Configuration</h3>
                  <div className="flex gap-3">
                    <Input
                      label="Test Recipient"
                      type="email"
                      placeholder="Enter email address for test"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-grow"
                    />
                    <div className="flex items-end">
                      <Button
                        onClick={handleTestEmail}
                        disabled={testingEmail || !testEmail || !emailSettings.smtpHost}
                        leftIcon={testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      >
                        {testingEmail ? 'Sending...' : 'Send Test'}
                      </Button>
                    </div>
                  </div>
                  
                  {testResult && (
                    <div className={`mt-3 p-3 rounded-md ${
                      testResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 
                                          'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      <div className="flex items-start">
                        {testResult.success ? 
                          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" /> : 
                          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className="text-sm font-medium">{testResult.success ? 'Success!' : 'Error'}</p>
                          <p className="text-sm">{testResult.message}</p>
                          
                          {testResult.troubleshooting && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-xs font-medium text-yellow-800">Troubleshooting Tips:</p>
                              <p className="text-xs text-yellow-700">{testResult.troubleshooting}</p>
                              
                              {/* Specific Mailtrap info */}
                              {emailSettings.smtpHost.includes('mailtrap') && (
                                <div className="mt-1 pt-1 border-t border-yellow-200">
                                  <p className="text-xs font-medium text-yellow-800">Mailtrap Settings:</p>
                                  <ul className="text-xs list-disc ml-4 text-yellow-700">
                                    <li>Host: sandbox.smtp.mailtrap.io</li>
                                    <li>Port: 2525</li>
                                    <li>Username & password: Use credentials from Mailtrap dashboard</li>
                                    <li>TLS: Enabled</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    This will send a test email to verify your SMTP configuration is working correctly.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* User Settings */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center text-lg font-medium text-gray-900 mb-4">
                <Users className="h-5 w-5 mr-2 text-gray-400" />
                User Settings
              </div>
              
              {saveHistory.length > 0 && (
                <div className="text-xs text-gray-500 mb-4">
                  Last updated: {getLastSaveTime('user.')}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default User Role
                  </label>
                  <select
                    value={userSettings.defaultRole}
                    onChange={(e) => setUserSettings({
                      ...userSettings,
                      defaultRole: e.target.value
                    })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="bidder">Bidder</option>
                    <option value="client_reviewer">Client Reviewer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                
                <Input
                  label="Minimum Password Length"
                  type="number"
                  value={userSettings.minPasswordLength}
                  onChange={(e) => setUserSettings({
                    ...userSettings,
                    minPasswordLength: parseInt(e.target.value)
                  })}
                />
                
                <Input
                  label="Session Timeout (minutes)"
                  type="number"
                  value={userSettings.sessionTimeout}
                  onChange={(e) => setUserSettings({
                    ...userSettings,
                    sessionTimeout: parseInt(e.target.value)
                  })}
                />
                
                <Input
                  label="Maximum Login Attempts"
                  type="number"
                  value={userSettings.maxLoginAttempts}
                  onChange={(e) => setUserSettings({
                    ...userSettings,
                    maxLoginAttempts: parseInt(e.target.value)
                  })}
                />
                
                <div className="md:col-span-2 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userSettings.requireSpecialChars}
                      onChange={(e) => setUserSettings({
                        ...userSettings,
                        requireSpecialChars: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Require special characters in passwords
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userSettings.requireEmailVerification}
                      onChange={(e) => setUserSettings({
                        ...userSettings,
                        requireEmailVerification: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Require email verification for new accounts
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userSettings.adminsBypassVerification}
                      onChange={(e) => setUserSettings({
                        ...userSettings,
                        adminsBypassVerification: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Allow admins to bypass email verification when creating users
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Integration Settings */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center text-lg font-medium text-gray-900 mb-4">
                <Key className="h-5 w-5 mr-2 text-gray-400" />
                Integration Settings
              </div>
              
              {saveHistory.length > 0 && (
                <div className="text-xs text-gray-500 mb-4">
                  Last updated: {getLastSaveTime('integration.')}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input
                    label="API Key"
                    value={integrationSettings.apiKey}
                    onChange={(e) => setIntegrationSettings({
                      ...integrationSettings,
                      apiKey: e.target.value
                    })}
                    readOnly
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Use this API key to authenticate requests to the RFP Platform API
                  </p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      checked={integrationSettings.enableWebhooks}
                      onChange={(e) => setIntegrationSettings({
                        ...integrationSettings,
                        enableWebhooks: e.target.checked
                      })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Enable webhook notifications
                    </span>
                  </label>
                  
                  {integrationSettings.enableWebhooks && (
                    <Input
                      label="Webhook URL"
                      value={integrationSettings.webhookUrl}
                      onChange={(e) => setIntegrationSettings({
                        ...integrationSettings,
                        webhookUrl: e.target.value
                      })}
                      placeholder="https://"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Save Button */}
      <div className="flex justify-end sticky bottom-0 bg-white p-4 border-t border-gray-200 rounded-t-xl shadow-lg z-10">
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};