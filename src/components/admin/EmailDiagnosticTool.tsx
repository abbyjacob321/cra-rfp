import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Loader2, 
  Mail, 
  RefreshCw, 
  Send, 
  Terminal,
  ArrowUpRight,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const EmailDiagnosticTool: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string, troubleshooting?: string, details?: any} | null>(null);
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [fetchingSettings, setFetchingSettings] = useState(false);
  
  useEffect(() => {
    fetchEmailLogs();
    fetchEmailSettings();
  }, []);
  
  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .in('event_type', ['email_sent', 'email_error', 'email_test', 'email_test_error'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setEmailLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching email logs:', error);
      setError(`Failed to load email logs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchEmailSettings = async () => {
    try {
      setFetchingSettings(true);
      
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .in('key', [
          'email.smtp_host',
          'email.smtp_port',
          'email.smtp_username',
          'email.smtp_password',
          'email.from_name',
          'email.from_email'
        ]);
      
      if (error) throw error;
      
      const settings = {};
      data.forEach(setting => {
        // Parse JSON values
        try {
          if (typeof setting.value === 'string' && 
              (setting.value.startsWith('"') || setting.value.startsWith('['))) {
            settings[setting.key] = JSON.parse(setting.value);
          } else {
            settings[setting.key] = setting.value;
          }
        } catch (e) {
          settings[setting.key] = setting.value;
        }
      });
      
      setEmailSettings(settings);
    } catch (error: any) {
      console.error('Error fetching email settings:', error);
    } finally {
      setFetchingSettings(false);
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
          troubleshooting: result.troubleshooting || 'Check your SMTP configuration settings.',
          details: result.technical_details
        });
      } else {
        setTestResult({
          success: true,
          message: result.message || 'Test email sent successfully! Please check your inbox.',
          details: result.details
        });
        
        // Refresh logs to show the new test
        setTimeout(() => {
          fetchEmailLogs();
        }, 1000);
      }
      
    } catch (error: any) {
      console.error('Error testing email:', error);
      setTestResult({
        success: false,
        message: 'Network error occurred while testing email',
        troubleshooting: 'Check your internet connection and try again. If the problem persists, contact your system administrator.'
      });
    } finally {
      setTestingEmail(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  // Check if SMTP settings are complete
  const areSmtpSettingsComplete = () => {
    return emailSettings && 
      emailSettings['email.smtp_host'] && 
      emailSettings['email.smtp_port'] && 
      emailSettings['email.smtp_username'] && 
      emailSettings['email.smtp_password'];
  };
  
  // Get SMTP configuration diagnostics
  const getSmtpDiagnostics = () => {
    if (!emailSettings) return null;
    
    const port = emailSettings['email.smtp_port'];
    const host = emailSettings['email.smtp_host'];
    
    let recommendations = [];
    
    if (host && host.includes('mailtrap.io')) {
      recommendations.push('ℹ️ Mailtrap detected: For Mailtrap sandbox, port 2525 is recommended');
    }
    
    if (port) {
      const portNum = parseInt(port);
      if (portNum === 2525) {
        recommendations.push('✓ Port 2525 is correct for Mailtrap and works with most network configurations');
      } else if (portNum === 587) {
        recommendations.push('Port 587 is standard for STARTTLS connections');
        if (host && host.includes('mailtrap.io')) {
          recommendations.push('⚠️ For Mailtrap, port 2525 is recommended instead of 587');
        }
      } else if (portNum === 465) {
        recommendations.push('Port 465 is standard for SSL/SMTPS connections');
        if (host && host.includes('mailtrap.io')) {
          recommendations.push('⚠️ For Mailtrap, port 2525 is recommended instead of 465');
        }
      } else if (portNum === 25) {
        recommendations.push('⚠️ Port 25 is often blocked by ISPs and cloud providers');
        if (host && host.includes('mailtrap.io')) {
          recommendations.push('⚠️ For Mailtrap, port 2525 is recommended instead of 25');
        }
      } else {
        recommendations.push(`⚠️ Port ${portNum} is uncommon for SMTP. Verify with your provider.`);
      }
    }
    
    if (host) {
      if (host.includes('gmail')) {
        recommendations.push('Gmail requires App Passwords, not regular passwords');
      } else if (host.includes('outlook') || host.includes('hotmail')) {
        recommendations.push('Outlook/Hotmail may require App Passwords');
      }
    }
    
    return recommendations;
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-medium text-gray-900">Email Diagnostic Tool</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => {
            fetchEmailLogs();
            fetchEmailSettings();
          }}
          disabled={loading || fetchingSettings}
        >
          Refresh
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {/* SMTP Settings Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">SMTP Configuration Status</h3>
        
        {fetchingSettings ? (
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking SMTP settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600">SMTP Host</span>
                <span className="flex items-center">
                  {emailSettings && emailSettings['email.smtp_host'] ? (
                    <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> {emailSettings['email.smtp_host']}</>
                  ) : (
                    <><AlertCircle className="h-4 w-4 text-red-500 mr-2" /> Not configured</>
                  )}
                </span>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600">SMTP Port</span>
                <span className="flex items-center">
                  {emailSettings && emailSettings['email.smtp_port'] ? (
                    <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> {emailSettings['email.smtp_port']}</>
                  ) : (
                    <><AlertCircle className="h-4 w-4 text-red-500 mr-2" /> Not configured</>
                  )}
                </span>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600">SMTP Username</span>
                <span className="flex items-center">
                  {emailSettings && emailSettings['email.smtp_username'] ? (
                    <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Configured</>
                  ) : (
                    <><AlertCircle className="h-4 w-4 text-red-500 mr-2" /> Not configured</>
                  )}
                </span>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600">SMTP Password</span>
                <span className="flex items-center">
                  {emailSettings && emailSettings['email.smtp_password'] ? (
                    <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Configured</>
                  ) : (
                    <><AlertCircle className="h-4 w-4 text-red-500 mr-2" /> Not configured</>
                  )}
                </span>
              </div>
            </div>
            
            {/* SMTP Configuration Recommendations */}
            {areSmtpSettingsComplete() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Configuration Analysis</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  {getSmtpDiagnostics()?.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <ArrowUpRight className="h-3 w-3 mr-1 mt-1 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="p-3 rounded-lg flex items-start">
              <div className={`flex-shrink-0 rounded-full p-1 ${areSmtpSettingsComplete() ? 'bg-green-100' : 'bg-red-100'}`}>
                {areSmtpSettingsComplete() ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="ml-3">
                <h4 className={`text-sm font-medium ${areSmtpSettingsComplete() ? 'text-green-800' : 'text-red-800'}`}>
                  {areSmtpSettingsComplete() ? 'SMTP Configuration Complete' : 'SMTP Configuration Incomplete'}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {areSmtpSettingsComplete() 
                    ? 'Your SMTP settings are properly configured. Send a test email to verify connectivity.' 
                    : 'Please configure all required SMTP settings in the Email Settings section.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Test Email Sender */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Send Test Email</h3>
        
        <div className="flex gap-3">
          <Input
            label="Recipient Email"
            type="email"
            placeholder="Enter email address for test"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-grow"
          />
          <div className="flex items-end">
            <Button
              onClick={handleTestEmail}
              disabled={testingEmail || !testEmail || !areSmtpSettingsComplete()}
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
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-grow">
                <p className="text-sm font-medium">{testResult.success ? 'Success!' : 'Test Failed'}</p>
                <p className="text-sm">{testResult.message}</p>
                
                {testResult.troubleshooting && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    <p className="text-xs font-medium">Troubleshooting Tips:</p>
                    <p className="text-xs">{testResult.troubleshooting}</p>
                  </div>
                )}
                
                {testResult.details && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-gray-600">Technical Details</summary>
                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Email Logs */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Recent Email Activity</h3>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          </div>
        ) : emailLogs.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
            No email logs found
          </div>
        ) : (
          <div className="space-y-4">
            {emailLogs.map((log) => (
              <div key={log.id} className={`p-4 rounded-lg border ${
                log.event_type.includes('error') ? 'border-red-200 bg-red-50' : 
                log.event_type === 'email_test' ? 'border-blue-200 bg-blue-50' : 
                'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-start">
                    {log.event_type.includes('error') ? (
                      <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                    ) : log.event_type === 'email_test' ? (
                      <Terminal className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                    ) : (
                      <Mail className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">
                          {log.event_type === 'email_sent' ? 'Email Sent' : 
                           log.event_type === 'email_test' ? 'Test Email' :
                           log.event_type === 'email_error' ? 'Email Error' :
                           log.event_type === 'email_test_error' ? 'Test Email Error' :
                           log.event_type}
                        </h4>
                        {log.metadata?.success && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" /> Success
                          </span>
                        )}
                      </div>
                      
                      {log.metadata?.recipient && (
                        <p className="text-sm text-gray-500 mt-1">
                          To: {log.metadata.recipient}
                        </p>
                      )}
                      
                      {log.metadata?.template && (
                        <p className="text-sm text-gray-500 mt-1">
                          Template: {log.metadata.template}
                        </p>
                      )}
                      
                      {log.metadata?.error && (
                        <p className="text-sm text-red-600 mt-1">
                          Error: {log.metadata.error}
                        </p>
                      )}
                      
                      {log.metadata?.troubleshooting && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-xs font-medium text-yellow-800">Troubleshooting:</p>
                          <p className="text-xs text-yellow-700">{log.metadata.troubleshooting}</p>
                        </div>
                      )}
                      
                      {log.metadata?.smtp_host && (
                        <p className="text-sm text-gray-500 mt-1">
                          SMTP: {log.metadata.smtp_host}
                          {log.metadata.smtp_port ? `:${log.metadata.smtp_port}` : ''}
                          {log.metadata.ssl_config && (
                            <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">
                              {log.metadata.ssl_config.ssl ? 'SSL' : log.metadata.ssl_config.tls ? 'TLS' : 'Plain'}
                            </span>
                          )}
                        </p>
                      )}
                      
                      {log.event_type.includes('error') && log.metadata?.stack && (
                        <div className="mt-2">
                          <details>
                            <summary className="text-xs text-red-700 cursor-pointer">View Error Details</summary>
                            <pre className="mt-2 text-xs bg-red-50 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                              {log.metadata.stack}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDate(log.created_at || log.metadata?.timestamp || '')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Troubleshooting Guide */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
        <div className="flex items-start">
          <Zap className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 mb-2">Common SMTP Issues & Solutions</h3>
            
            <div className="space-y-3 text-sm text-blue-700">
              <div>
                <p className="font-medium">Mailtrap Settings:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Use host: <code className="bg-blue-100 px-1 rounded">sandbox.smtp.mailtrap.io</code></li>
                  <li>• Use port: <code className="bg-blue-100 px-1 rounded">2525</code> (recommended)</li>
                  <li>• Enable TLS option</li>
                  <li>• Make sure to use the exact username and password from Mailtrap dashboard</li>
                </ul>
              </div>
              
              <div>
                <p className="font-medium">Connection Timeouts:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Verify SMTP host address is correct</li>
                  <li>• Check if your SMTP provider blocks external connections</li>
                  <li>• Try different ports: 2525, 587, 465</li>
                </ul>
              </div>
              
              <div>
                <p className="font-medium">Authentication Errors:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Use app passwords for Gmail/Outlook instead of regular passwords</li>
                  <li>• Enable "Less secure app access" if required by your provider</li>
                  <li>• Verify username is complete email address if required</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};