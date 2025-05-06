// Angular
import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
// RxJS
import { Observable } from 'rxjs';
import { delay, map, retryWhen, tap } from 'rxjs/operators';
import { environment } from '.././../../../../environments/environment';
import { AppState } from 'src/app/core/reducers';
import { Store } from '@ngrx/store';
import { Logout } from 'src/app/core/auth';
import { Router } from '@angular/router';

/**
 * More information there => https://medium.com/@MetonymyQT/angular-http-interceptors-what-are-they-and-how-to-use-them-52e060321088
 */
@Injectable()
export class InterceptService implements HttpInterceptor {

	constructor(
		private store: Store<AppState>,
		public router: Router) {
	}

	// intercept request and add token
	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {

		// tslint:disable-next-line:no-debugger
		// modify request

		request = request.clone({
			setHeaders: {
				Authorization: `Bearer ${localStorage.getItem(environment.authTokenKey)}`,
				// 'Content-Type': 'application/json'
			},
			// withCredentials: true
		});
		// console.log('----request----');
		// console.log(request);
		// console.log('--- end of request---');

		return next.handle(request).pipe(
			map((event: HttpEvent<any>) => {
			// console.log(event);
		    if (event instanceof HttpResponse) {
				if (event.url.indexOf('/api/') !== -1) {
					// const totalCount = event.headers.get('x-total-count');
					// console.log('totalCount: >> ', totalCount);
					let totalCount = 0;
					if(event.body && Array.isArray(event.body)){
						totalCount = event.body.length;
						let newBody = {items:  event.body, totalCount: totalCount};
						const modEvent = event.clone({ body: newBody });
						// console.log('IN InterceptService, modEvent: >> ', modEvent.body);
						return modEvent;
					}else{

					}
				}

				if (event.url.indexOf('/mock/') !== -1) {
					let totalCount = 0;
					if(event.body){
						totalCount = event.body.length;
					}
					let newBody = {items:  event.body, totalCount: totalCount};
					const modEvent = event.clone({ body: newBody });
					return modEvent;
				}
				// console.log('IN InterceptService, RESP: >> ', event.body);
				return event;
		    }else {
				return event;
			}
		  }),
			retryWhen(errors =>
	    errors.pipe(
			delay(1000),
			tap(error => {
						// console.log('ERROR: >>> ', error);
				if (error.status !== 429) {
					if (error.status === 401) {
						console.log('In HttpInterceptor, AUTHORIZATION REQUIRED !!! ');
						this.authRedirect();
					}
				throw error;
							// return throwError(error);
				}
				console.log('Too many requests to handle by the server, so retrying...');
			})
			))
		);
	}

	authRedirect(){
		this.store.dispatch(new Logout());
		let page: string = String(window.location);
		console.log('page: >> ', page);
		if(page.indexOf('/home') != -1){
			console.log('DO NOTHING');
		}else{
			this.router.navigate(['/'], { queryParams: { returnUrl: page } });
			window.location.href = '/';
		}
	}
}
