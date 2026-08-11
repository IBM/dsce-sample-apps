import { LoginSuccess, PermissionsLoaded, PermissionsRequested } from './../_actions/auth.actions';
// Angular
import { Injectable } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
// RxJS
import { filter, mergeMap, tap, withLatestFrom, catchError, map, retry } from 'rxjs/operators';
import { defer, forkJoin, lastValueFrom,  Observable, of } from 'rxjs';
// NGRX
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Action, select, Store } from '@ngrx/store';
// Auth actions
import { AuthActionTypes, Logout, UserLoaded, UserRequested } from '../_actions/auth.actions';
import { AuthService } from '../_services/auth.service';
import { AppState } from '../../reducers';
import { environment } from '../../../../environments/environment';
import { isPermissionsLoaded, isUserLoaded } from '../_selectors/auth.selectors';
import { QueryParamsModel, QueryResultsModel } from '../../_base/crud';
import { PermissionService } from '../_services/permission.service';

@Injectable()
export class AuthEffects {

	loginSuccess$ = createEffect(() => this.actions$.pipe(
		ofType<LoginSuccess>(AuthActionTypes.LoginSuccess),
		tap(action => {
			// console.log('IN LOGIN SUCCESS: >>> ', action.payload);
			localStorage.setItem(environment.authTokenKey, action.payload.token);
			localStorage.setItem(environment.refreshTokenKey, action.payload.refreshToken);
			this.store.dispatch(new UserRequested());
			// this.router.navigate(['home']);
		})
	), { dispatch: false });


	logout$ = createEffect(() => this.actions$.pipe(
		ofType<Logout>(AuthActionTypes.Logout),
		tap(async () => {
			console.log("IN AuthEffect.logout: >> ");
			localStorage.removeItem(environment.authTokenKey);
			localStorage.removeItem(environment.refreshTokenKey);
			this.deleteAllCookies();
			const logoutOptions = {
				redirectUri: window.location.origin + '/'
			};
			this.returnUrl = logoutOptions.redirectUri;
			this.auth.logout(logoutOptions);
			const resp = await lastValueFrom(this.auth.logout(logoutOptions));
			console.log('All should be removed');
			// this.router.navigate(['/'], { queryParams: { returnUrl: logoutOptions.redirectUri } });
			// window.location.href = '/';

		})
	), { dispatch: false });


	loadUser$ = createEffect(() => this.actions$
		.pipe(
			ofType<UserRequested>(AuthActionTypes.UserRequested),
			withLatestFrom(this.store.pipe(select(isUserLoaded))),
			filter(([action, _isUserLoaded]) => !_isUserLoaded),
			mergeMap(([action, _isUserLoaded]) => this.auth.getUserByToken()),
			tap(_user => {
				if (_user) {
					console.log('USER DETAILS :>>> ', _user);
					this.store.dispatch(new UserLoaded({ user: _user }));
					// this.store.dispatch(new AccountsRequested());
					this.router.navigate(['home']);
				} else {
					this.store.dispatch(new Logout());
				}
			}),
			catchError((error) => {
				return error;
			})
		), { dispatch: false });


		loadPermissions$ = createEffect(() => this.actions$
			.pipe(
				ofType<PermissionsRequested>(AuthActionTypes.PermissionsRequested),
				withLatestFrom(this.store.pipe(select(isPermissionsLoaded))),
				filter(([action, _isPermissionsLoaded]) => !_isPermissionsLoaded),
				mergeMap(( [action, _isPermissionsLoaded]) => {
					const requestToServer = this.permissionService.loadPermissions(action.payload.page);
					const lastQuery = of(action.payload.page);
					return forkJoin([requestToServer, lastQuery]);
				}),
				map(response => {
					const result: QueryResultsModel = response[0];
					// console.log('result: > ', result);
					const lastQuery: QueryParamsModel = response[1];
					this.store.dispatch(new PermissionsLoaded(
						{
							permissions: result.items,
							totalCount: result.totalCount,
							page: lastQuery
						}
					))
				}),
				catchError((error) => {
				  return error;
				})
			), { dispatch: false });

	// @Effect()
	// init$ = this.actions$.pipe(
	//   ofType(ROOT_EFFECTS_INIT),
	//   map(action => ...)
	// );


	init$: Observable<Action> = createEffect(() => defer(() => {
		let token = this.route.snapshot.queryParamMap.get('token');
		// console.log('IN AUTH EFFECT init 1, query param token >>>>> : ', token);
		// token = this.route.snapshot.paramMap.get('token');
		// console.log('IN AUTH EFFECT init 2, query param token >>>>> : ', token);
		const paramIndex = window.location.href.indexOf('token=');
		if(paramIndex != -1){
			token = window.location.href.substring(paramIndex);
			token = token.split('&')[0];
			token = token.substr(token.indexOf('=')+1);
		}

		console.log('IN AUTH EFFECT init 3, query param token >>>>> : ', token);

		if(token){
			localStorage.setItem(environment.authTokenKey, token);
			return of(new LoginSuccess({ user: null, token: token, refreshToken: token }));
		}else{
			token = this.getCookie("id_token");
			// console.log(token);
			if(token && token !== ""){
				localStorage.setItem(environment.authTokenKey, token);
			}
			const userToken = localStorage.getItem(environment.authTokenKey);
			const refreshToken = localStorage.getItem(environment.refreshTokenKey);
			let observableResult = of({ type: 'NO_ACTION' });
			if (userToken) {
				console.log('IN AUTH EFFECT init, id_token >>>>> : ', userToken);
				observableResult = of(new LoginSuccess({ user: null, token: userToken, refreshToken: refreshToken }));
			}
			return observableResult;
		}
	}));

	private returnUrl: string;

	constructor(private actions$: Actions,
		private router: Router,
		private route: ActivatedRoute,
		private auth: AuthService,
		private permissionService: PermissionService,
		private store: Store<AppState>) {

		this.router.events.subscribe(event => {
			if (event instanceof NavigationEnd) {
				this.returnUrl = event.url;
			}
		});
	}

	getCookie(name: string) {
        let ca: Array<string> = document.cookie.split(';');
        let cookieName = name + "=";
        let c: string;
		for (let i: number = 0; i < ca.length; i += 1) {
			ca[i] = ca[i].trim();
			const cName = (ca[i].substring(0, ca[i].indexOf('='))).trim();
			if (cName === name) {
				c = ca[i].substring(cookieName.length, ca[i].length);
                return c;
            }
        }
        return undefined;
	}

	deleteAllCookies() {
		// var cookies = document.cookie.split(";");
		// console.log(cookies);
		// for (var i = 0; i < cookies.length; i++) {
		// 	var cookie = cookies[i];
		// 	var eqPos = cookie.indexOf("=");
		// 	var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
		// 	document.cookie = name + "=; domain=.mybuemix.net; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		// }
		const domain = `${document.domain}`;
		if(domain.indexOf('localhost') != -1){
			document.cookie = "id_token=; domain=localhost; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
			document.cookie = "urlAfterLogin=; domain=localhost; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		}else{
			document.cookie = "id_token=; domain=.mybuemix.net; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
			document.cookie = "access_token=; domain=.mybuemix.net; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
			document.cookie = "urlAfterLogin=; domain=.mybuemix.net; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
			document.cookie = `id_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;Domain=.${document.domain.split('.').splice(1).join('.')}`;
			document.cookie = `access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;Domain=.${document.domain.split('.').splice(1).join('.')}`;
			document.cookie = `urlAfterLogin=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;Domain=.${document.domain.split('.').splice(1).join('.')}`;
		}

	}
}
