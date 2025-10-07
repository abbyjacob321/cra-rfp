# CRA RFP Platform

A comprehensive platform for hosting Request for Proposals (RFPs) for utilities across North America, developed for Charles River Associates (CRA).

## Features

### User Management
- Role-based access control with three tiers:
  - **Administrators**: Full platform control and oversight, for all RFPs.
  - **Client Reviewers**: RFP management and response evaluation, for specific RFPs given access to.
  - **Bidders**: RFP viewing and proposal submission, for specific RFPs given access to.
- Secure authentication with email/password
- User profile management with company information
- Activity tracking and notification system

### RFP Management
- Create and publish RFPs with structured components
- Support for multiple RFP categories:
  - Power Generation
  - Transmission
  - Energy Capacity
  - Renewable Credits
- Visibility controls (public/confidential)
- Status tracking (draft/active/closed)
- Automated closing date management
- Client branding support with logo upload

### Q&A Workflow
- Structured question submission system, organized by RFP
- Topic categorization for better organization
- Review and approval process for answers
- Public/private response handling
- Email notifications for new answers
- Question status tracking (pending/in review/published)

### Document Management
- Secure file upload and storage
- Document version control
- NDA workflow integration:
  - Digital NDA signing process
  - Adnub directed access control based on NDA status
  - Document-level NDA requirements
- Support for multiple file formats
- Bulk document operations

### Communication System
- Direct messaging between RFP admin and bidders, but not between bidders.
- Broadcast announcements for RFPs
- Automated notifications for:
  - RFP status changes
  - Question answers
  - NDA approvals
  - Access grants
- Email integration for important updates

### Analytics & Reporting
- RFP engagement metrics
- User activity tracking
- Question response analytics
- Document access statistics
- Custom report generation

### Security Features
- Row Level Security (RLS) implementation
- Granular access controls
- Secure file storage
- Audit logging
- Data encryption

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase (Authentication, Database, Storage)
- **Hosting**: Netlify

## Setup Instructions

1. Clone the repository
2. Install dependencies with `npm install`
3. Copy `.env.example` to `.env` and update with your Supabase credentials
4. **Enable Email Confirmation in Supabase:**
   - Go to your Supabase Dashboard → Authentication → Settings
   - Enable "Enable email confirmations"
   - Set "Site URL" to your domain (e.g., `http://localhost:5173` for development)
   - Configure email templates if desired
5. Connect to Supabase by clicking the "Connect to Supabase" button
6. Run the development server with `npm run dev`

## Deployment

The application can be deployed to Netlify with continuous integration.

## Project Structure

- `/src/components`: Reusable UI components
  - `/admin`: Administrative interface components
  - `/auth`: Authentication-related components
  - `/rfp`: RFP-specific components
  - `/ui`: Common UI elements
- `/src/context`: React context providers
- `/src/pages`: Page components
  - `/admin`: Admin dashboard and management pages
  - `/rfp`: RFP viewing and interaction pages
- `/src/lib`: Utilities and service connections
- `/src/types`: TypeScript type definitions
- `/supabase/migrations`: Database schema migrations

## Development Roadmap

1. Core Infrastructure & Authentication
   - User authentication system
   - Role-based access control
   - Profile management

2. RFP Management
   - RFP creation and publishing
   - Component-based content structure
   - Version control and drafts

3. Q&A and Communications
   - Question submission system
   - Answer review workflow
   - Notification system

4. Document Management
   - Secure file upload
   - NDA workflow
   - Access control

5. Analytics & Refinement
   - Usage metrics
   - Performance optimization
   - User feedback integration

## License

Proprietary - Charles River Associates