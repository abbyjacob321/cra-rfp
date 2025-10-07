import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { LoginForm } from './components/auth/LoginForm';
import { SignUpForm } from './components/auth/SignUpForm';
import { RFPListingPage } from './pages/RFPListingPage';
import { RFPDetailPage } from './pages/RFPDetailPage';
import { RFPNdaPage } from './pages/RFPNdaPage';
import { RFPQuestionsPage } from './pages/RFPQuestionsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRouteGuard } from './components/admin/AdminRouteGuard';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { RFPManagementPage } from './pages/admin/RFPManagementPage';
import { RFPFormPage } from './pages/admin/RFPFormPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { QAManagementPage } from './pages/admin/QAManagementPage';
import { DocumentsPage } from './pages/admin/DocumentsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { ProfilePage } from './pages/ProfilePage';
import { CompanyInvitationPage } from './pages/CompanyInvitationPage';
import { CompanyManagementPage } from './pages/admin/CompanyManagementPage';
import { JoinCompanyFlowPage } from './pages/JoinCompanyFlowPage';
import { CompanyJoinRequestPage } from './pages/CompanyJoinRequestPage';
import { OnboardingFlow } from './components/auth/OnboardingFlow';
import { DiagnosticTools } from './pages/admin/DiagnosticTools';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { RFPInvitationAcceptPage } from './pages/RFPInvitationAcceptPage';

// AuthProvider must wrap all routes so that useAuth can be used
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginForm />} />
            <Route path="signup" element={<SignUpForm />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="invitation" element={<CompanyInvitationPage />} />
            <Route path="join-company" element={<JoinCompanyFlowPage />} />
            <Route path="company-request" element={<CompanyJoinRequestPage />} />
            <Route path="onboarding" element={<OnboardingFlow />} />
            <Route path="verify-email" element={<EmailVerificationPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="rfp-invitation" element={<RFPInvitationAcceptPage />} />
            <Route path="rfps">
              <Route index element={<RFPListingPage />} />
              <Route path="browse" element={<RFPListingPage />} />
              <Route path=":id" element={<RFPDetailPage />} />
            </Route>
            <Route path="rfps/:id/nda" element={<RFPNdaPage />} />
            <Route path="rfps/:id/questions" element={<RFPQuestionsPage />} />
            {/* Add more routes as they're developed */}
          </Route>
          
          {/* Admin Routes */}
          <Route element={<AdminRouteGuard />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="rfps" element={<RFPManagementPage />} />
              <Route path="rfps/new" element={<RFPFormPage />} />
              <Route path="rfps/:id/edit" element={<RFPFormPage />} />
              <Route path="users" element={<UserManagementPage />} />
              <Route path="companies" element={<CompanyManagementPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="questions" element={<QAManagementPage />} />
              <Route path="diagnostic-tools" element={<DiagnosticTools />} />
              {/* Add more admin routes as they're developed */}
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Export the entire app
export default App;