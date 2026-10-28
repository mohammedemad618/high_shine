// Base URL of the REST API, inlined by Vite at build time.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
