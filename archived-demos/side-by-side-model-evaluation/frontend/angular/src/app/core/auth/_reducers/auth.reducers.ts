// Actions
import { AuthActions, AuthActionTypes } from '../_actions/auth.actions';
// Models
import { User } from '../_models/user.model';
import { QueryParamsModel } from '../../_base/crud';
import { Permission } from '../_models/types';

export interface AuthState {
	loggedIn: boolean;
	authToken: string;
	user: User;
	isUserLoaded: boolean;
	permissionsResult: { permissions: Permission[], totalCount: number, page: QueryParamsModel};
	isPermissionsLoaded: boolean;
}

export const initialAuthState: AuthState = {
	loggedIn: false,
	authToken: undefined,
	user: undefined,
	isUserLoaded: false,
	permissionsResult: undefined,
	isPermissionsLoaded: false
};

export function authReducer(state = initialAuthState, action: AuthActions): AuthState {
	switch (action.type) {
		
		case AuthActionTypes.LoginSuccess: {
			const token: string = action.payload.token;
			return {
				loggedIn: true,
				authToken: token,
				user: undefined,
				isUserLoaded: false,
				permissionsResult: undefined,
				isPermissionsLoaded: false
			};
		}

		case AuthActionTypes.Logout:
			return initialAuthState;

		case AuthActionTypes.UserLoaded: {
			const user: User = action.payload.user;
			return {
				...state,
				user,
				isUserLoaded: true
			};
		}

		case AuthActionTypes.PermissionsLoaded: {
			const permissionsResult = action.payload;
			return {
				...state,
				permissionsResult,
				isPermissionsLoaded: true
			};
		}

		default:
			return state;

	}
}
