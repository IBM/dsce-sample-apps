export class QueryResultsModel {
	// fields
	items: any[];
	totalCount: number;
	errorMessage: string;

	constructor(items: any[] = [], totalCount: number = 0, errorMessage: string = '') {
		this.items = items;
		this.totalCount = totalCount;
	}
}
