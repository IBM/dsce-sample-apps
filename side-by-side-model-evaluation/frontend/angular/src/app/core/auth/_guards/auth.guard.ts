// Angular
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
// RxJS
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
// NGRX
import { select, Store } from '@ngrx/store';
// Auth reducers and selectors
import { AppState } from '../../../core/reducers/';
import { isLoggedIn } from '../_selectors/auth.selectors';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private store: Store<AppState>, private router: Router) {
	}

	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
		return this.store
			.pipe(
				select(isLoggedIn),
				tap(loggedIn => {
					if (!loggedIn) {
						console.log(' <<<<<<<< : USER IS NOT LOGGEDIN : >>>>>>>>>');
						this.router.navigate(['error/denied']);
						// this.store.dispatch(new Login());
					}  else{
						console.log(' <<<<<<<< : USER IS LOGGEDIN : >>>>>>>>>');
					}
				})
			);
	}
}
