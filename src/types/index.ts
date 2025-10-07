export type UserRole = 'admin' | 'client_reviewer' | 'bidder';
export type CompanyRole = 'admin' | 'member' | 'pending';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  role: UserRole;
  created_at: string;
  company_id?: string;
  company_role?: CompanyRole;
  title?: string;
  phone?: string;
}

export interface Company {
  id: string;
  name: string;
  website?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  industry?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verified_badge?: boolean;
  email_domain?: string;
  company_size?: string;
  founded_year?: number;
  linkedin_url?: string;
  member_count?: number;
  nda_count?: number;
  join_request_count?: number;
}

export type RFPCategory = 
  | 'power_generation' 
  | 'transmission' 
  | 'energy_capacity' 
  | 'renewable_credits' 
  | 'other';

export type RFPVisibility = 'public' | 'confidential';

export type SubmissionMethod = 'sharefile' | 'instructions';

export interface ShareFileSettings {
  folderId?: string;
  allowModification?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
}

export interface RFP {
  id: string;
  title: string;
  client_id: string;
  client_name: string;
  categories: RFPCategory[];
  visibility: RFPVisibility;
  status: 'draft' | 'active' | 'closed';
  milestones: Milestone[];
  issue_date: string;
  closing_date: string;
  description: string;
  logo_url?: string | null;
  submission_method?: SubmissionMethod;
  submission_instructions?: string | null;
  sharefile_folder_id?: string | null;
  allow_late_submissions?: boolean;
  sharefile_settings?: ShareFileSettings;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  description?: string;
  timezone?: string;
  has_time?: boolean;
}

export interface RFPComponent {
  id: string;
  rfp_id: string;
  title: string;
  content: string;
  requires_approval: boolean;
  requires_nda: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  rfp_id: string;
  user_id: string;
  question: string;
  topic: string;
  status: 'pending' | 'in_review' | 'published';
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  // Joined data
  user_name?: string;
  user_email?: string;
  user_company?: string;
  rfp_title?: string;
  rfps?: any;
  profiles?: any;
}

export interface Message {
  id: string;
  rfp_id: string;
  sender_id: string;
  recipient_id: string | null; // null for broadcast messages
  subject: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'rfp_published' | 'rfp_updated' | 'rfp_closed' | 'question_answered' | 'nda_approved' | 'nda_rejected' | 'access_granted' | 'access_denied' | 'system_notice';
  reference_id?: string;
  read_at: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  rfp_id: string;
  title: string;
  file_path: string;
  file_type: string;
  requires_nda: boolean;
  requires_approval: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  parent_folder?: string | null;
  rfps?: any;
}

export interface NDA {
  id: string;
  rfp_id: string;
  user_id: string;
  document_id: string | null;
  status: 'signed' | 'approved' | 'rejected';
  signed_at: string | null;
  created_at: string;
  full_name: string;
  title?: string;
  company?: string;
  signature_data?: any;
  countersigned_at?: string;
  countersigner_name?: string;
  countersigner_title?: string;
  countersignature_data?: any;
  rejection_reason?: string;
  rejection_date?: string;
  rejection_by?: string;
}

export interface CompanyNDA extends NDA {
  company_id: string;
  signed_by: string;
}

export interface CompanyMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_role: string;
  created_at: string;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'rejected';
  expires_at: string;
  created_at: string;
}