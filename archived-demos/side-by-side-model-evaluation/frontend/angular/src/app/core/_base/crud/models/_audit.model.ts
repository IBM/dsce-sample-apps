export class Audit {
	 ownerId: string;
	 createdBy: string;
	 updatedBy: string;
	 created: Date;
	 modified: Date;

	clear(): void {
			this.ownerId = '';
			this.createdBy = '';
			this.updatedBy = '';
			this.created = new Date();
			this.modified = new Date();
	}

	/*
	get updatedBy(): string {
        return this._updatedBy;
    }

  set updatedBy(newVal: string) {
      this._updatedBy = newVal;
  }

	get createdBy(): string {
        return this._createdBy;
    }

  set createdBy(newVal: string) {
      this._createdBy = newVal;
  }
	*/

}
