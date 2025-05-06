export class QueryParamsModel {
	// fields
	filter: any;
	sortOrder: string; // asc || desc
	sortField: string;
	pageNumber: number;
	pageSize: number;

	// constructor overrides
	constructor(filter, sortOrder = 'asc', sortField = '', pageNumber = 0, pageSize = 10) {
		this.filter = filter;
		this.sortOrder = sortOrder;
		this.sortField = sortField;
		this.pageNumber = pageNumber;
		this.pageSize = pageSize;
	}
}
