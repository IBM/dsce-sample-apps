
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	GridModule,
	ListModule,
	TabsModule,
	TilesModule,
	DialogModule,
	FileUploaderModule
} from 'carbon-components-angular';

import { RouterOutlet, RouterModule } from '@angular/router';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';

import { ThemeModule } from '../theme/theme.module';
import { ComparisonComponent } from './comparison.component';
import { PerformanceComponent } from './metrics/performance/performance.component';
import { MetricsComponent } from './metrics/accuracy/metrics.component';
import { GenerateComponent } from './generate/generate.component';
import { AuthGuard } from 'src/app/core/auth';

@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		RouterModule.forChild([
			{
				path: '',
				component: ComparisonComponent,
				// canActivate: [AuthGuard]  //--> to remove authentication
			},
		]),
		GridModule,
		ListModule,
		TabsModule,
		TilesModule,
		DialogModule,
		RouterOutlet,
		CanvasJSAngularChartsModule,
		FileUploaderModule
	],
	declarations: [
		PerformanceComponent,
		MetricsComponent,
		GenerateComponent,
		ComparisonComponent
		]
})
export class ComparisonModule { }
