import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import { SMTPClient } from 'npm:emailjs@4.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Email templates
const TEMPLATES = {
  VERIFICATION: 'verification',
  RESET_PASSWORD: 'reset_password',
  WELCOME: 'welcome',
  INVITATION: 'invitation',
  RFP_INVITATION: 'rfp_invitation',
};

interface EmailPayload {
  templateName: string;
  recipient: string;
  subject?: string;
  data?: Record<string, any>;
}

// Function to get email settings from the database
async function getEmailSettings() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: settings, error } = await supabaseAdmin
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

  if (error) {
    throw error;
  }

  // Extract settings
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

  return {
    host: settingsMap['email.smtp_host'],
    port: settingsMap['email.smtp_port'],
    user: settingsMap['email.smtp_username'],
    password: settingsMap['email.smtp_password'],
    fromName: settingsMap['email.from_name'],
    fromEmail: settingsMap['email.from_email']
  };
}

// Generate HTML for verification email
function getVerificationEmailHTML(data: any) {
  const { verificationLink, firstName, lastName } = data;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 5px;">
      <h1 style="color: #3b82f6; margin-bottom: 20px;">CRA RFP Platform</h1>
      <p style="margin-bottom: 10px;">Hello ${firstName || ''} ${lastName || ''},</p>
      <p style="margin-bottom: 20px;">Thank you for signing up for the CRA RFP Platform. Please verify your email address to continue.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Verify Email Address
        </a>
      </div>
      
      <p style="margin-bottom: 10px;">Or copy and paste this link in your browser:</p>
      <p style="margin-bottom: 20px; word-break: break-all; color: #3b82f6;">
        ${verificationLink}
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't sign up for CRA RFP Platform, you can safely ignore this email.</p>
      </div>
    </div>
  `;
}

// Generate HTML for password reset email
function getResetPasswordEmailHTML(data: any) {
  const { resetLink, firstName, lastName } = data;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 5px;">
      <h1 style="color: #3b82f6; margin-bottom: 20px;">CRA RFP Platform</h1>
      <p style="margin-bottom: 10px;">Hello ${firstName || ''} ${lastName || ''},</p>
      <p style="margin-bottom: 20px;">We received a request to reset your password. Click the button below to reset it.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      
      <p style="margin-bottom: 10px;">Or copy and paste this link in your browser:</p>
      <p style="margin-bottom: 20px; word-break: break-all; color: #3b82f6;">
        ${resetLink}
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    </div>
  `;
}

// Generate HTML for welcome email
function getWelcomeEmailHTML(data: any) {
  const { firstName, lastName } = data;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 5px;">
      <h1 style="color: #3b82f6; margin-bottom: 20px;">Welcome to CRA RFP Platform</h1>
      <p style="margin-bottom: 10px;">Hello ${firstName || ''} ${lastName || ''},</p>
      <p style="margin-bottom: 20px;">Thank you for joining the CRA RFP Platform. We're excited to have you on board!</p>
      
      <div style="margin-bottom: 20px;">
        <h2 style="color: #4b5563; font-size: 18px; margin-bottom: 10px;">Getting Started</h2>
        <ul style="padding-left: 20px; color: #4b5563;">
          <li style="margin-bottom: 8px;">Complete your profile information</li>
          <li style="margin-bottom: 8px;">Browse available RFPs</li>
          <li style="margin-bottom: 8px;">Join or create your company</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${Deno.env.get('SITE_URL') || 'https://app.example.com'}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Go to Platform
        </a>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>If you have any questions, please contact our support team.</p>
      </div>
    </div>
  `;
}

// Generate HTML for invitation email
function getInvitationEmailHTML(data: any) {
  const { invitationLink, companyName, role, inviterName } = data;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 5px;">
      <h1 style="color: #3b82f6; margin-bottom: 20px;">CRA RFP Platform - Company Invitation</h1>
      <p style="margin-bottom: 10px;">Hello,</p>
      <p style="margin-bottom: 20px;">You have been invited by ${inviterName} to join <strong>${companyName}</strong> as a <strong>${role}</strong> on the CRA RFP Platform.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Accept Invitation
        </a>
      </div>
      
      <p style="margin-bottom: 10px;">Or copy and paste this link in your browser:</p>
      <p style="margin-bottom: 20px; word-break: break-all; color: #3b82f6;">
        ${invitationLink}
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This invitation will expire in 7 days.</p>
        <p>If you don't have an account, you will be prompted to create one.</p>
      </div>
    </div>
  `;
}

