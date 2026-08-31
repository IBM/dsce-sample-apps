
export class Assistant {
    public id: string;
    public name: string;
	public default: boolean;
	public aa_environmentId: string;
	public ss_environmentId: string;

	constructor() {
	}

    clear(): void {
        this.id = undefined;
        this.name = undefined;
        this.default = false;
		this.aa_environmentId = undefined;
		this.ss_environmentId = undefined;
      }
 }

