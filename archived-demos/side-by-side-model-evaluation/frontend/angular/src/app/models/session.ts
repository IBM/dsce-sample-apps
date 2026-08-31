export class Session {
	public code: string;
	public id: string;
	public keys : SessionKey[];
	constructor() {
	}
 }

 export class SessionKey {
	 public alg: string;
	 public e: string;
	 public kid: string;
	 public kty: string;
	 public n: string;
	 public use: string;
	 constructor(key) {
		 this.alg = key.alg;
		 this.e = key.e;
		 this.kid = key.kid;
		 this.kty = key.kty;
		 this.n = key.n;
		 this.use = key.use;
	 }
 }
