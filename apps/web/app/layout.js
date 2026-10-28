import { AuthProvider } from '@/components/AuthProvider';
import Header from '@/components/Header';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/config';
import './globals.css';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'ar_IQ',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b5bdb',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AuthProvider>
          <Header />
          <main>{children}</main>
          <footer className="site-footer">
            <div className="container">
              © {new Date().getFullYear()} {SITE_NAME}
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
