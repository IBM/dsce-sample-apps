import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CommonModule, HashLocationStrategy, LocationStrategy } from '@angular/common';

// NGRX
import { StoreModule, Store } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
// State
import { metaReducers, reducers, AppState } from './core/reducers';

import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { ThemeModule } from './views/theme/theme.module';

// carbon-components-angular default imports
import { IconModule, IconService, UIShellModule } from 'carbon-components-angular';

// Auth
import { AuthGuard, AuthService } from './core/auth';
import { CodeEditorModule } from '@ngstack/code-editor';

// CRUD
import {
	HttpUtilsService,
	TypesUtilsService,
	InterceptService
} from './core/_base/crud';

import { PermissionService } from './core/auth/_services/permission.service';
import { PartialsModule } from './views/partials/partials.module';
// import { PdfViewerModule } from 'ng2-pdf-viewer';
import { AssistantService, ConfigurationService, LLMService } from './services';
// import { SafePipe } from './core/_base/pipes/safe.pipe';
// import { MarkdownPipe } from './core/_base/pipes/markdown.pipe';

export function initAuth(store: Store<AppState>, authService: AuthService) {
	return () => new Promise(async resolve => {
		// const authenticated = await keycloakService.init();
		// console.log('CHECK AUTHENTICATED :>>>> ', authenticated);
		// if (authenticated) {
		// 	store.dispatch(new LoginSuccess({ authToken: keycloakService.getToken() }));
		// }
		resolve(true);
	});
}


@NgModule({
	declarations: [
		AppComponent,
  		// MarkdownPipe,
  		// SafePipe
	],
	imports: [
		BrowserModule,
		CommonModule,
		BrowserAnimationsModule,
		HttpClientModule,
		FormsModule,
		AppRoutingModule,
		CoreModule.forRoot(),
		UIShellModule,
		IconModule,
		ThemeModule,
		PartialsModule,
		StoreModule.forRoot(reducers, { metaReducers }),
		EffectsModule.forRoot([]),
		StoreRouterConnectingModule.forRoot({ stateKey: 'router' }),
		StoreDevtoolsModule.instrument(),
		CodeEditorModule.forRoot()
	],
	providers: [
		AuthService,
		AuthGuard,
		HttpUtilsService,
		{
			provide: APP_INITIALIZER,
			useFactory: initAuth,
			deps: [Store, AuthService],
			multi: true
		},
		{ provide: HTTP_INTERCEPTORS, useClass: InterceptService, multi: true },
		{provide: LocationStrategy, useClass: HashLocationStrategy},
		PermissionService,
		AssistantService,
		ConfigurationService,
		LLMService
	],
	bootstrap: [AppComponent]
})
export class AppModule { }
