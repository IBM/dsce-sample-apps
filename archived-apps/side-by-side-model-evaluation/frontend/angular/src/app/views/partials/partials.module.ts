
// Angular
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ChatComponent } from './widgets/chat/chat.component';

import { ThemeModule } from '../theme/theme.module';
import { VgCoreModule, } from '@videogular/ngx-videogular/core';
import { AgentAssistChatComponent } from './widgets/aa-chat/aa-chat.component';
import { PdfViewerModule } from 'ng2-pdf-viewer';
// import { MarkdownPipe, SafePipe, SanitizeHtmlPipe } from '../../core/_base/pipes';

@NgModule({
	declarations: [
		ChatComponent,
		AgentAssistChatComponent
	],
	imports: [
		CommonModule,
		ThemeModule,
		RouterModule,
		VgCoreModule,
		PdfViewerModule
	],
	exports: [
		FormsModule,
		ReactiveFormsModule,
		PdfViewerModule,
		ChatComponent,
		AgentAssistChatComponent
	],
	providers: [
		// SafePipe,
		// MarkdownPipe
	]
})
export class PartialsModule {
}
