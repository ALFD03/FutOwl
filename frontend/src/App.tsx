import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth, RequirePerm } from "@/components/layout/Guards";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageLoader } from "@/components/ui";
import { AuthProvider } from "@/context/AuthContext";
import { ClockProvider } from "@/context/ClockContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";

/** Carga diferida (code splitting) de una página exportada con nombre. */
const page = <T, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(async () => ({ default: (await loader())[name] as unknown as React.ComponentType }));

// Público
const HomePage = page(() => import("@/pages/public/HomePage"), "HomePage");
const LivePage = page(() => import("@/pages/public/LivePage"), "LivePage");
const PublicTournamentPage = page(() => import("@/pages/public/PublicTournamentPage"), "PublicTournamentPage");
const PublicMatchPage = page(() => import("@/pages/public/PublicMatchPage"), "PublicMatchPage");
const TermsPage = page(() => import("@/pages/public/TermsPage"), "TermsPage");
const LoginPage = page(() => import("@/pages/public/LoginPage"), "LoginPage");
const AcceptTermsPage = page(() => import("@/pages/public/AcceptTermsPage"), "AcceptTermsPage");
// Aplicación
const DashboardPage = page(() => import("@/pages/app/DashboardPage"), "DashboardPage");
const MyMatchesPage = page(() => import("@/pages/app/MyMatchesPage"), "MyMatchesPage");
const NotificationsPage = page(() => import("@/pages/app/NotificationsPage"), "NotificationsPage");
const ProfilePage = page(() => import("@/pages/app/ProfilePage"), "ProfilePage");
const registry = () => import("@/pages/app/registry");
const CategoriesPage = page(registry, "CategoriesPage");
const FieldsPage = page(registry, "FieldsPage");
const CoachesPage = page(registry, "CoachesPage");
const GuardiansPage = page(registry, "GuardiansPage");
const PlayersPage = page(registry, "PlayersPage");
const DelegatesPage = page(registry, "DelegatesPage");
const RefereesPage = page(registry, "RefereesPage");
const TeamsPage = page(registry, "TeamsPage");
const TeamDetailPage = page(() => import("@/pages/app/registry/TeamDetailPage"), "TeamDetailPage");
const TournamentsPage = page(() => import("@/pages/app/tournaments/TournamentsPage"), "TournamentsPage");
const TournamentDetailPage = page(() => import("@/pages/app/tournaments/TournamentDetailPage"), "TournamentDetailPage");
const MatchdaysPage = page(() => import("@/pages/app/competition/MatchdaysPage"), "MatchdaysPage");
const MatchdayDetailPage = page(() => import("@/pages/app/competition/MatchdayDetailPage"), "MatchdayDetailPage");
const MatchesPage = page(() => import("@/pages/app/competition/MatchesPage"), "MatchesPage");
const MatchDetailPage = page(() => import("@/pages/app/competition/MatchDetailPage"), "MatchDetailPage");
const ReviewsPage = page(() => import("@/pages/app/competition/ReviewsPage"), "ReviewsPage");
const UsersPage = page(() => import("@/pages/app/admin/UsersPage"), "UsersPage");
const RolesPage = page(() => import("@/pages/app/admin/RolesPage"), "RolesPage");
const AuditPage = page(() => import("@/pages/app/admin/AuditPage"), "AuditPage");
const TermsAdminPage = page(() => import("@/pages/app/admin/TermsAdminPage"), "TermsAdminPage");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
});

const guarded = (perm: string, element: React.ReactNode) => <RequirePerm perm={perm}>{element}</RequirePerm>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ClockProvider>
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route element={<PublicLayout />}>
                      <Route index element={<HomePage />} />
                      <Route path="en-vivo" element={<LivePage />} />
                      <Route path="torneos/:id" element={<PublicTournamentPage />} />
                      <Route path="partido/:id" element={<PublicMatchPage />} />
                      <Route path="terminos" element={<TermsPage />} />
                    </Route>
                    <Route path="login" element={<LoginPage />} />
                    <Route path="aceptar-terminos" element={<RequireAuth><AcceptTermsPage /></RequireAuth>} />
                    <Route path="app" element={<RequireAuth><AppLayout /></RequireAuth>}>
                      <Route index element={<DashboardPage />} />
                      <Route path="mis-partidos" element={<MyMatchesPage />} />
                      <Route path="notificaciones" element={<NotificationsPage />} />
                      <Route path="perfil" element={<ProfilePage />} />
                      <Route path="categorias" element={guarded("registry.view_category", <CategoriesPage />)} />
                      <Route path="canchas" element={guarded("registry.view_field", <FieldsPage />)} />
                      <Route path="entrenadores" element={guarded("registry.view_coach", <CoachesPage />)} />
                      <Route path="representantes" element={guarded("registry.view_guardian", <GuardiansPage />)} />
                      <Route path="jugadores" element={guarded("registry.view_player", <PlayersPage />)} />
                      <Route path="delegados" element={guarded("registry.view_delegate", <DelegatesPage />)} />
                      <Route path="arbitros" element={guarded("registry.view_referee", <RefereesPage />)} />
                      <Route path="equipos" element={guarded("registry.view_team", <TeamsPage />)} />
                      <Route path="equipos/:id" element={guarded("registry.view_team", <TeamDetailPage />)} />
                      <Route path="torneos" element={guarded("tournaments.view_tournament", <TournamentsPage />)} />
                      <Route path="torneos/:id" element={guarded("tournaments.view_tournament", <TournamentDetailPage />)} />
                      <Route path="jornadas" element={guarded("competition.view_matchday", <MatchdaysPage />)} />
                      <Route path="jornadas/:id" element={guarded("competition.view_matchday", <MatchdayDetailPage />)} />
                      <Route path="partidos" element={guarded("competition.view_match", <MatchesPage />)} />
                      <Route path="partidos/:id" element={guarded("competition.view_match", <MatchDetailPage />)} />
                      <Route path="revisiones" element={guarded("competition.view_reviewcase", <ReviewsPage />)} />
                      <Route path="usuarios" element={guarded("accounts.view_user", <UsersPage />)} />
                      <Route path="roles" element={guarded("auth.view_group", <RolesPage />)} />
                      <Route path="auditoria" element={guarded("audit.view_auditlog", <AuditPage />)} />
                      <Route path="terminos" element={guarded("legal.add_termsversion", <TermsAdminPage />)} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </ClockProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
