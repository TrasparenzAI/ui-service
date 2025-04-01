import { NgModule} from '@angular/core';
import { CoreRoutingModule} from './core-routing.module';
import { HeaderComponent} from './header/header.component';
import { FooterComponent} from './footer/footer.component';

import { HomeComponent} from './home/home.component';
import { SearchComponent} from './search/search.component';

import { AppRoutingModule} from '../app-routing.module';
import { SharedModule} from '../shared/shared.module';
import { TagsModule} from '../shared/tags/tags.module';

import { ApiMessageService} from './api-message.service';
import { ConfigService} from './config.service';
import { NavigationService} from './navigation.service';

import { AuthModule} from '../auth/auth.module';

import { CreditsComponent } from './credits/credits.component';

import { CompanyListComponent} from './company/company-list.component';
import { CompanySearchComponent} from './company/company-search.component';
import { CompanyMapComponent} from './company/company-map.component';
import { CompanyGraphComponent} from './company/company-graph.component';
import { CompanyService } from './company/company.service';

import { ConductorService } from './conductor/conductor.service';
import { WorkflowCardComponent } from './conductor/workflow.component';

import { ResultService } from './result/result.service';
import { ResultListComponent } from './result/result-list.component';
import { ResultPieComponent } from './result/result-pie.component';

import { ResultAggregatorService } from './result-aggregator/result-aggregator.service';

import { RuleService } from './rule/rule.service';
import { RuleSelectComponent } from './rule/rule-select.component';

import { MainConfigurationComponent } from './configuration/main-conf.component';
import { ConfigurationService } from './configuration/configuration.service';


import { FormsModule, ReactiveFormsModule} from '@angular/forms';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';

// import ngx-translate and the http loader
import { TranslateCompiler, TranslateLoader, TranslateModule} from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { CustomTranslationCompiler } from '../common/helpers/translation-compiler';

import { DesignAngularKitModule } from 'design-angular-kit';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import { NgSelectModule } from '@ng-select/ng-select';
import { Bs5UnixCronModule } from '@sbzen/ng-cron';
import { NgxColorsModule } from 'ngx-colors';
/**
 * Nel core module inserisco tutti i components necessari all'avvio dell'applicazione.
 * Esempio Pagina Iniziale ed Header.
 * Deve essere importato esclusivamente da AppModule.
 *
 * Questo modulo inoltre fornisce l'istanza di tutti quei servizi singleton necessari all'applicazione
 * Esempio: notificationService, apiMessageService.
 */
@NgModule({
    declarations: [
        HeaderComponent,
        FooterComponent,
        HomeComponent,
        SearchComponent,
        CompanyListComponent,
        CompanySearchComponent,
        CompanyMapComponent,
        CompanyGraphComponent,
        ResultListComponent,
        ResultPieComponent,
        WorkflowCardComponent,
        CreditsComponent,
        RuleSelectComponent,
        MainConfigurationComponent,
    ],
    imports: [
        AppRoutingModule,
        CoreRoutingModule,
        SharedModule,
        TagsModule,
        AuthModule,
        FormsModule,        
        ReactiveFormsModule,
        InfiniteScrollDirective,
        TranslateModule.forChild({
            compiler: { provide: TranslateCompiler, useClass: CustomTranslationCompiler },
            loader: {
                provide: TranslateLoader,
                useFactory: CustomHttpLoaderFactory,
                deps: [HttpClient]
            }
        }),
        DesignAngularKitModule.forRoot(),
        LeafletModule,
        LeafletMarkerClusterModule,
        NgSelectModule,
        Bs5UnixCronModule,
        NgxColorsModule
    ],
    exports: [
        AuthModule,
        SharedModule,
        TagsModule,
        HomeComponent,
        SearchComponent,
        HeaderComponent,
        FooterComponent,
        CompanyListComponent,
        CreditsComponent,
        ResultListComponent,
        ResultPieComponent,
        CompanySearchComponent,
        CompanyMapComponent,
        CompanyGraphComponent,
        WorkflowCardComponent,
        RuleSelectComponent,
        MainConfigurationComponent,
        DesignAngularKitModule,
    ],
    providers: [
        // Capire il discorso del root-injector e child-injector.
        ApiMessageService,
        ConfigService,
        NavigationService,
        CompanyService,
        ResultService,
        ResultAggregatorService,
        ConductorService,
        ConfigurationService,
        RuleService
    ]
})
export class CoreModule {}

// required for AOT compilation
export function CustomHttpLoaderFactory(http: HttpClient) {
  return new ConfigService(http);
}