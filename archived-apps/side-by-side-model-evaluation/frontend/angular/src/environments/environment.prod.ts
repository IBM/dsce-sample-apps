// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

const hostname = location.origin;
// const hostname = 'https://my-virtual-agent.140j8e66l875.us-east.codeengine.appdomain.cloud0';

export const environment = {
	production: false,
	isMockEnabled: true, // You have to switch this, when your real back-end is done
	// AUTH_ENDPOINT: 'https://my-virtual-agent.140j8e66l875.us-east.codeengine.appdomain.cloud',
	AUTH_ENDPOINT: hostname,
	authTokenKey: 'authce9d77b308c149d5992a80073637e4d5',
	refreshTokenKey: 'refreshce9d77b308c149d5992a80073637e4d5',
	tenantId: 'ibm',
	BACKEND_API_URL: hostname,
	CLIENT_ID: '95c4ac55-c510-441e-b69f-0d8424a7a8fb',
	BACKEND_API_KEY: 'mysecurefastapis'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
