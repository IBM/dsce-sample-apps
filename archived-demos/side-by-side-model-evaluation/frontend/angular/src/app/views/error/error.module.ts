import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule } from '../../core/core.module';
import { RouterModule } from '@angular/router';
import { ErrorComponent } from './error.component';
import { Error1Component } from './error1/error1.component';


@NgModule({
	declarations: [
		ErrorComponent,
		Error1Component,
	],
	imports: [
		CommonModule,
		CoreModule,
		RouterModule.forChild([
			{
				path: '',
				component: ErrorComponent,
				children: [
					{
						path: 'denied',
						component: Error1Component,
					},
				],
			},
		]),
	],
})
export class ErrorModule { }
