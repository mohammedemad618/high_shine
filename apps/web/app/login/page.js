import AuthForm from '@/components/AuthForm';
import { whatsappUrl } from '@/lib/config';
import { fetchAppConfig } from '@/lib/server-api';

export const metadata = { title: 'تسجيل الدخول', robots: { index: false } };

export default async function LoginPage({ searchParams }) {
  const [{ next }, { data: config }] = await Promise.all([searchParams, fetchAppConfig()]);
  return (
    <AuthForm
      mode="login"
      next={typeof next === 'string' ? next : undefined}
      supportUrl={whatsappUrl(config?.supportWhatsapp)}
      replaceCooldownDays={config?.deviceReplaceCooldownDays ?? null}
    />
  );
}
