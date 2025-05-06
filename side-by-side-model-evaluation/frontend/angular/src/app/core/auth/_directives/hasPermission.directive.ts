import { Directive, Input, ElementRef, TemplateRef, ViewContainerRef, OnInit } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Account, currentUser, User } from '..';
import { AppState } from '../../reducers';
import { Permission } from '../_models/types';
import { selectPermissionsInStore } from '../_selectors/auth.selectors';

@Directive({
    selector: '[hasPermission]'
})
export class HasPermissionDirective implements OnInit {

    user$: Observable<User>;
    loggedInUser: any;
    resource: string;
    operation: string;
    permissions: Permission[];
    selectedAccount: Account;

    constructor(
        private store: Store<AppState>,
        private element: ElementRef,
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef
    ) {
    }

    ngOnInit() {
        this.user$ = this.store.pipe(select(currentUser));
        this.user$.subscribe(async u => {
            this.loggedInUser = u;                       			
        });

        this.store.pipe(select(selectPermissionsInStore)).subscribe(resp => {
            if(resp && resp.permissions && resp.permissions.length > 0){
                // console.log('PERMISSIONS LOADED: >> ', resp.permissions);
                this.permissions = resp.permissions;
                this.updateView();	
            }			
        });
    }

    @Input()
    set hasPermission(resource) {
        // console.log('IN hasPermission, resource: >> ', resource);
        this.resource = resource;
        this.updateView(); 
    }

    @Input()
    set hasPermissionOperation(op) {
        // console.log('IN hasPermissionOperation, operation', op);
        this.operation = op;
        this.updateView();     
    }

    private updateView() {
        if(!this.resource || !this.operation){
            return false;
        }
        if (this.checkPermission()) {
            // console.log('IN updateView hasPermission >>> for ', this.resource, ' and operation: ', this.operation );
            this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
            // console.log('IN updateView hasNOPermission >>> for ', this.resource, ' and operation: ', this.operation );
            this.viewContainer.clear();
        }
    }

    private checkPermission() {
        let hasPermission = false;
        console.log('this.loggedInUser: >> ', this.loggedInUser);
        if (this.loggedInUser && (this.loggedInUser['roles'] || this.loggedInUser['authorities']) && this.resource && this.operation) {
                if(this.permissions && this.permissions.length > 0){
                    this.permissions.forEach(permission => {
                        if(permission['resource'] == this.resource && permission['operation'] == this.operation){
                            // let matchedRoles = permission['roles'].filter(item => this.loggedInUser['roles'].indexOf(item) != -1);
                            let matchedRoles: any[];
                            if(this.loggedInUser['roles']){
                                matchedRoles = permission['roles'].filter(o1 => this.loggedInUser['roles'].some(o2 => o1 === o2));
                            }

                            if(this.loggedInUser['authorities']){
                                matchedRoles = permission['roles'].filter(o1 => this.loggedInUser['authorities'].some(o2 => o1 === o2));
                            }
                            
                            if(matchedRoles && matchedRoles.length > 0){
                                hasPermission = true;
                                console.log('matchedRoles: >>> ', matchedRoles, ' for ', this.resource, ' and operation: ', this.operation );                                
                            }                                                  
                        }
                    });                   
                }            
        }

        return hasPermission;
    }
}