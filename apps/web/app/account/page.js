import { whatsappUrl } from '@/lib/config';
import { fetchAppConfig } from '@/lib/server-api';
import Account from './Account';

export const metadata = { title: 'حسابي', robots: { index: false } };

export default async function AccountPage() {
  const { data: config } = await fetchAppConfig();
  return (
    <Account
      supportUrl={whatsappUrl(config?.supportWhatsapp)}
      replaceCooldownDays={config?.deviceReplaceCooldownDays ?? null}
    />
  );
}
