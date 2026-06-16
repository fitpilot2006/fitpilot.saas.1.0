import { lazy, Suspense } from "react";
import { Route, Switch, Redirect } from "wouter";
import { getToken, getPaToken, getUser } from "./lib/auth.js";
import Layout from "./components/Layout.js";
import ErrorBoundary from "./components/ErrorBoundary.js";

// Eagerly loaded — entry points users see first
import LoginPage from "./pages/LoginPage.js";
import LandingPage from "./pages/LandingPage.js";
import SignupGymPage from "./pages/SignupGymPage.js";
import SignupMemberPage from "./pages/SignupMemberPage.js";
import TermsPage from "./pages/TermsPage.js";
import PrivacyPage from "./pages/PrivacyPage.js";

// Lazily loaded — split into separate chunks, loaded on demand
const DashboardPage        = lazy(() => import("./pages/DashboardPage.js"));
const MembersPage          = lazy(() => import("./pages/MembersPage.js"));
const AttendancePage       = lazy(() => import("./pages/AttendancePage.js"));
const PaymentsPage         = lazy(() => import("./pages/PaymentsPage.js"));
const WorkoutPlansPage     = lazy(() => import("./pages/WorkoutPlansPage.js"));
const BrandingPage         = lazy(() => import("./pages/BrandingPage.js"));
const StaffPage            = lazy(() => import("./pages/StaffPage.js"));
const NotificationsPage    = lazy(() => import("./pages/NotificationsPage.js"));
const MemberPortalPage     = lazy(() => import("./pages/MemberPortalPage.js"));
const PlatformAdminLoginPage  = lazy(() => import("./pages/platform/PlatformAdminLoginPage.js"));
const PlatformAdminDashboard  = lazy(() => import("./pages/platform/PlatformAdminDashboard.js"));
const AIWorkoutPage           = lazy(() => import("./pages/AIWorkoutPage.js"));
const AIDietPage              = lazy(() => import("./pages/AIDietPage.js"));

function PageFallback() {
  return (
    <div className="space-y-5 p-0" aria-hidden>
      <div className="flex items-center justify-between gap-4">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="skeleton h-8 w-20 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function FullPageFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="skeleton w-10 h-10 rounded-2xl" />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) return <Redirect to="/login" />;
  return <>{children}</>;
}

function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const token = getPaToken();
  if (!token) return <Redirect to="/platform-admin" />;
  return <>{children}</>;
}

function GymPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <PrivateRoute>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Component />
        </Suspense>
      </Layout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup/gym" component={SignupGymPage} />
      <Route path="/signup/member" component={SignupMemberPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      <Route path="/member-portal">
        {() => {
          const token = getToken();
          if (!token) return <Redirect to="/login" />;
          return (
            <Suspense fallback={<FullPageFallback />}>
              <MemberPortalPage />
            </Suspense>
          );
        }}
      </Route>

      <Route path="/platform-admin">
        {() => {
          const token = getPaToken();
          if (token) return <Redirect to="/platform-admin/dashboard" />;
          return (
            <Suspense fallback={<FullPageFallback />}>
              <PlatformAdminLoginPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/platform-admin/dashboard">
        <PlatformAdminRoute>
          <Suspense fallback={<FullPageFallback />}>
            <PlatformAdminDashboard />
          </Suspense>
        </PlatformAdminRoute>
      </Route>

      <Route path="/">
        {() => {
          const token = getToken();
          if (!token) return <LandingPage />;
          const user = getUser();
          if (user?.role === "member") return <Redirect to="/member-portal" />;
          return <Redirect to="/dashboard" />;
        }}
      </Route>

      <Route path="/dashboard"><GymPage component={DashboardPage} /></Route>
      <Route path="/members"><GymPage component={MembersPage} /></Route>
      <Route path="/attendance"><GymPage component={AttendancePage} /></Route>
      <Route path="/payments"><GymPage component={PaymentsPage} /></Route>
      <Route path="/workout-plans"><GymPage component={WorkoutPlansPage} /></Route>
      <Route path="/staff"><GymPage component={StaffPage} /></Route>
      <Route path="/branding"><GymPage component={BrandingPage} /></Route>
      <Route path="/alerts"><GymPage component={NotificationsPage} /></Route>
      <Route path="/ai-workout"><GymPage component={AIWorkoutPage} /></Route>
      <Route path="/ai-diet"><GymPage component={AIDietPage} /></Route>

      <Route>
        {() => {
          const user = getUser();
          if (user?.role === "member") return <Redirect to="/member-portal" />;
          return <Redirect to="/dashboard" />;
        }}
      </Route>
    </Switch>
    </ErrorBoundary>
  );
}
