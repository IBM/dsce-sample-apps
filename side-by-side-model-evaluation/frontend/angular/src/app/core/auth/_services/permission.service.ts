import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QueryParamsModel, QueryResultsModel } from '../../_base/crud';
// import { RESOURCE, OPERATION } from '../_models/types';


const httpHeaders = new HttpHeaders();
		httpHeaders.set('Accept', 'application/json');
		httpHeaders.set('Content-Type', 'application/json');

@Injectable()
export class PermissionService {

	constructor(private http: HttpClient) {
	}

    loadPermissions(queryParams: QueryParamsModel): Observable<QueryResultsModel> {
        console.log('IN PermissionService.loadPermissions: >>> ');
        // return this.http.get<Attribute[]>(environment.API_BASE_URL + '/Resources', {headers: this.httpHeaders});
        const _jsonURL = 'assets/mock/permissions.json';
        return this.http.get<QueryResultsModel>(_jsonURL);
    }

}
