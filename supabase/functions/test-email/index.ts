import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import { SMTPClient } from 'npm:emailjs@4.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can test email settings');
    }

    // Get email settings from the database
    const { data: settings, error: settingsError } = await supabaseAdmin
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

    if (settingsError) {
      throw settingsError;
    }

    // Extract SMTP settings
    const settingsMap = {};
    settings.forEach(setting => {
      // Parse JSON values
      try {
        if (typeof setting.value === 'string' && 
            (setting.value.startsWith('"') || setting.value.startsWith('['))) {
          settingsMap[setting.key] = JSON.parse(setting.value);
        } else {
          settingsMap[setting.key] = setting.value;
        }
      } catch (e) {
        settingsMap[setting.key] = setting.value;
      }
    });

    const smtpHost = settingsMap['email.smtp_host'];
    const smtpPort = settingsMap['email.smtp_port'];
    const smtpUser = settingsMap['email.smtp_username'];
    const smtpPass = settingsMap['email.smtp_password'];
    const fromName = settingsMap['email.from_name'];
    const fromEmail = settingsMap['email.from_email'];

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      throw new Error('SMTP settings are incomplete. Please configure all required fields: Host, Port, Username, and Password.');
    }

    // Get the request payload with test recipient
    const { testEmail } = await req.json();
    if (!testEmail) {
      throw new Error('Test email recipient is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      throw new Error('Invalid email address format');
    }

    const port = parseInt(smtpPort);
    
    // Determine SSL/TLS configuration based on port and host
    let sslConfig = { ssl: false, tls: false };
    
    // Check for Mailtrap
    const isMailtrap = smtpHost.includes('mailtrap.io');
    
    if (isMailtrap && port === 2525) {
      // Mailtrap uses port 2525 with TLS
      sslConfig = { ssl: false, tls: true };
      console.log('Detected Mailtrap configuration on port 2525, using TLS');
    } else if (port === 465) {
      // SSL/SMTPS
      sslConfig = { ssl: true, tls: false };
    } else if (port === 587 || port === 25 || port === 2525) {
      // STARTTLS
      sslConfig = { ssl: false, tls: true };
    } else {
      // Default to TLS for unknown ports
      sslConfig = { ssl: false, tls: true };
    }

    console.log(`Connecting to SMTP server: ${smtpHost}:${port} with config:`, sslConfig);

    // Create SMTP client with proper SSL/TLS configuration and timeout
    const client = new SMTPClient({
      host: smtpHost,
      port: port,
      user: smtpUser,
      password: smtpPass,
      ...sslConfig,
      timeout: 30000, // 30 second timeout
    });

    // Test connection first
    console.log('Testing SMTP connection...');
    
    // Send test email with proper error handling
    const emailResult = await Promise.race([
      client.sendAsync({
        from: `"${fromName}" <${fromEmail}>`,
        to: testEmail,
        subject: 'CRA RFP Platform - Test Email',
        text: 'This is a test email from the CRA RFP Platform. If you received this email, your SMTP configuration is working properly.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 5px;">
            <h1 style="color: #3b82f6; margin-bottom: 20px;">CRA RFP Platform</h1>
            <p style="margin-bottom: 10px;">This is a test email from the CRA RFP Platform.</p>
            <p style="margin-bottom: 10px;">If you received this email, your SMTP configuration is working properly.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
              <p>This is an automated message, please do not reply.</p>
              <p>Sent from: ${smtpHost}:${port}</p>
              <p>Test timestamp: ${new Date().toISOString()}</p>
            </div>
          </div>
        `,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SMTP connection timed out after 30 seconds')), 30000)
      )
    ]);

    console.log('Email sent successfully:', emailResult);

    // Log the successful email attempt
    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'email_test',
      user_id: user.id,
      metadata: {
        recipient: testEmail,
        smtp_host: smtpHost,
        smtp_port: port,
        ssl_config: sslConfig,
        success: true,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test email sent successfully! Please check your inbox.',
        details: {
          smtp_host: smtpHost,
          smtp_port: port,
          ssl_config: sslConfig,
          recipient: testEmail
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error(`Error in test-email function:`, error);
    
    // Provide more specific error messages based on error type
    let errorMessage = error.message;
    let troubleshooting = '';
    
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      errorMessage = 'Connection to SMTP server timed out';
      troubleshooting = 'This usually means: 1) Wrong SMTP host/port, 2) Firewall blocking connections, 3) SMTP server is down. Check your SMTP settings and ensure the server allows external connections.';
    } else if (error.message.includes('connection has closed') || error.message.includes('connection closed')) {
      errorMessage = 'SMTP server closed the connection unexpectedly';
      troubleshooting = 'This typically indicates: 1) SSL/TLS configuration mismatch - try port 2525 for Mailtrap, 2) Server rejected the connection after initial handshake, 3) Authentication succeeded but server dropped connection due to policy restrictions. For Mailtrap, ensure you\'re using port 2525 as shown in their examples.';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      errorMessage = 'SMTP server hostname could not be resolved';
      troubleshooting = 'Double-check your SMTP host address. Make sure it\'s spelled correctly and the server exists.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused by SMTP server';
      troubleshooting = 'The SMTP server is not accepting connections on the specified port. If you\'re using Mailtrap, try port 2525 instead of 587 or 465.';
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      errorMessage = 'SMTP authentication failed';
      troubleshooting = 'Check your SMTP username and password. Some providers require app passwords instead of regular passwords.';
    } else if (error.message.includes('certificate') || error.message.includes('TLS')) {
      errorMessage = 'SSL/TLS certificate error';
      troubleshooting = 'For Mailtrap, use port 2525 with TLS enabled. For other providers, try using a different port: 587 for TLS or 465 for SSL.';
    }
    
    // Add Mailtrap-specific guidance
    if (error.message.toLowerCase().includes('mailtrap') || 
        (settings && settings.find(s => s.key === 'email.smtp_host' && 
                                 s.value.includes('mailtrap')))) {
      troubleshooting += ' NOTE FOR MAILTRAP: Based on Mailtrap\'s example code, use port 2525 with TLS enabled.';
    }
    
    // Log the error with more details
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabaseAdmin.from('analytics_events').insert({
        event_type: 'email_test_error',
        metadata: {
          error: errorMessage,
          original_error: error.message,
          stack: error.stack,
          troubleshooting: troubleshooting,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        troubleshooting: troubleshooting,
        technical_details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});