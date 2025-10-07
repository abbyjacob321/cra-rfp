@@ .. @@
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;
+
+-- Grant execute permission to make function accessible via PostgREST RPC
+GRANT EXECUTE ON FUNCTION public.update_expired_rfps_simple() TO public;