import { Alert, Linking } from 'react-native';

/** WhatsApp chat with the support number from /app-config, or null when none is configured. */
export function supportUrl(config, text) {
  if (!config?.supportWhatsapp) return null;
  return `https://wa.me/${config.supportWhatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function openSupport(config, text) {
  const url = supportUrl(config, text);
  if (!url) return;
  Linking.openURL(url).catch(() => Alert.alert('', 'تعذّر فتح واتساب'));
}

/** "١٢ تشرين الثاني" style date for notices. */
export function shortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ar-IQ', { month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}
