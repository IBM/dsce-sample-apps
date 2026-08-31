
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	GridModule,
	ListModule,
	TabsModule,
	TilesModule,
	DialogModule
} from 'carbon-components-angular';

import { ThemeModule } from '../theme/theme.module';
import { ConfigurationsComponent } from './configurations.component';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/core/auth';

@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		RouterModule.forChild([
			{
				path: '',
				component: ConfigurationsComponent,
				canActivate: [AuthGuard]
			},
		]),
		GridModule,
		ListModule,
		TabsModule,
		TilesModule,
		DialogModule
	],
	declarations: [
		ConfigurationsComponent
		]
})
export class ConfigurationsModule { }
