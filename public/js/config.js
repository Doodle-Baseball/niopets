/* ============================================================
   js/config.js
   Public, browser-safe settings only.
   NEVER put WHOP_API_KEY or WHOP_WEBHOOK_SECRET in this file.
============================================================ */
window.SITE_CONFIG = {
  siteUrl: 'https://niopets.online',

  /* Where the serverless API lives.
     Same domain (Vercel hosting everything): ''
     Separate API subdomain:                  'https://api.niopets.online' */
  apiBase: '',

  /* 'production' or 'sandbox'. Use sandbox while testing. */
  whopEnvironment: 'production',

  /* Web3Forms access keys are public by design. */
  web3formsKey: '4a8a11f5-d945-4465-bc97-f180dac06dfb',

  instagram: 'https://www.instagram.com/niopets3',
  whatsapp: 'https://wa.me/447916627831',
  whatsappNumber: '+44 7916 627831',
  email: 'info@niopets.online',
};

window.US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
