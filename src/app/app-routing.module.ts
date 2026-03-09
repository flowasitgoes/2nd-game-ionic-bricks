import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'breakout',
    loadChildren: () => import('./breakout/breakout.module').then( m => m.BreakoutModule)
  },
  {
    path: 'rhythm',
    loadChildren: () => import('./rhythm/rhythm.module').then( m => m.RhythmModule)
  },
  {
    path: 'shooting',
    loadChildren: () => import('./shooting/shooting.module').then( m => m.ShootingModule)
  },
  {
    path: 'catching',
    loadChildren: () => import('./catching/catching.module').then( m => m.CatchingModule)
  },
  {
    path: 'jumping',
    loadChildren: () => import('./jumping/jumping.module').then( m => m.JumpingModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
