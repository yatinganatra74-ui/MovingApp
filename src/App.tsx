import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { AlertCircle } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isMissingEnvVars = this.state.error?.message?.includes('Supabase environment variables');

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 text-center mb-4">
              {isMissingEnvVars ? 'Configuration Required' : 'Something Went Wrong'}
            </h1>

            {isMissingEnvVars ? (
              <div className="space-y-4">
                <p className="text-slate-600 text-center">
                  This application requires Supabase configuration to function properly.
                </p>

                <div className="bg-slate-50 rounded-lg p-4 text-sm">
                  <p className="font-semibold text-slate-900 mb-2">Required Environment Variables:</p>
                  <ul className="space-y-1 text-slate-700 font-mono text-xs">
                    <li>• VITE_SUPABASE_URL</li>
                    <li>• VITE_SUPABASE_ANON_KEY</li>
                  </ul>
                </div>

                <p className="text-sm text-slate-600">
                  Please add these environment variables in your Netlify site settings under
                  <span className="font-semibold"> Site settings → Environment variables</span>,
                  then redeploy your site.
                </p>
              </div>
            ) : (
              <p className="text-slate-600 text-center">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
