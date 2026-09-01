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
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=(localStorage.getItem('sige-school-theme')||'').toLowerCase();var k=['#d99000','#ca8a04','#eab308'].includes(p)?'amarillo':['#d34242','#dc2626','#ef4444'].includes(p)?'rojo':['#168a55','#16a34a','#22c55e'].includes(p)?'verde':'azul';var t={amarillo:['#D99000','#F2B72B','#FFF5D9','#6B4300','#362500'],rojo:['#D34242','#F06A62','#FDEDEE','#7F1D1D','#3A0C12'],verde:['#168A55','#35B979','#E8F7EF','#0A5735','#062D20'],azul:['#2563EB','#16A8E4','#E8F0FF','#173A8F','#071A3D']}[k];var s=document.documentElement.style;s.setProperty('--school-primary',t[0]);s.setProperty('--school-secondary',t[1]);s.setProperty('--accent',t[0]);s.setProperty('--accent-cyan',t[1]);s.setProperty('--accent-soft',t[2]);s.setProperty('--accent-strong',t[3]);s.setProperty('--bg-sidebar',t[4]);document.documentElement.dataset.schoolTheme=k}catch(e){}})();` }} />
      </head>
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
