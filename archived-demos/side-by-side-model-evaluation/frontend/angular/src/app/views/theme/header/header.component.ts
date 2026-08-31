import { Component, HostBinding, ViewEncapsulation, OnInit, AfterViewInit, OnDestroy, Input} from '@angular/core';
// RxJS
import { Observable, Subject, Subscription } from 'rxjs';
// NGRX
import { select, Store } from '@ngrx/store';
import { User, currentUser, Logout } from 'src/app/core/auth';
import { AppState } from 'src/app/core/reducers';
import { Router } from '@angular/router';
import {  PermissionsRequested } from 'src/app/core/auth/_actions/auth.actions';
import { QueryParamsModel } from 'src/app/core/_base/crud';
import { selectPermissionsInStore } from 'src/app/core/auth/_selectors/auth.selectors';
import { HeaderItemInterface } from 'carbon-components-angular';
import { environment } from 'src/environments/environment';



@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrls: ['./header.component.scss'],
	encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy {

	user$: Observable<User>;
	loggedInUser: any;
	// adds padding to the top of the document, so the content is below the header
	@HostBinding('class.cds--header') headerClass = true;

	platform = ' - Demos';
	theme = "g10";
	hasHamburger = true;
	leftPanelActive = false;
	showLeftPanel = false;
	hasActiveChild = true;
	showSearch = true;
	showUserPanel = false;
	myRoute: any;
	isVendorUser = false;

	flip: boolean = false;
	offset: object = { x: 0, y: 0 };

	userAccounts: HeaderItemInterface[];
	account: any;

	private subscriptions: Subscription[] = [];

	@Input('headerEvents') headerEvents:Subject<any>;

	constructor(
		private store: Store<AppState>,
		public router: Router,
		// private cookieService: CookieService
	) {
	}

	ngOnInit() {
		this.user$ = this.store.pipe(select(currentUser));
		this.user$.subscribe(u => {
			this.loggedInUser = u;
			if(this.loggedInUser && this.loggedInUser.id){
				this.loadPermissions();
			}
		});

		this.headerEvents.subscribe(e => {
			// console.log("Header Event Found >>>> ", e, this.showLeftPanel);
			// this.leftPanelActive = false;
			if(e && "showLeftPanel" in e){
				// console.log("Header Event Found 1 >>>> ", e.showLeftPanel);
				this.showLeftPanel = e.showLeftPanel;
			}else{
				// this.showLeftPanel = false;
			}
			if(e && "leftPanelActive" in e){
				// console.log("Header Event Found 2 >>>> ", e.leftPanelActive);
				this.leftPanelActive = e["leftPanelActive"];
			}else{
				this.leftPanelActive = false;
			}

			this.showUserPanel = this.leftPanelActive;
		});
	}

	async ngAfterViewInit(): Promise<void> {

	}

	ngOnDestroy(): void {
		console.log('IN HeaderComponent DESTROY :>>> ');
		this.subscriptions.forEach(el => el.unsubscribe());
		this.headerEvents.unsubscribe();
	}

	hambergerClicked(){
		this.leftPanelActive = !this.leftPanelActive;
		this.showLeftPanel = this.leftPanelActive;
	}

	authRedirect(event){
		let page: string = String(window.location);
		if(page.indexOf('?') != -1){
			console.log('Redirect to: >> ', page.split('?')[0]);
			page = page.split('?')[0];
		}
		// const hostname = location.origin;
		const redirectURL = `${environment.AUTH_ENDPOINT}/api/auth/app-id/authorization?response_type=code&redirect_uri=${environment.AUTH_ENDPOINT}/api/auth/app-id/callback&client_id=${environment.CLIENT_ID}&scope=profile email roles&urlAfterLogin=`+encodeURIComponent(page);
		// const redirectURL = `${hostname}/api/auth/app-id/authorization?response_type=code&redirect_uri=${hostname}/api/auth/app-id/callback&client_id=${environment.CLIENT_ID}&scope=profile email roles&urlAfterLogin=`+encodeURIComponent(page);
		console.log('redirectURL: >> ', redirectURL);
		window.location.href=redirectURL;
	}

	hamburgerClicked(event) {
		// console.log(event);
	}

	notificationClicked(event) {
		console.log(event);
		// console.log(this.router.isActive('dashboard', false));
	}

	avatarClicked(event) {
		console.log(event);
		this.showUserPanel = !this.showUserPanel;
		// console.log("IN avatarClicked, this.showUserPanel: ", this.showUserPanel);
	}

	private async loadPermissions(){
		const queryParams = new QueryParamsModel(
			this.filterConfiguration()
		);

		const permissionsSubscription = await this.store.pipe(select(selectPermissionsInStore)).subscribe(resp => {
			if(resp && resp.permissions && resp.permissions.length > 0){
				// console.log('PERMISSIONS LOADED: >> ', resp.permissions);
			}
		});
		this.subscriptions.push(permissionsSubscription);
		this.store.dispatch(new PermissionsRequested({page: queryParams}));
	}

	filterConfiguration(): any {
		const filter: any = {};
		// filter['where'] = {'and': [{'tenantId': this.account.tenantId}, {'accountId': this.account.id}]};
		filter['fields'] = {
								"id": true,
								"tenantId": true,
								"accountType": true,
								"providerId": true,
								"name": true,
								"title": true,
								"status": true
							}
		return filter;
	}

	// hasRole(role: string){
	// 	let roleFound: boolean = false;
	// 	if(this.loggedInUser && this.loggedInUser['access'] && this.loggedInUser['access']['resourceAccess']){
	// 		const clients = Object.keys(this.loggedInUser['access']['resourceAccess']);
	// 		// console.log(clients);
	// 		for (let client of clients) {
	// 			const roles = this.loggedInUser['access']['resourceAccess'][client]['roles'];
	// 			if(roles){
	// 				for(let r of roles){
	// 					if(r == role){
	// 						roleFound = true;
	// 						break;
	// 					}
	// 				}
	// 			}
	// 		}
	// 	}
	// 	console.log('USER HAS ROLE (', role, '): ', roleFound);
	// 	return roleFound;
	// }

	/**
	 * Login
	 */
	// login() {
	// 	console.log('IN UserProfile Component, Login: >>>>>> ');
	// 	this.keycloakService.login();
	// 	this.store.dispatch(new Login());
	// }

	/**
	 * Log out
	 */
	logout() {
		sessionStorage.clear();
        localStorage.clear();
        // this.cookieService.deleteAll();
		this.store.dispatch(new Logout());
		this.router.navigate(['/'], { queryParams: { returnUrl: '/' } });
		window.location.href = '/';
	}

	accountsSelection($event){
		console.log($event);
		// this.store.dispatch(new AccountSelected({ selectedAccount: resp.accounts[0] }));
	}

}
