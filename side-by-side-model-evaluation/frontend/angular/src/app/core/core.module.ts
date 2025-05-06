// Anglar
import { NgModule } from '@angular/core';
import { CommonService } from '../services';
// import { CommonService } from '../services/common.service';


@NgModule()
export class CoreModule {
	static forRoot(): any {
        return {
			ngModule: CoreModule,
			providers: [ CommonService ]
        };
    }
}
