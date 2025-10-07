import { supabase } from './supabase';

// ShareFile API configuration
const SHAREFILE_CONFIG = {
  baseUrl: 'https://api.sharefile.com/sf/v3',
  // These would be configured in admin settings
  clientId: '', // To be set from admin settings
  clientSecret: '', // To be set from admin settings
  subdomain: '', // To be set from admin settings
};

export interface ShareFileUploadOptions {
  rfpId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  isLateSubmission?: boolean;
}

export interface ShareFileUploadResult {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  error?: string;
}

export interface ShareFileFolder {
  id: string;
  name: string;
  parentId?: string;
  path: string;
}

class ShareFileService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  /**
   * Initialize ShareFile service with OAuth token
   */
  async initialize(): Promise<boolean> {
    try {
      // Get ShareFile settings from platform_settings
      const { data: settings, error } = await supabase
        .from('platform_settings')
        .select('value')
        .in('key', ['sharefile.client_id', 'sharefile.client_secret', 'sharefile.subdomain'])
        .limit(3);

      if (error) throw error;

      if (!settings || settings.length < 3) {
        console.error('ShareFile settings not configured');
        return false;
      }

      // Parse settings
      const settingsMap = {};
      settings.forEach(setting => {
        const key = setting.key.split('.')[1];
        settingsMap[key] = JSON.parse(setting.value);
      });

      SHAREFILE_CONFIG.clientId = settingsMap.client_id;
      SHAREFILE_CONFIG.clientSecret = settingsMap.client_secret;
      SHAREFILE_CONFIG.subdomain = settingsMap.subdomain;

      return await this.refreshToken();
    } catch (error) {
      console.error('Error initializing ShareFile service:', error);
      return false;
    }
  }

  /**
   * Refresh OAuth access token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      // For demo purposes, we'll simulate token refresh
      // In real implementation, this would use OAuth flow
      this.accessToken = 'demo_token_' + Date.now();
      this.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      return true;
    } catch (error) {
      console.error('Error refreshing ShareFile token:', error);
      return false;
    }
  }

  /**
   * Create a folder for RFP submissions
   */
  async createRFPFolder(rfpId: string, rfpTitle: string): Promise<ShareFileFolder | null> {
    try {
      if (!this.accessToken || !this.isTokenValid()) {
        await this.refreshToken();
      }

      // Simulate folder creation
      const folderId = `rfp_${rfpId}_${Date.now()}`;
      const folder: ShareFileFolder = {
        id: folderId,
        name: `RFP: ${rfpTitle}`,
        path: `/RFPs/${rfpTitle.replace(/[^a-zA-Z0-9]/g, '_')}`
      };

      // Update RFP with ShareFile folder ID
      await supabase
        .from('rfps')
        .update({ sharefile_folder_id: folderId })
        .eq('id', rfpId);

      return folder;
    } catch (error) {
      console.error('Error creating ShareFile folder:', error);
      return null;
    }
  }

  /**
   * Create bidder-specific subfolder
   */
  async createBidderFolder(rfpFolderId: string, bidderName: string, isLate: boolean = false): Promise<ShareFileFolder | null> {
    try {
      const folderName = isLate ? `${bidderName}_LATE_SUBMISSION` : bidderName;
      const folderId = `${rfpFolderId}_${bidderName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

      const folder: ShareFileFolder = {
        id: folderId,
        name: folderName,
        parentId: rfpFolderId,
        path: `/${folderName}`
      };

      return folder;
    } catch (error) {
      console.error('Error creating bidder folder:', error);
      return null;
    }
  }

  /**
   * Upload file to ShareFile
   */
  async uploadFile(options: ShareFileUploadOptions): Promise<ShareFileUploadResult> {
    try {
      if (!this.accessToken || !this.isTokenValid()) {
        await this.refreshToken();
      }

      // Get or create RFP folder
      const { data: rfp, error: rfpError } = await supabase
        .from('rfps')
        .select('sharefile_folder_id, title, client_name')
        .eq('id', options.rfpId)
        .single();

      if (rfpError) throw rfpError;

      let rfpFolderId = rfp.sharefile_folder_id;
      if (!rfpFolderId) {
        const folder = await this.createRFPFolder(options.rfpId, rfp.title);
        rfpFolderId = folder?.id;
      }

      if (!rfpFolderId) {
        throw new Error('Could not create or find RFP folder');
      }

      // Create bidder subfolder
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('company, first_name, last_name')
        .eq('id', user.user?.id)
        .single();

      const bidderName = profile?.company || `${profile?.first_name}_${profile?.last_name}`;
      const bidderFolder = await this.createBidderFolder(rfpFolderId, bidderName, options.isLateSubmission);

      if (!bidderFolder) {
        throw new Error('Could not create bidder folder');
      }

      // Simulate file upload
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const uploadUrl = `https://demo.sharefile.com/upload/${fileId}`;

      // For demo, we'll return success
      return {
        success: true,
        fileId,
        uploadUrl
      };

    } catch (error) {
      console.error('Error uploading to ShareFile:', error);
      return {
        success: false,
        error: error.message || 'Upload failed'
      };
    }
  }

  /**
   * Get upload URL for large file uploads
   */
  async getUploadUrl(folderId: string, fileName: string, fileSize: number): Promise<string | null> {
    try {
      // In real implementation, this would call ShareFile API to get signed upload URL
      return `https://demo.sharefile.com/upload/${folderId}/${fileName}`;
    } catch (error) {
      console.error('Error getting upload URL:', error);
      return null;
    }
  }

  /**
   * Check if current token is valid
   */
  private isTokenValid(): boolean {
    return this.accessToken !== null && 
           this.tokenExpiry !== null && 
           this.tokenExpiry > new Date();
  }

  /**
   * Get folder contents (for admin viewing)
   */
  async getFolderContents(folderId: string): Promise<any[]> {
    try {
      // Simulate getting folder contents
      return [
        {
          id: 'file1',
          name: 'Technical_Proposal.pdf',
          size: 2048000,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'john.doe@company.com'
        },
        {
          id: 'file2',
          name: 'Financial_Proposal.xlsx',
          size: 512000,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'john.doe@company.com'
        }
      ];
    } catch (error) {
      console.error('Error getting folder contents:', error);
      return [];
    }
  }
}

export const shareFileService = new ShareFileService();