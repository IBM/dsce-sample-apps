
// Angular
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MomentModule } from 'ngx-moment';

// NGRX
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { ChartsModule } from '@carbon/charts-angular';
import { PdfViewerModule } from 'ng2-pdf-viewer';

// carbon-components-angular default imports
import {
	UIShellModule,
	DialogModule,
	SearchModule,
	TilesModule,
	PlaceholderModule,
	GridModule,
	ListModule,
	TabsModule,
	TableModule,
	PaginationModule,
	BreadcrumbModule,
	InputModule,
	DropdownModule,
	IconModule,
	ModalService,
	ModalModule,
	ButtonModule,
	SkeletonModule,
	TagModule,
	LoadingModule,
	InlineLoadingModule,
	ToggleModule,
	RadioModule,
	NotificationModule,
	SliderModule,
	NumberModule,
	StructuredListModule,
	TooltipModule,
	CheckboxModule,
	AccordionModule
} from 'carbon-components-angular';

import { BaseComponent } from './base/base.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { authReducer, AuthEffects } from 'src/app/core/auth';
// import { PartialsModule } from '../partials/partials.module';
import { HasPermissionDirective } from 'src/app/core/auth/_directives/hasPermission.directive';
import { MarkdownPipe, PrettyjsonPipe, SafePipe, SanitizeHtmlPipe } from 'src/app/core/_base/pipes';

@NgModule({
	declarations: [
		BaseComponent,
		HeaderComponent,
		FooterComponent,
		HasPermissionDirective,
		SafePipe,
		MarkdownPipe,
		SanitizeHtmlPipe
	],
	imports: [
		CommonModule,
		RouterModule,
		StoreModule.forFeature('auth', authReducer),
		EffectsModule.forFeature([AuthEffects]),
		FormsModule,
		ReactiveFormsModule,
		MomentModule,
		UIShellModule,
		DialogModule,
		SearchModule,
		TilesModule,
		PlaceholderModule,
		GridModule,
		ListModule,
		TabsModule,
		TableModule,
		PaginationModule,
		BreadcrumbModule,
		InputModule,
		DropdownModule,
		IconModule,
		ModalModule,
		ButtonModule,
		SkeletonModule,
		TagModule,
		LoadingModule,
		InlineLoadingModule,
		ToggleModule,
		RadioModule,
		NotificationModule,
		SliderModule,
		NumberModule,
		ChartsModule,
		StructuredListModule,
		TooltipModule,
		CheckboxModule,
		AccordionModule,
		PdfViewerModule
	],
	exports: [
		BaseComponent,
		HeaderComponent,
		FooterComponent,
		FormsModule,
		ReactiveFormsModule,
		HasPermissionDirective,
		MomentModule,
		UIShellModule,
		DialogModule,
		SearchModule,
		TilesModule,
		PlaceholderModule,
		GridModule,
		ListModule,
		TabsModule,
		TableModule,
		PaginationModule,
		BreadcrumbModule,
		InputModule,
		DropdownModule,
		IconModule,
		ModalModule,
		ButtonModule,
		SkeletonModule,
		TagModule,
		LoadingModule,
		InlineLoadingModule,
		ToggleModule,
		RadioModule,
		NotificationModule,
		SliderModule,
		NumberModule,
		ChartsModule,
		StructuredListModule,
		TooltipModule,
		CheckboxModule,
		AccordionModule,
		PdfViewerModule,
		SafePipe,
		MarkdownPipe,
		SanitizeHtmlPipe,
		// PrettyjsonPipe
	],
	providers: [
		ModalService
	]
})
export class ThemeModule {
}
