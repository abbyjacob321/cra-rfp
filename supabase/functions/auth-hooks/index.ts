import { createClient } from 'npm:@supabase/supabase-js@2.39.8';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sendEmail(templateName, recipient, data) {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
  
  try {
    const { data: session } = await client.auth.getSession();
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session?.access_token || supabaseServiceKey}`
      },
      body: JSON.stringify({
        templateName,
        recipient,
        data
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send email');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
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
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }
    
    const payload = await req.json();
    const eventType = payload.type;
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Handle different auth events
    switch(eventType) {
      case 'SIGNED_UP':
        // A new user has signed up
        const { user } = payload;
        
        if (!user) {
          throw new Error('No user data in payload');
        }
        
        // Log the event
        await supabase.from('analytics_events').insert({
          event_type: 'user_signup',
          user_id: user.id,
          metadata: {
            email: user.email,
            created_at: user.created_at,
            confirmed_at: user.confirmed_at,
            source: 'auth_hook'
          }
        });
        
        // Get user profile for first/last name if available
        let firstName = '', lastName = '';
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();
            
          if (profile) {
            firstName = profile.first_name;
            lastName = profile.last_name;
          }
        } catch (err) {
          console.warn('Could not get profile for welcome email:', err);
        }
        
        // Send welcome email
        try {
          await sendEmail('welcome', user.email, {
            firstName,
            lastName
          });
        } catch (err) {
          console.error('Failed to send welcome email:', err);
        }
        
        break;
        
      case 'EMAIL_CONFIRM':
        // An email has been confirmed
        const { email } = payload;
        
        if (!email) {
          throw new Error('No email in payload');
        }
        
        // Log the event
        await supabase.from('analytics_events').insert({
          event_type: 'email_confirmed',
          metadata: {
            email,
            timestamp: new Date().toISOString()
          }
        });
        
        break;
        
      case 'PASSWORD_RECOVERY':
        // A password recovery has been requested
        
        // Log the event
        await supabase.from('analytics_events').insert({
          event_type: 'password_recovery',
          metadata: {
            email: payload.email,
            timestamp: new Date().toISOString()
          }
        });
        
        break;
        
      default:
        console.log(`Unhandled auth event type: ${eventType}`);
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Error processing auth hook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'An error occurred processing the auth hook'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});