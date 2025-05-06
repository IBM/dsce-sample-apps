// Angular
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
// RxJS
import { Observable, BehaviorSubject, combineLatest, Subscription, of } from 'rxjs';
// CRUD
import { HttpExtenstionsModel } from './http-extentsions-model';
import { QueryParamsModel } from './query-models/query-params.model';
import { QueryResultsModel } from './query-models/query-results.model';
import { BaseModel } from './_base.model';
import { skip, distinctUntilChanged } from 'rxjs/operators';

// Why not use MatTableDataSource?
/*  In this example, we will not be using the built-in MatTableDataSource because its designed for filtering,
	sorting and pagination of a client - side data array.
	Read the article: 'https://blog.angular-university.io/angular-material-data-table/'
**/
export class BaseDataSource implements DataSource<BaseModel> {
	entitySubject = new BehaviorSubject<any[]>([]);
	hasItems: boolean = true; // Need to show message: 'No records found'

	// Loading | Progress bar
	loading$: Observable<boolean>;
	isPreloadTextViewed$: Observable<boolean> = of(true);

	// Paginator | Paginators count
	paginatorTotalSubject = new BehaviorSubject<number>(0);
	paginatorTotal$: Observable<number>;
	subscriptions: Subscription[] = [];

	constructor() {
		this.paginatorTotal$ = this.paginatorTotalSubject.asObservable();

		// subscribe hasItems to (entitySubject.length==0)
		const hasItemsSubscription = this.paginatorTotal$.pipe(
			distinctUntilChanged(),
			skip(1)
		).subscribe(res => this.hasItems = res > 0);
		this.subscriptions.push(hasItemsSubscription);
	}

	connect(collectionViewer: CollectionViewer): Observable<any[]> {
		// Connecting data source
        return this.entitySubject.asObservable();
    }

	disconnect(collectionViewer: CollectionViewer): void {
		// Disonnecting data source
        this.entitySubject.complete();
		this.paginatorTotalSubject.complete();
		this.subscriptions.forEach(sb => sb.unsubscribe());
	}

	baseFilter(_entities: any[], _queryParams: QueryParamsModel, _filtrationFields: string[] = []): QueryResultsModel {
		const httpExtention = new HttpExtenstionsModel();
		return httpExtention.baseFilter(_entities, _queryParams, _filtrationFields);
	}

	sortArray(_incomingArray: any[], _sortField: string = '', _sortOrder: string = 'asc'): any[] {
		const httpExtention = new HttpExtenstionsModel();
		return httpExtention.sortArray(_incomingArray, _sortField, _sortOrder);
	}

	searchInArray(_incomingArray: any[], _queryObj: any, _filtrationFields: string[] = []): any[] {
		const httpExtention = new HttpExtenstionsModel();
		return httpExtention.searchInArray(_incomingArray, _queryObj, _filtrationFields);
	}
}