// Generate HTML for RFP invitation email
function getRFPInvitationEmailHTML(data: any) {
  const { invitation_link, rfp_title, client_name, admin_name, firstName, lastName } = data;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 5px;">
      <h1 style="color: #3b82f6; margin-bottom: 20px;">CRA RFP Platform - RFP Invitation</h1>
      <p style="margin-bottom: 10px;">Hello ${firstName ? firstName + ' ' + (lastName || '') : ''},</p>
      <p style="margin-bottom: 20px;">You have been invited by <strong>${admin_name}</strong> to participate in the following RFP:</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h2 style="color: #1e40af; margin-bottom: 10px; font-size: 18px;">${rfp_title}</h2>
        <p style="color: #64748b; margin-bottom: 0;">Issued by: ${client_name}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitation_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View RFP & Register
        </a>
      </div>
      
      <p style="margin-bottom: 10px;">Or copy and paste this link in your browser:</p>
      <p style="margin-bottom: 20px; word-break: break-all; color: #3b82f6;">
        ${invitation_link}
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This invitation will expire in 30 days.</p>
        <p>If you don't have an account on the CRA RFP Platform, you will be prompted to create one.</p>
        <p>This invitation gives you direct access to register for this RFP.</p>
      </div>
    </div>
  `;
}
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

    // Get request payload
    const payload: EmailPayload = await req.json();
    
    if (!payload.templateName || !payload.recipient) {
      throw new Error('Missing required fields: templateName and recipient');
    }

    // Get email settings
    const emailSettings = await getEmailSettings();
    
    // Validate SMTP settings
    if (!emailSettings.host || !emailSettings.port || !emailSettings.user || !emailSettings.password) {
      throw new Error('SMTP settings are incomplete');
    }

    // Set up SSL/TLS configuration based on host and port
    const port = parseInt(emailSettings.port);
    let sslConfig = { ssl: false, tls: false };
    
    // Check for Mailtrap
    const isMailtrap = emailSettings.host.includes('mailtrap.io');
    
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

    console.log(`Using SMTP configuration: ${emailSettings.host}:${port} with SSL/TLS:`, sslConfig);
    
    // Create SMTP client
    const client = new SMTPClient({
      host: emailSettings.host,
      port: port,
      user: emailSettings.user,
      password: emailSettings.password,
      ...sslConfig,
      timeout: 30000 // 30 second timeout
    });

    // Determine email content based on template
    let subject = payload.subject;
    let html = '';

    switch(payload.templateName) {
      case TEMPLATES.VERIFICATION:
        subject = subject || 'Verify your email address';
        html = getVerificationEmailHTML(payload.data || {});
        break;
      case TEMPLATES.RESET_PASSWORD:
        subject = subject || 'Reset your password';
        html = getResetPasswordEmailHTML(payload.data || {});
        break;
      case TEMPLATES.WELCOME:
        subject = subject || 'Welcome to CRA RFP Platform';
        html = getWelcomeEmailHTML(payload.data || {});
        break;
      case TEMPLATES.INVITATION:
        subject = subject || 'Invitation to join company on CRA RFP Platform';
        html = getInvitationEmailHTML(payload.data || {});
        break;
      case TEMPLATES.RFP_INVITATION:
        subject = subject || 'Invitation to participate in RFP';
        html = getRFPInvitationEmailHTML(payload.data || {});
        break;
      default:
        throw new Error(`Unknown template: ${payload.templateName}`);
    }

    // Extract plain text from HTML
    const text = html.replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Send email
    const result = await Promise.race([
      client.sendAsync({
        from: `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`,
        to: payload.recipient,
        subject: subject,
        text: text,
        html: html,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SMTP connection timed out after 30 seconds')), 30000)
      )
    ]);

    // Log the email
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'email_sent',
      metadata: {
        template: payload.templateName,
        recipient: payload.recipient,
        subject: subject,
        success: true,
        timestamp: new Date().toISOString(),
        smtp_settings: {
          host: emailSettings.host,
          port: port,
          ssl_config: sslConfig
        }
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        result: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error(`Error in send-email function:`, error);
    
    // Provide more helpful error messages
    let errorMessage = error.message;
    let troubleshooting = '';
    
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      errorMessage = 'Connection to SMTP server timed out';
      troubleshooting = 'This usually means the SMTP server is unreachable or blocking connections.';
    } else if (error.message.includes('connection has closed') || error.message.includes('connection closed')) {
      errorMessage = 'SMTP server closed the connection unexpectedly';
      troubleshooting = 'This typically indicates a SSL/TLS configuration mismatch. For Mailtrap, use port 2525 with TLS enabled.';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      errorMessage = 'SMTP server hostname could not be resolved';
      troubleshooting = 'Double-check your SMTP host address. For Mailtrap, it should be sandbox.smtp.mailtrap.io';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused by SMTP server';
      troubleshooting = 'The SMTP server is not accepting connections on the specified port. For Mailtrap, try port 2525.';
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      errorMessage = 'SMTP authentication failed';
      troubleshooting = 'Check your SMTP username and password. Make sure they match exactly what is shown in your provider dashboard.';
    }
    
    // Log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabaseAdmin.from('analytics_events').insert({
        event_type: 'email_error',
        metadata: {
          error: errorMessage,
          troubleshooting: troubleshooting,
          stack: error.stack,
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
        troubleshooting: troubleshooting
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});