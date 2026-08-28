import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../components/layout/ThemeProvider';
import BootstrapClient from '../components/layout/BootstrapClient';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';

const SYSTEM_NAME = process.env.NEXT_PUBLIC_SYSTEM_NAME || 'SIGE';
const SYSTEM_SUBTITLE = process.env.NEXT_PUBLIC_SYSTEM_SUBTITLE || 'Sistema Integral de Gestión Escolar';
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' });

export const metadata: Metadata = {
  title: `${SYSTEM_NAME} | ${SYSTEM_SUBTITLE}`,
  description: SYSTEM_SUBTITLE,
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={manrope.variable}>
        <ThemeProvider>
          <BootstrapClient />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 6000,
              style: { borderRadius: '10px', padding: '12px 16px', fontSize: '14px', maxWidth: '380px' },
              success: { duration: 5000, iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error:   { duration: 8000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
