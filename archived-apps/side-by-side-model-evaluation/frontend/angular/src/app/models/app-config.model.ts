
export class AppConfig {
    public id: string;
    public tenantId: string;
    public applicationId: string;
	public key: string;
	public config: object;
	constructor() {
	}

    clear(): void {
        this.id = undefined;
        this.tenantId = undefined;
        this.applicationId = undefined;
        this.key = '';
        this.config = {};
      }
 }

