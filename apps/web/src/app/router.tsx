import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { NotesPage } from "@/pages/notes/NotesPage";
import { HealthPage } from "@/pages/health/HealthPage";
import { ProtectedRoute } from "@/shared/ui/ProtectedRoute";

const router = createBrowserRouter([
    { path: "/login", element: <LoginPage /> },
    {
        path: "/",
        element: <ProtectedRoute />,
        children: [
            { path: "notes", element: <NotesPage /> },
            { path: "health", element: <HealthPage /> },
        ],
    },
]);

export function AppRouter() {
    return <RouterProvider router={router} />;
}
