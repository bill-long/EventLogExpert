import 'reflect-metadata';
import '../polyfills';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { HttpClientModule, HttpClient } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';

// NG Translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { ElectronService } from './providers/electron.service';

import { WebviewDirective } from './directives/webview.directive';

import { AppComponent } from './app.component';
import { HomeComponent } from './components/home/home.component';
import { EventLogService } from './providers/eventlog/eventlog.service';
import { EventUtils } from './providers/eventutils.service';
import { DatabaseService } from './providers/database.service';
import { ScrollbarComponent } from './components/scrollbar/scrollbar.component';
import { IngestComponent } from './components/ingest/ingest.component';
import { EventDetailComponent } from './components/event-detail/event-detail.component';
import { EventTableComponent } from './components/event-table/event-table.component';
import { FilterPaneComponent } from './components/filterpane/filterpane.component';
import { FilterComponent } from './components/filter/filter.component';
import { TagsmodalComponent } from './components/tagsmodal/tagsmodal.component';
import { OSProvidersService } from './providers/osproviders.service';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    WebviewDirective,
    ScrollbarComponent,
    IngestComponent,
    EventDetailComponent,
    EventTableComponent,
    FilterPaneComponent,
    FilterComponent,
    TagsmodalComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (HttpLoaderFactory),
        deps: [HttpClient]
      }
    }),
    ReactiveFormsModule
  ],
  providers: [ElectronService, EventLogService, EventUtils, DatabaseService, OSProvidersService],
  bootstrap: [AppComponent]
})
export class AppModule { }
