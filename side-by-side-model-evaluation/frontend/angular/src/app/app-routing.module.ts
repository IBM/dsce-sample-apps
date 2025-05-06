import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BaseComponent } from './views/theme/base/base.component';

const routes: Routes = [
	// {path: 'error', loadChildren: () => import('./views/pages/error/error.module').then(m => m.ErrorModule)},
	{
		path: '',
		component: BaseComponent,
		// canActivate: [AuthGuard],
		children: [
			{
				path: 'error',
				loadChildren: () => import('./views/error/error.module').then(m => m.ErrorModule)
			},
			// {
			// 	path: 'home',
			// 	loadChildren: () => import('./views/home/home.module').then(m => m.HomeModule)
			// },
			{
				path: 'configurations',
				loadChildren: () => import('./views/configurations/configurations.module').then(m => m.ConfigurationsModule)
			},
			{
				path: 'llm_comparison',
				loadChildren: () => import('./views/llm_comparison/comparison.module').then(m => m.ComparisonModule)
			},

			{ path: '', redirectTo: 'llm_comparison', pathMatch: 'full' }
		]
	},
	{ path: '**', redirectTo: 'error/denied', pathMatch: 'full' }

];

@NgModule({
	imports: [RouterModule.forRoot(routes, { useHash: true, scrollPositionRestoration: 'enabled' })],
	exports: [RouterModule]
})
export class AppRoutingModule { }
