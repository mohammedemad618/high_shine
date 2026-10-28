import { useAuth } from '../store/auth';
import * as endpoints from './endpoints';

export async function signIn(credentials) {
  await useAuth.getState().setTokens(await endpoints.login(credentials));
}

export async function signUp(fields) {
  await useAuth.getState().setTokens(await endpoints.register(fields));
}

/** Ends the server session (best effort, the device slot stays bound) and clears the stored tokens. */
export async function signOut() {
  try {
    await endpoints.logout();
  } catch {
    // offline or already expired: the local session is cleared anyway
  }
  await useAuth.getState().clearSession();
}
