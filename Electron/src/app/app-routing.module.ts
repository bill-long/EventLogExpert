import { HomeComponent } from './components/home/home.component';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IngestComponent } from './components/ingest/ingest.component';

const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'ingest', component: IngestComponent }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true})],
    exports: [RouterModule]
})
export class AppRoutingModule { }
