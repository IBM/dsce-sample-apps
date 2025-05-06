// NGRX
import {createSelector} from '@ngrx/store';

export const selectAuthState = state => state.auth;

export const isLoggedIn = createSelector(selectAuthState, authState => authState.loggedIn);

export const isLoggedOut = createSelector(isLoggedIn, loggedIn => !loggedIn);

export const currentAuthToken = createSelector(selectAuthState, authState => authState.authToken);

export const isUserLoaded = createSelector(selectAuthState, authState => authState.isUserLoaded);

export const currentUser = createSelector(selectAuthState, authState => authState.user);

export const isPermissionsLoaded = createSelector(selectAuthState, authState => authState.isPermissionsLoaded);

export const selectPermissionsInStore = createSelector(selectAuthState, authState => authState.permissionsResult);

