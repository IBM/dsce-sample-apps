import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { User } from '../_models/user.model';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable()
export class AuthService {
	constructor(private http: HttpClient) {
	}


	getUserByToken(): Observable<User> {
		// console.log('In Auth Service, getUserByToken: >>> ');
		const userToken = localStorage.getItem(environment.authTokenKey);
		let httpHeaders = new HttpHeaders();
		httpHeaders = httpHeaders.set('Authorization', 'Bearer ' + userToken);
		// return this.http.get<User>('/accounts-endpoint/accounts/users/me', { headers: httpHeaders})

		return this.http.get<User>(environment.AUTH_ENDPOINT + '/api/auth/app-id/userinfo', { headers: httpHeaders })
			.pipe(
				map((res: any) => {
					// console.log(res);
					return res;
				}),
				catchError(err => {
					console.error(err);
					return null;
				})
			);
	}

	logout(logoutOptions): Observable<any> {
		console.log("IN AuthService.logout >>>>>>> ");
		localStorage.clear();
		let httpHeaders = new HttpHeaders();

		return this.http.get<any>(environment.AUTH_ENDPOINT + '/api/auth/app-id/logout', { headers: httpHeaders })
			.pipe(
				map((res: any) => {
					// console.log(res);
					return res;
				}),
				catchError(err => {
					console.error(err);
					return null;
				})
			);
	}

	/*
	 * Handle Http operation that failed.
	 * Let the app continue.
	  *
	* @param operation - name of the operation that failed
	 * @param result - optional value to return as the observable result
	 */
	private handleError<T>(operation = 'operation', result?: any) {
		return (error: any): Observable<any> => {
			// TODO: send the error to remote logging infrastructure
			console.error(error); // log to console instead

			// Let the app keep running by returning an empty result.
			return of(result);
		};
	}
}
