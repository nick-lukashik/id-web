/**
 * The inline start of Google Tag Manager. Consent Mode comes first: until a
 * person agrees, Google gets no cookies and no identifier. The container's own
 * script is added by this one, which `'strict-dynamic'` in the CSP trusts through
 * the nonce. `id` is checked by the env schema, so it cannot break out of the string.
 */
export function tagManagerScript(id: string) {
    return `(function(){
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
var s=document.createElement('script');
s.async=true;
s.src='https://www.googletagmanager.com/gtm.js?id=${id}';
document.head.appendChild(s);
})();`
}
