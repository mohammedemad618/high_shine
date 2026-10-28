import RedeemForm from './RedeemForm';

// Code redemption lives on the website only: the iOS app must not unlock content with codes (App Store rule 3.1.1).
export const metadata = { title: 'تفعيل كود', robots: { index: false } };

export default function RedeemPage() {
  return <RedeemForm />;
}
