EZEM inven-Track PWA Deployment Steps
=====================================

To make the app installable on phones ("Add to phone") and run properly as a Progressive Web App (PWA):

1. Hosting Requirements:
   - The application files (index.new.html, manifest.webmanifest, sw.js, icon.svg) must be hosted on a secure web server (HTTPS). 
   - Browsers will NOT allow PWA installation over insecure HTTP, except for 'localhost' during development.

2. Web App Manifest & Service Worker link:
   - index.new.html is already updated to include references to manifest.webmanifest and registers sw.js automatically.

3. Steps to install on Mobile:
   - iOS (Safari): Open the web page, tap the "Share" icon at the bottom, and select "Add to Home Screen".
   - Android (Chrome): Open the web page, and either tap the "ADD TO PHONE" button that appears on the login screen, or tap the three dots in Chrome and select "Install App" or "Add to Home screen".
