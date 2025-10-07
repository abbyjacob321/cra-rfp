@@ .. @@
       // Success
       setSuccess(`Company "${newCompanyName}" created successfully! You are now the company administrator.`);
       
+      // Track company creation in analytics
+      await supabase.from('analytics_events').insert({
+        event_type: 'company_created',
+        user_id: (await supabase.auth.getUser()).data.user?.id,
+        metadata: {
+          company_name: newCompanyName,
+          industry: newCompanyIndustry || null,
+          has_website: !!newCompanyWebsite,
+          created_via: 'company_settings'
+        }
+      });
+      
       // Refresh user session to get updated role
       await supabase.auth.refreshSession();
@@ .. @@