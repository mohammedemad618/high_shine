import AuthForm from '@/components/AuthForm';

export const metadata = { title: 'إنشاء حساب', robots: { index: false } };

export default async function RegisterPage({ searchParams }) {
  const { next } = await searchParams;
  return <AuthForm mode="register" next={typeof next === 'string' ? next : undefined} />;
}
