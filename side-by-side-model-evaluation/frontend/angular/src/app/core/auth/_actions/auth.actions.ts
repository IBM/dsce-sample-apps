import { Action } from '@ngrx/store';
import { QueryParamsModel } from '../../_base/crud';
import { Permission } from '../_models/types';
import { User } from '../_models/user.model';

export enum AuthActionTypes {
	LoginSuccess = '[LoginSuccess] Action',
	Logout = '[Logout] Action',
	UserRequested = '[Request User] Action',
	UserLoaded = '[Load User] Auth API',	
	PermissionsRequested = '[Request Permissions] Action',
	PermissionsLoaded = '[Load Permissions] Action'
}

export class LoginSuccess implements Action {
	readonly type = AuthActionTypes.LoginSuccess;
	constructor(public payload: { user: User, token: string, refreshToken: string }) { }
}

export class Logout implements Action {
	readonly type = AuthActionTypes.Logout;
}

export class UserRequested implements Action {
	readonly type = AuthActionTypes.UserRequested;
}

export class UserLoaded implements Action {
	readonly type = AuthActionTypes.UserLoaded;
	constructor(public payload: { user: User }) { }
}

export class PermissionsRequested implements Action {
	readonly type = AuthActionTypes.PermissionsRequested;
	constructor(public payload: {page: QueryParamsModel}){}
}

export class PermissionsLoaded implements Action {
	readonly type = AuthActionTypes.PermissionsLoaded;
	constructor(public payload: { permissions: Permission[], totalCount: number, page: QueryParamsModel }) { }
}

export type AuthActions =  LoginSuccess | Logout 
						| UserRequested | UserLoaded 
						| PermissionsRequested | PermissionsLoaded;
