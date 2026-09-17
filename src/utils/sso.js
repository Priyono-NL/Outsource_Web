// src/utils/sso.js

export const getCookieDomain = () => {
  const hostname = window.location.hostname;
  // Deteksi localhost atau IP Address (172.16.x.x) agar browser tidak memblokir cookie
  if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return '';
  }
  return hostname.includes('ceresnl.com') ? '.ceresnl.com' : hostname;
};

export const setCookie = (name, value, maxAge = 86400) => {
  const domain = getCookieDomain();
  const domainAttr = domain ? `; domain=${domain}` : '';
  // SameSite=Lax wajib agar aman dalam perpindahan SSO
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${domainAttr}`;
};

export const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
};

export const removeCookie = (name) => {
  const domain = getCookieDomain();
  const hostname = window.location.hostname;
  const pastDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
  
  if (domain) document.cookie = `${name}=;expires=${pastDate};domain=${domain};path=/`;
  document.cookie = `${name}=;expires=${pastDate};domain=${hostname};path=/`;
  document.cookie = `${name}=;expires=${pastDate};path=/`;
};

export const redirectToSSOLogin = () => {
  const currentUrl = window.location.origin + window.location.pathname;
  const ssoUrl = import.meta.env.VITE_SSO_URL || 'https://account.ceresnl.com';
  window.location.href = `${ssoUrl}/login?redirect_url=${encodeURIComponent(currentUrl)}`;
};

export const redirectToSSOLogout = () => {
  const ssoUrl = import.meta.env.VITE_SSO_URL || 'https://account.ceresnl.com';
  window.location.href = `${ssoUrl}/logout`;
};