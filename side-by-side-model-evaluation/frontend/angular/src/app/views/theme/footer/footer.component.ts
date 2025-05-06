import { Component, HostBinding, ViewEncapsulation } from '@angular/core';

@Component({
	selector: 'app-footer',
	templateUrl: './footer.component.html',
	styleUrls: ['./footer.component.scss'],
	encapsulation: ViewEncapsulation.None,
})
export class FooterComponent {
	// adds padding to the top of the document, so the content is below the header
	@HostBinding('class.bx--footer') footerClass = true;

}
