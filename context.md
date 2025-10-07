# CRA RFP Platform - Context

## Overall Purpose

The CRA RFP Platform is designed to allow **Charles River Associates (CRA)** to launch and maintain Request for Proposals (RFPs) on behalf of its clients, primarily **Utilities** across North America.

### Key Stakeholders

- **Charles River Associates (CRA)**: The consulting firm that operates the platform and manages RFPs for their utility clients
- **Utilities**: CRA's clients who need to issue RFPs for various energy-related projects
- **Developers/Bidders**: Companies and individuals who respond to RFPs by submitting proposals

### Primary Use Case

Developers (bidders) can find all RFPs launched and actively managed by CRA in one centralized location, making it easier to:
- Discover relevant RFP opportunities
- Access RFP documentation and requirements
- Submit questions through a structured Q&A process
- Manage NDA requirements for confidential RFPs
- Submit proposals and track application status

## Platform Architecture

### User Roles

1. **Administrators (CRA Staff)**: Full platform control, can create and manage all RFPs across all clients
2. **Client Reviewers (Utility Staff)**: Can manage specific RFPs they have access to, review responses
3. **Bidders (Developers)**: Can view RFPs, submit questions, sign NDAs, and submit proposals

### Core Functionality Areas

#### RFP Management
- Create and publish RFPs with structured components
- Support for multiple energy sector categories (Power Generation, Transmission, Energy Capacity, Renewable Credits)
- Visibility controls (public/confidential)
- Status tracking (draft/active/closed)
- Client branding support with logo upload

#### Access Control & Security
- Role-based permissions system
- NDA workflow for confidential documents
- Company-level access management
- Row Level Security (RLS) implementation

#### Communication & Q&A
- Structured question submission system organized by RFP
- Topic categorization for better organization
- Review and approval process for answers
- Email notifications for updates

#### Document Management
- Secure file upload and storage
- Document version control
- NDA-gated access to sensitive materials
- Support for multiple file formats

### Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase (Authentication, Database, Storage)
- **Hosting**: Netlify
- **Email**: Custom SMTP integration via Edge Functions

## Current Status

The platform is in active development with core functionality implemented including user management, RFP creation/management, Q&A system, document handling, and NDA workflows.