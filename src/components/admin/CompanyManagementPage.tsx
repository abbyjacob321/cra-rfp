@@ .. @@
   const fetchCompanies = async () => {
     try {
       setLoading(true);
       setError(null);
 
       // Fetch RFPs for the filter dropdown
       await fetchRFPs();
 
       // Use the enhanced function to get accurate member counts
       const { data, error } = await supabase.rpc('get_all_companies_with_members');

       if (error) {
         console.error('Error fetching companies:', error);
         throw error;
       }
       
       console.log("Companies data received from function:", data);
       
       // Data is already transformed by the function
       setCompanies(data || []);
     } catch (error: any) {
       console.error('Error fetching companies:', error);
       setError(error.message || 'Failed to load companies');
     } finally {
       setLoading(false);
     }
   };
@@ .. @@
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auto-Join
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
@@ .. @@
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{company.member_count || 0} total</span>
                        </div>
                        {(company.primary_member_count || company.secondary_member_count) && (
                          <div className="text-xs text-gray-400 mt-1">
                            {company.primary_member_count || 0} primary, {company.secondary_member_count || 0} collaborators
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {company.auto_join_enabled ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            @{company.verified_domain}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Manual Only
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">