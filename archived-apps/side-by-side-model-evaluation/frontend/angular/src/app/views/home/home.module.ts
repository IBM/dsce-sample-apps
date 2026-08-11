
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	GridModule,
	ListModule,
	TabsModule,
	TilesModule,
	DialogModule
} from 'carbon-components-angular';

import { StarterHomeComponent } from './starter-home/starter-home.component';
import { HomeRoutingModule } from './home-routing.module';
import { ThemeModule } from '../theme/theme.module';
import { PartialsModule } from '../partials/partials.module';

@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		PartialsModule,
		HomeRoutingModule,
		GridModule,
		ListModule,
		TabsModule,
		TilesModule,
		DialogModule
	],
	declarations: [
		StarterHomeComponent
		]
})
export class HomeModule { }
