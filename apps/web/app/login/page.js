import AuthForm from '@/components/AuthForm';

export const metadata = { title: 'تسجيل الدخول', robots: { index: false } };

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={typeof next === 'string' ? next : undefined} />;
}
