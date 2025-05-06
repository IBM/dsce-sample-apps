import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
}

// Uncomment the following lines to activate the service worker
// if (navigator.serviceWorker) {
// 	navigator.serviceWorker.register('sw.js').then(() => {
// 		console.log('Service worker installed')
// 	}, err => {
// 		console.error('Service worker error:', err);
// 	});
// }

// platformBrowserDynamic().bootstrapModule(AppModule);

platformBrowserDynamic().bootstrapModule(AppModule).then(ref => {
	// Ensure Angular destroys itself on hot reloads.
	if (window['ngRef']) {
	  window['ngRef'].destroy();
	}
	window['ngRef'] = ref;
  
	// Otherwise, log the boot error
  }).catch(err => console.error(err));
